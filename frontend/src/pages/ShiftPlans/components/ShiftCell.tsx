import React, { useState, useEffect } from 'react';
import { Shift } from '../../../models/ShiftPlan';
import {
  ICONS,
  addTextButton,
  deleteTextButton,
  cancelTextButton,
  BUTTON_COLORS,
} from '../../../utils/buttonStyles';
import Modal from '../../../components/Modal/Modal';

interface ShiftCellProps {
  shift: Shift | null;
  dayOfWeek: number;
  timeSlotId: string;
  onAdd: (dayOfWeek: number, timeSlotId: string, requiredEmployees: number, color: string) => void;
  onEdit: (shift: Shift, requiredEmployees: number, color: string) => void;
  onDelete: (shiftId: string) => void;
  disabled?: boolean;
}

const COLORS = [
  '#3498db', // Blue (default)
  '#27ae60', // Green
  '#e74c3c', // Red
  '#f39c12', // Orange
  '#9b59b6', // Purple
  '#1abc9c', // Teal
  '#e91e63', // Pink
  '#795548', // Brown
];

const ShiftCell: React.FC<ShiftCellProps> = ({
  shift,
  dayOfWeek,
  timeSlotId,
  onAdd,
  onEdit,
  onDelete,
  disabled = false
}) => {
  const [showModal, setShowModal] = useState(false);
  const [requiredEmployees, setRequiredEmployees] = useState(shift?.requiredEmployees || 2);
  const [selectedColor, setSelectedColor] = useState(shift?.color || '#3498db');
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    if (shift) {
      setRequiredEmployees(shift.requiredEmployees);
      setSelectedColor(shift.color || '#3498db');
    } else {
      setRequiredEmployees(2);
      setSelectedColor('#3498db');
    }
  }, [shift]);

  const handleCellClick = () => {
    if (disabled) return;
    setShowModal(true);
  };

  const handleSave = () => {
    if (shift) {
      onEdit(shift, requiredEmployees, selectedColor);
    } else {
      onAdd(dayOfWeek, timeSlotId, requiredEmployees, selectedColor);
    }
    setShowModal(false);
  };

  const handleDelete = () => {
    if (shift) {
      onDelete(shift.id);
    }
    setShowModal(false);
  };

  const handleClose = () => {
    if (shift) {
      setRequiredEmployees(shift.requiredEmployees);
      setSelectedColor(shift.color || '#3498db');
    } else {
      setRequiredEmployees(2);
      setSelectedColor('#3498db');
    }
    setShowModal(false);
  };

  const cellStyle: React.CSSProperties = {
    padding: '8px',
    textAlign: 'center',
    cursor: disabled ? 'not-allowed' : 'pointer',
    minWidth: '80px',
    height: '60px',
    verticalAlign: 'middle',
    transition: 'all 0.2s ease',
    border: '1px solid #dee2e6',
    ...(shift ? {
      backgroundColor: shift.color ? `${shift.color}20` : '#d5f4e6',
      borderColor: shift.color || '#27ae60',
      borderWidth: '2px',
    } : {
      backgroundColor: isHovered ? '#f0fff4' : '#f8f9fa',
      borderStyle: 'dashed',
      borderColor: isHovered ? BUTTON_COLORS.add : '#dee2e6',
    }),
    opacity: disabled ? 0.6 : 1,
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px',
    borderRadius: '4px',
    border: '1px solid #ddd',
    fontSize: '14px',
    boxSizing: 'border-box',
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    marginBottom: '6px',
    fontWeight: 'bold',
    fontSize: '14px',
    color: '#2c3e50',
  };

  return (
    <>
      <td
        style={cellStyle}
        onClick={handleCellClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {shift ? (
          <div>
            <div style={{
              width: '28px',
              height: '28px',
              borderRadius: '50%',
              backgroundColor: shift.color || '#27ae60',
              margin: '0 auto 4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <span style={{ color: 'white', fontSize: '12px', fontWeight: 'bold' }}>
                {shift.requiredEmployees}
              </span>
            </div>
            <span style={{ fontSize: '11px', color: '#666' }}>
              Mitarbeiter
            </span>
          </div>
        ) : (
          <div style={{
            color: BUTTON_COLORS.add,
            fontSize: '24px',
            opacity: isHovered ? 1 : 0.4,
            transition: 'opacity 0.2s ease',
          }}>
            {ICONS.add}
          </div>
        )}
      </td>

      <Modal
        isOpen={showModal}
        onClose={handleClose}
        title={shift ? 'Schicht bearbeiten' : 'Schicht hinzufügen'}
        width="380px"
      >
        <div style={{ marginBottom: '16px' }}>
          <label style={labelStyle}>Benötigte Mitarbeiter *</label>
          <input
            type="number"
            min="1"
            max="99"
            value={requiredEmployees}
            onChange={(e) => setRequiredEmployees(parseInt(e.target.value) || 1)}
            style={inputStyle}
          />
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label style={labelStyle}>Farbe</label>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {COLORS.map((color) => (
              <button
                key={color}
                onClick={() => setSelectedColor(color)}
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '6px',
                  backgroundColor: color,
                  border: selectedColor === color ? '3px solid #2c3e50' : '2px solid transparent',
                  cursor: 'pointer',
                  transition: 'transform 0.1s ease',
                }}
                title={color}
              />
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <button
            onClick={handleSave}
            style={{ ...addTextButton(false), flex: 1 }}
          >
            {shift ? 'Speichern' : `${ICONS.add} Hinzufügen`}
          </button>
          {shift && (
            <button
              onClick={handleDelete}
              style={deleteTextButton(false)}
            >
              {ICONS.delete} Löschen
            </button>
          )}
          <button
            onClick={handleClose}
            style={cancelTextButton(false)}
          >
            Abbrechen
          </button>
        </div>
      </Modal>
    </>
  );
};

export default ShiftCell;
