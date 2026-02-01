// frontend/src/components/SwapMode/WeeklyTwoStepConfirmModal.tsx
import React from 'react';
import { EmployeeWithPreferences, PlanWeek, getCalendarWeekNumber } from '../../models/WeeklyPlan';
import { WeeklySwapStep } from '../../utils/weeklySwapConstraints';
import styles from './WeeklyTwoStepConfirmModal.module.css';

interface WeeklyTwoStepConfirmModalProps {
  swapPath: WeeklySwapStep[];
  employees: EmployeeWithPreferences[];
  weeks: PlanWeek[];
  onConfirm: () => void;
  onCancel: () => void;
}

const WeeklyTwoStepConfirmModal: React.FC<WeeklyTwoStepConfirmModalProps> = ({
  swapPath,
  employees,
  weeks,
  onConfirm,
  onCancel
}) => {
  const getEmployeeName = (empId: string): string => {
    const emp = employees.find(e => e.id === empId);
    return emp ? `${emp.firstname} ${emp.lastname}` : 'Unbekannt';
  };

  const getWeekInfo = (weekId: string): string => {
    const week = weeks.find(w => w.id === weekId);
    if (!week) return 'Unbekannt';
    const weekNumber = getCalendarWeekNumber(new Date(week.startDate));
    return `KW ${weekNumber}`;
  };

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modal}>
        <h3 className={styles.title}>Zwei-Schritt-Tausch bestätigen</h3>

        <p className={styles.description}>
          Ein direkter Tausch ist nicht möglich. Es werden zwei aufeinanderfolgende
          Tauschvorgänge durchgeführt:
        </p>

        <div className={styles.swapSteps}>
          {swapPath.map((step, index) => (
            <div key={index} className={styles.swapStep}>
              <div className={styles.stepNumber}>Schritt {index + 1}</div>
              <div className={styles.swapDetails}>
                <div className={styles.swapParty}>
                  <span className={styles.employeeName}>{getEmployeeName(step.employeeA)}</span>
                  <span className={styles.weekInfo}>{getWeekInfo(step.weekA)}</span>
                </div>
                <div className={styles.swapArrow}>
                  <span>&#8644;</span>
                </div>
                <div className={styles.swapParty}>
                  <span className={styles.employeeName}>{getEmployeeName(step.employeeB)}</span>
                  <span className={styles.weekInfo}>{getWeekInfo(step.weekB)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className={styles.actions}>
          <button
            className={styles.cancelButton}
            onClick={onCancel}
          >
            Abbrechen
          </button>
          <button
            className={styles.confirmButton}
            onClick={onConfirm}
          >
            Tausch durchführen
          </button>
        </div>
      </div>
    </div>
  );
};

export default WeeklyTwoStepConfirmModal;
