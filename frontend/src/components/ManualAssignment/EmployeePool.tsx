// frontend/src/components/ManualAssignment/EmployeePool.tsx
import React from 'react';
import { SchedulableEmployee } from '../../hooks/useManualAssignmentValidation';
import DraggableEmployeeBox from '../SwapMode/DraggableEmployeeBox';
import styles from './EmployeePool.module.css';

// Re-export DragData for consumers
export type { DragData } from '../SwapMode/DraggableEmployeeBox';

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
        <div className={styles.deckContainer}>
          {/* Stacked card shadows for deck effect */}
          {employee.remainingShifts > 1 && (
            <div className={styles.deckShadows}>
              {employee.remainingShifts > 2 && <div className={styles.deckShadow3} />}
              <div className={styles.deckShadow2} />
            </div>
          )}
          {/* Top card - the only draggable one */}
          <div className={styles.topCard}>
            {(() => {
              const tokenIndex = employee.assignedShifts;
              const [firstname, ...lastnameParts] = employee.name.split(' ');
              const swapableEmployee = {
                id: employee.id,
                firstname,
                lastname: lastnameParts.join(' ') || null,
                employeeType: null,
                isTrainee: null
              };
              return (
                <DraggableEmployeeBox
                  key={`${employee.id}-token-${tokenIndex}`}
                  employee={swapableEmployee}
                  contextId={`token::${tokenIndex}`}
                  isSource={isBeingDragged}
                  eligibility={null}
                  useDragOverlay={true}
                  dragDataOverride={{
                    type: 'employee-token',
                    employeeId: employee.id,
                    contextId: `token::${tokenIndex}`,
                    employeeName: employee.name,
                    isTrainee: false
                  }}
                />
              );
            })()}
          </div>
          {/* Remaining count badge */}
          {/*{employee.remainingShifts > 1 && (
            <div className={styles.remainingBadge}>
              +{employee.remainingShifts - 1}
            </div>
          )}*/}
        </div>
      )}
    </div>
  );
};

interface EmployeePoolProps {
  employees: SchedulableEmployee[];
  draggedEmployeeId: string | null;
}

const EmployeePool: React.FC<EmployeePoolProps> = ({
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

export default EmployeePool;
