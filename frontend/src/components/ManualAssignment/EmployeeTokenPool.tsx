// frontend/src/components/ManualAssignment/EmployeeTokenPool.tsx
import React from 'react';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { SchedulableEmployee } from '../../hooks/useManualAssignmentValidation';
import styles from './EmployeeTokenPool.module.css';

export interface TokenDragData {
  type: 'employee-token';
  employeeId: string;
  employeeName: string;
}

interface DraggableTokenProps {
  employee: SchedulableEmployee;
  tokenIndex: number;
  isBeingDragged: boolean;
}

const DraggableToken: React.FC<DraggableTokenProps> = ({
  employee,
  tokenIndex,
  isBeingDragged
}) => {
  const dragData: TokenDragData = {
    type: 'employee-token',
    employeeId: employee.id,
    employeeName: employee.name
  };

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging
  } = useDraggable({
    id: `token::${employee.id}::${tokenIndex}`,
    data: dragData
  });

  const style = transform ? {
    transform: CSS.Translate.toString(transform),
    transition: isDragging ? 'none' : 'transform 0.1s ease',
  } : undefined;

  // Get initials for the token
  const initials = employee.name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <div
      ref={setNodeRef}
      className={`${styles.token} ${isDragging ? styles.tokenDragging : ''} ${isBeingDragged ? styles.tokenHidden : ''}`}
      style={style}
      title={`${employee.name} - Schicht ${tokenIndex + 1} zuweisen`}
      {...attributes}
      {...listeners}
    >
      {initials}
    </div>
  );
};

interface EmployeeCardProps {
  employee: SchedulableEmployee;
  draggedEmployeeId: string | null;
}

const EmployeeCard: React.FC<EmployeeCardProps> = ({ employee, draggedEmployeeId }) => {
  const isComplete = employee.remainingShifts === 0;
  const isBeingDragged = draggedEmployeeId === employee.id;

  // Contract badge text
  const contractBadge = employee.contractType === 'small' ? 'K' :
                        employee.contractType === 'large' ? 'G' : 'F';
  const contractTitle = employee.contractType === 'small' ? 'Kleiner Vertrag (1 Schicht)' :
                        employee.contractType === 'large' ? 'Grosser Vertrag (2 Schichten)' :
                        'Flexibler Vertrag';

  // Progress bar width
  const progressWidth = employee.requiredShifts > 0
    ? (employee.assignedShifts / employee.requiredShifts) * 100
    : 0;

  return (
    <div className={`${styles.employeeCard} ${isComplete ? styles.cardComplete : ''}`}>
      <div className={styles.cardHeader}>
        <span className={styles.employeeName} title={employee.name}>
          {employee.name}
        </span>
        <span className={styles.contractBadge} title={contractTitle}>
          {contractBadge}
        </span>
      </div>

      <div className={styles.progressInfo}>
        <span className={styles.shiftCount}>
          {employee.assignedShifts}/{employee.requiredShifts}
        </span>
        <div className={styles.progressBar}>
          <div
            className={styles.progressFill}
            style={{ width: `${progressWidth}%` }}
          />
        </div>
      </div>

      {isComplete ? (
        <div className={styles.completeBadge}>
          Vollst.
        </div>
      ) : (
        <div className={styles.tokensContainer}>
          {Array.from({ length: employee.remainingShifts }).map((_, index) => (
            <DraggableToken
              key={`${employee.id}-token-${index}`}
              employee={employee}
              tokenIndex={employee.assignedShifts + index}
              isBeingDragged={isBeingDragged}
            />
          ))}
        </div>
      )}
    </div>
  );
};

interface EmployeeTokenPoolProps {
  employees: SchedulableEmployee[];
  draggedEmployeeId: string | null;
}

const EmployeeTokenPool: React.FC<EmployeeTokenPoolProps> = ({
  employees,
  draggedEmployeeId
}) => {
  // Calculate totals
  const totalRequired = employees.reduce((sum, e) => sum + e.requiredShifts, 0);
  const totalAssigned = employees.reduce((sum, e) => sum + e.assignedShifts, 0);

  // Sort: incomplete first, then by name
  const sortedEmployees = [...employees].sort((a, b) => {
    const aComplete = a.remainingShifts === 0;
    const bComplete = b.remainingShifts === 0;
    if (aComplete !== bComplete) return aComplete ? 1 : -1;
    return a.name.localeCompare(b.name);
  });

  return (
    <div className={styles.poolContainer}>
      <div className={styles.poolHeader}>
        <div className={styles.headerLeft}>
          <h3 className={styles.title}>Mitarbeiter zuweisen</h3>
          <span className={styles.subtitle}>Ziehen Sie Tokens auf die Schichten</span>
        </div>
        <div className={styles.headerRight}>
          <span className={styles.statsCount}>{totalAssigned}/{totalRequired} Schichten</span>
        </div>
      </div>

      <div className={styles.employeeList}>
        {sortedEmployees.map(employee => (
          <EmployeeCard
            key={employee.id}
            employee={employee}
            draggedEmployeeId={draggedEmployeeId}
          />
        ))}
      </div>
    </div>
  );
};

export default EmployeeTokenPool;
