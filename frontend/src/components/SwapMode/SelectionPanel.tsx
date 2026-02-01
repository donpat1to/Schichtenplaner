// frontend/src/components/SwapMode/SelectionPanel.tsx
import React from 'react';
import { Employee } from '../../models/Employee';
import { TimeSlot } from '../../models/ShiftPlan';
import styles from './SelectionPanel.module.css';

interface SelectionPanelProps {
  employee: Employee;
  shiftId: string;
  timeSlot: TimeSlot | null;
  dayOfWeek: number;
  onCancel: () => void;
}

const WEEKDAYS: Record<number, string> = {
  1: 'Montag',
  2: 'Dienstag',
  3: 'Mittwoch',
  4: 'Donnerstag',
  5: 'Freitag',
  6: 'Samstag',
  7: 'Sonntag'
};

const SelectionPanel: React.FC<SelectionPanelProps> = ({
  employee,
  shiftId,
  timeSlot,
  dayOfWeek,
  onCancel
}) => {
  const dayName = WEEKDAYS[dayOfWeek] || `Tag ${dayOfWeek}`;
  const timeSlotName = timeSlot?.name || 'Unbekannt';
  const timeRange = timeSlot
    ? `${timeSlot.startTime} - ${timeSlot.endTime}`
    : '';

  return (
    <div className={styles.selectionPanel}>
      <div className={styles.selectionContent}>
        <div className={styles.selectionInfo}>
          <div className={styles.employeeName}>
            {employee.firstname} {employee.lastname}
          </div>
          <div className={styles.shiftDetails}>
            {dayName} | {timeSlotName} {timeRange && `(${timeRange})`}
          </div>
        </div>

        <div className={styles.instructions}>
          Klicken Sie auf einen Mitarbeiter, um zu tauschen.
          <span className={styles.legend}>
            <span className={styles.directIndicator}></span> Direkter Tausch
            <span className={styles.twoStepIndicator}></span> Zwei-Schritt-Tausch
          </span>
        </div>

        <button
          className={styles.cancelButton}
          onClick={onCancel}
        >
          Auswahl aufheben
        </button>
      </div>
    </div>
  );
};

export default SelectionPanel;
