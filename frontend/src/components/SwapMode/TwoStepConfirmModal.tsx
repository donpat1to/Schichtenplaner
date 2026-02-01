// frontend/src/components/SwapMode/TwoStepConfirmModal.tsx
import React from 'react';
import { Employee } from '../../models/Employee';
import { ShiftWithData } from '../../models/ShiftPlan';
import { SwapStep } from '../../utils/swapConstraints';
import styles from './TwoStepConfirmModal.module.css';

interface TwoStepConfirmModalProps {
  swapPath: SwapStep[];
  employees: Employee[];
  shifts: ShiftWithData[];
  onConfirm: () => void;
  onCancel: () => void;
}

const WEEKDAYS: Record<number, string> = {
  1: 'Mo',
  2: 'Di',
  3: 'Mi',
  4: 'Do',
  5: 'Fr',
  6: 'Sa',
  7: 'So'
};

const TwoStepConfirmModal: React.FC<TwoStepConfirmModalProps> = ({
  swapPath,
  employees,
  shifts,
  onConfirm,
  onCancel
}) => {
  const getEmployeeName = (empId: string): string => {
    const emp = employees.find(e => e.id === empId);
    return emp ? `${emp.firstname} ${emp.lastname}` : 'Unbekannt';
  };

  const getShiftInfo = (shiftId: string): string => {
    const shift = shifts.find(s => s.id === shiftId);
    if (!shift) return 'Unbekannt';
    const day = WEEKDAYS[shift.dayOfWeek] || '';
    const slotName = shift.timeSlot?.name || '';
    return `${day} ${slotName}`;
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
                  <span className={styles.shiftInfo}>{getShiftInfo(step.shiftA)}</span>
                </div>
                <div className={styles.swapArrow}>
                  <span>&#8644;</span>
                </div>
                <div className={styles.swapParty}>
                  <span className={styles.employeeName}>{getEmployeeName(step.employeeB)}</span>
                  <span className={styles.shiftInfo}>{getShiftInfo(step.shiftB)}</span>
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

export default TwoStepConfirmModal;
