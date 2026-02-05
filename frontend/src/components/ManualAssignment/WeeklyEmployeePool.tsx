// frontend/src/components/ManualAssignment/WeeklyEmployeePool.tsx
import React from 'react';
import { SchedulableWeeklyEmployee } from '../../hooks/useManualWeekAssignmentValidation';
import DraggableEmployeeBox from '../SwapMode/DraggableEmployeeBox';
import styles from './WeeklyEmployeePool.module.css';

// Re-export DragData for consumers
export type { DragData } from '../SwapMode/DraggableEmployeeBox';

interface EmployeeCardProps {
  employee: SchedulableWeeklyEmployee;
  draggedEmployeeId: string | null;
}

const EmployeeCard: React.FC<EmployeeCardProps> = ({ employee, draggedEmployeeId }) => {
  const isComplete = employee.remainingWeeks === 0;
  const isBeingDragged = draggedEmployeeId === employee.id;

  // Progress bar width
  const progressWidth = employee.requiredWeeks > 0
    ? (employee.assignedWeeks / employee.requiredWeeks) * 100
    : 0;

  return (
    <div className={`${styles.employeeCard} ${isComplete ? styles.cardComplete : ''}`}>
      <div className={styles.cardHeader}>
        <span className={styles.employeeName} title={employee.name}>
          {employee.name}
        </span>
        {employee.isTrainee && (
          <span className={styles.traineeBadge} title="Trainee">
            T
          </span>
        )}
      </div>

      <div className={styles.progressInfo}>
        <span className={styles.weekCount}>
          {employee.assignedWeeks}/{employee.requiredWeeks}
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
          {employee.remainingWeeks > 1 && (
            <div className={styles.deckShadows}>
              {employee.remainingWeeks > 2 && <div className={styles.deckShadow3} />}
              <div className={styles.deckShadow2} />
            </div>
          )}
          {/* Top card - the only draggable one */}
          <div className={styles.topCard}>
            {(() => {
              const tokenIndex = employee.assignedWeeks;
              const [firstname, ...lastnameParts] = employee.name.split(' ');
              const swapableEmployee = {
                id: employee.id,
                firstname,
                lastname: lastnameParts.join(' ') || null,
                employeeType: null,
                isTrainee: employee.isTrainee
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
                    isTrainee: employee.isTrainee
                  }}
                />
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
};

interface WeeklyEmployeePoolProps {
  employees: SchedulableWeeklyEmployee[];
  draggedEmployeeId: string | null;
}

const WeeklyEmployeePool: React.FC<WeeklyEmployeePoolProps> = ({
  employees,
  draggedEmployeeId
}) => {
  // Calculate totals
  const totalRequired = employees.reduce((sum, e) => sum + e.requiredWeeks, 0);
  const totalAssigned = employees.reduce((sum, e) => sum + e.assignedWeeks, 0);

  // Sort: incomplete first, then by name
  const sortedEmployees = [...employees].sort((a, b) => {
    const aComplete = a.remainingWeeks === 0;
    const bComplete = b.remainingWeeks === 0;
    if (aComplete !== bComplete) return aComplete ? 1 : -1;
    return a.name.localeCompare(b.name);
  });

  return (
    <div className={styles.poolContainer}>
      <div className={styles.poolHeader}>
        <div className={styles.headerLeft}>
          <h3 className={styles.title}>Mitarbeiter zuweisen</h3>
          <span className={styles.subtitle}>Ziehen Sie Tokens auf die Wochen</span>
        </div>
        <div className={styles.headerRight}>
          <span className={styles.statsCount}>{totalAssigned}/{totalRequired} Wochen</span>
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

export default WeeklyEmployeePool;
