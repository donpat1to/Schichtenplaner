// frontend/src/components/SwapMode/SwapableEmployeeBox.tsx
import React from 'react';
import { Employee } from '../../models/Employee';
import ShiverAnimation from './ShiverAnimation';
import styles from './SwapableEmployeeBox.module.css';

export type SwapEligibility = 'direct' | 'two-step' | null;

interface SwapableEmployeeBoxProps {
  employee: Employee;
  shiftId: string;
  isSource: boolean;
  eligibility: SwapEligibility;
  onSelect?: (employeeId: string, shiftId: string) => void;
}

const SwapableEmployeeBox: React.FC<SwapableEmployeeBoxProps> = ({
  employee,
  shiftId,
  isSource,
  eligibility,
  onSelect
}) => {
  const isManagerType = employee.employeeType === 'manager';

  // Determine styling based on state
  const getBackgroundColor = (): string => {
    if (isSource) return '#3498db'; // Blue for source
    if (eligibility === 'direct') return '#27ae60'; // Green for direct swap
    if (eligibility === 'two-step') return 'rgba(230, 126, 34, 0.5)'; // Orange 50% opacity
    if (isManagerType) return '#CC0000'; // Manager red
    if (employee.isTrainee) return '#cda8f0'; // Trainee purple
    return '#642ab5'; // Default purple
  };

  const handleClick = () => {
    if (isManagerType) return; // Managers are non-interactive
    if (onSelect) {
      onSelect(employee.id, shiftId);
    }
  };

  const boxContent = (
    <div
      className={`${styles.employeeBox} ${isManagerType ? styles.nonInteractive : styles.interactive}`}
      style={{ backgroundColor: getBackgroundColor() }}
      onClick={handleClick}
      title={`${employee.firstname} ${employee.lastname}${employee.isTrainee ? ' (Azubi)' : ''}${isManagerType ? ' (Manager)' : ''}`}
    >
      {employee.firstname} {employee.lastname}
      {isSource && <span className={styles.sourceIndicator}>*</span>}
    </div>
  );

  // Wrap in shiver animation if direct swap target
  if (eligibility === 'direct' && !isSource) {
    return (
      <ShiverAnimation active={true} intensity="light">
        {boxContent}
      </ShiverAnimation>
    );
  }

  return boxContent;
};

export default SwapableEmployeeBox;
