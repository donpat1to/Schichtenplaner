// frontend/src/components/SwapMode/WeeklySelectionPanel.tsx
import React from 'react';
import { EmployeeWithPreferences, PlanWeek, getCalendarWeekNumber } from '../../models/WeeklyPlan';
import styles from './WeeklySelectionPanel.module.css';

interface WeeklySelectionPanelProps {
  employee: EmployeeWithPreferences;
  week: PlanWeek;
  onCancel: () => void;
}

const WeeklySelectionPanel: React.FC<WeeklySelectionPanelProps> = ({
  employee,
  week,
  onCancel
}) => {
  const weekNumber = getCalendarWeekNumber(new Date(week.startDate));

  // Format date range for display
  const formatDateRange = (startDate: string, endDate: string): string => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const options: Intl.DateTimeFormatOptions = { day: '2-digit', month: '2-digit', year: 'numeric' };
    return `${start.toLocaleDateString('de-DE', options)} - ${end.toLocaleDateString('de-DE', options)}`;
  };

  return (
    <div className={styles.selectionPanel}>
      <div className={styles.selectionContent}>
        <div className={styles.selectionInfo}>
          <div className={styles.employeeName}>
            {employee.firstname} {employee.lastname}
          </div>
          <div className={styles.weekDetails}>
            KW {weekNumber} | {formatDateRange(week.startDate, week.endDate)}
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

export default WeeklySelectionPanel;
