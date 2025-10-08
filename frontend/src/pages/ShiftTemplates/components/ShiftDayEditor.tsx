// frontend/src/pages/ShiftTemplates/components/ShiftDayEditor.tsx
import React from 'react';
import { TemplateShift } from '../../../types/shiftTemplate';

interface ShiftDayEditorProps {
  day: { id: number; name: string };
  shifts: TemplateShift[];
  onAddShift: () => void;
  onUpdateShift: (shiftId: string, updates: Partial<TemplateShift>) => void;
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
    <div style={{ border: '1px solid #e0e0e0', borderRadius: '8px', padding: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
        <h3 style={{ margin: 0 }}>{day.name}</h3>
        <button
          onClick={onAddShift}
          style={{ padding: '8px 16px', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '4px' }}
        >
          Schicht hinzufügen
        </button>
      </div>

      {shifts.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '20px', color: '#999', fontStyle: 'italic' }}>
          Keine Schichten für {day.name}
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '15px' }}>
          {shifts.map((shift, index) => (
            <div key={shift.id} style={{ 
              display: 'grid', 
              gridTemplateColumns: '2fr 1fr 1fr 1fr auto',
              gap: '10px',
              alignItems: 'center',
              padding: '15px',
              border: '1px solid #f0f0f0',
              borderRadius: '4px',
              backgroundColor: '#fafafa'
            }}>
              {/* Schicht Name */}
              <div>
                <input
                  type="text"
                  value={shift.name}
                  onChange={(e) => onUpdateShift(shift.id, { name: e.target.value })}
                  placeholder="Schichtname"
                  style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }}
                />
              </div>

              {/* Startzeit */}
              <div>
                <label style={{ fontSize: '12px', display: 'block', marginBottom: '2px' }}>Start</label>
                <input
                  type="time"
                  value={shift.startTime}
                  onChange={(e) => onUpdateShift(shift.id, { startTime: e.target.value })}
                  style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }}
                />
              </div>

              {/* Endzeit */}
              <div>
                <label style={{ fontSize: '12px', display: 'block', marginBottom: '2px' }}>Ende</label>
                <input
                  type="time"
                  value={shift.endTime}
                  onChange={(e) => onUpdateShift(shift.id, { endTime: e.target.value })}
                  style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }}
                />
              </div>

              {/* Benötigte Mitarbeiter */}
              <div>
                <label style={{ fontSize: '12px', display: 'block', marginBottom: '2px' }}>Mitarbeiter</label>
                <input
                  type="number"
                  min="1"
                  value={shift.requiredEmployees}
                  onChange={(e) => onUpdateShift(shift.id, { requiredEmployees: parseInt(e.target.value) || 1 })}
                  style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }}
                />
              </div>

              {/* Löschen Button */}
              <div>
                <button
                  onClick={() => onRemoveShift(shift.id)}
                  style={{ padding: '8px 12px', backgroundColor: '#dc3545', color: 'white', border: 'none', borderRadius: '4px' }}
                  title="Schicht löschen"
                >
                  ×
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ShiftDayEditor;