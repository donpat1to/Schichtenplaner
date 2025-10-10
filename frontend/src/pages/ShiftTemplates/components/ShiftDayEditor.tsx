// frontend/src/pages/ShiftTemplates/components/ShiftDayEditor.tsx
import React from 'react';
import { TemplateShiftSlot } from '../../../types/shiftTemplate';
import styles from './ShiftDayEditor.module.css';

interface ShiftDayEditorProps {
  day: { id: number; name: string };
  shifts: TemplateShiftSlot[];
  onAddShift: () => void;
  onUpdateShift: (shiftId: string, updates: Partial<TemplateShiftSlot>) => void;
  onRemoveShift: (shiftId: string) => void;
}

const ShiftDayEditor: React.FC<ShiftDayEditorProps> = ({
  day,
  shifts,
  onAddShift,
  onUpdateShift,
  onRemoveShift
}) => {
  return (
    <div className={styles.dayEditor}>
      <div className={styles.dayHeader}>
        <h3 className={styles.dayName}>{day.name}</h3>
        <button className={styles.addButton} onClick={onAddShift}>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
            <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
          </svg>
          Schicht hinzufügen
        </button>
      </div>

      {shifts.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '20px', color: '#999', fontStyle: 'italic' }}>
          Keine Schichten für {day.name}
        </div>
      ) : (
        <div className={styles.shiftsGrid}>
          {shifts.map(shift => (
            <div key={shift.id} className={styles.shiftCard}>
              <div className={styles.shiftHeader}>
                <h4 className={styles.shiftTitle}>Schicht bearbeiten</h4>
                <button
                  className={styles.deleteButton}
                  onClick={() => onRemoveShift(shift.id)}
                  title="Schicht löschen"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
                    <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  Löschen
                </button>
              </div>

              <div className={styles.formGroup}>
                <input
                  type="text"
                  value={shift.timeSlot.name}
                  onChange={(e) => onUpdateShift(shift.id, { timeSlot: { ...shift.timeSlot, name: e.target.value } })}
                  placeholder="Schichtname"
                />
              </div>

              <div className={styles.timeInputs}>
                <div className={styles.formGroup}>
                  <label>Start</label>
                  <input
                    type="time"
                    value={shift.timeSlot.startTime}
                    onChange={(e) => onUpdateShift(shift.id, { timeSlot: { ...shift.timeSlot, startTime: e.target.value } })}
                  />
                </div>

                <div className={styles.formGroup}>
                  <label>Ende</label>
                  <input
                    type="time"
                    value={shift.timeSlot.endTime}
                    onChange={(e) => onUpdateShift(shift.id, { timeSlot: { ...shift.timeSlot, endTime: e.target.value } })}
                  />
                </div>
              </div>

              <div className={styles.formGroup}>
                <label>Benötigte Mitarbeiter</label>
                <div className={styles.requiredEmployees}>
                  <button
                    onClick={() => onUpdateShift(shift.id, { requiredEmployees: Math.max(1, shift.requiredEmployees - 1) })}
                  >
                    -
                  </button>
                  <input
                    type="number"
                    min="1"
                    value={shift.requiredEmployees}
                    onChange={(e) => onUpdateShift(shift.id, { requiredEmployees: parseInt(e.target.value) || 1 })}
                  />
                  <button
                    onClick={() => onUpdateShift(shift.id, { requiredEmployees: shift.requiredEmployees + 1 })}
                  >
                    +
                  </button>
                </div>
              </div>

              {shift.color && (
                <div className={styles.formGroup}>
                  <label>Farbe</label>
                  <input
                    type="color"
                    value={shift.color}
                    onChange={(e) => onUpdateShift(shift.id, { color: e.target.value })}
                    className={styles.colorPicker}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ShiftDayEditor;