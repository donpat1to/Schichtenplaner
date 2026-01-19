import React, { useState } from 'react';
import { ICONS, addIconButton, addTextButton, cancelTextButton } from '../../../utils/buttonStyles';
import Modal from '../../../components/Modal/Modal';

interface DayOption {
  id: number;
  name: string;
}

interface AddDayButtonProps {
  activeDays: number[];
  onAddDay: (dayOfWeek: number) => void;
  disabled?: boolean;
}

const ALL_DAYS: DayOption[] = [
  { id: 1, name: 'Montag' },
  { id: 2, name: 'Dienstag' },
  { id: 3, name: 'Mittwoch' },
  { id: 4, name: 'Donnerstag' },
  { id: 5, name: 'Freitag' },
  { id: 6, name: 'Samstag' },
  { id: 7, name: 'Sonntag' },
];

const AddDayButton: React.FC<AddDayButtonProps> = ({
  activeDays,
  onAddDay,
  disabled = false
}) => {
  const [showModal, setShowModal] = useState(false);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);

  const availableDays = ALL_DAYS.filter(day => !activeDays.includes(day.id));

  const handleAddDay = () => {
    if (selectedDay !== null) {
      onAddDay(selectedDay);
      setShowModal(false);
      setSelectedDay(null);
    }
  };

  const isDisabled = disabled || availableDays.length === 0;

  if (availableDays.length === 0) {
    return null;
  }

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        style={addIconButton(isDisabled)}
        disabled={isDisabled}
        title="Tag hinzufügen"
      >
        {ICONS.add}
      </button>

      <Modal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false);
          setSelectedDay(null);
        }}
        title="Tag hinzufügen"
        width="350px"
      >
        <div style={{ marginBottom: '16px' }}>
          <label style={{
            display: 'block',
            marginBottom: '8px',
            fontWeight: 'bold',
            fontSize: '14px',
            color: '#2c3e50'
          }}>
            Wählen Sie einen Tag:
          </label>
          <select
            value={selectedDay ?? ''}
            onChange={(e) => setSelectedDay(e.target.value ? Number(e.target.value) : null)}
            style={{
              width: '100%',
              padding: '10px',
              borderRadius: '4px',
              border: '1px solid #ddd',
              fontSize: '14px',
            }}
          >
            <option value="">-- Tag auswählen --</option>
            {availableDays.map(day => (
              <option key={day.id} value={day.id}>
                {day.name}
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <button
            onClick={handleAddDay}
            disabled={selectedDay === null}
            style={addTextButton(selectedDay === null)}
          >
            {ICONS.add} Hinzufügen
          </button>
          <button
            onClick={() => {
              setShowModal(false);
              setSelectedDay(null);
            }}
            style={cancelTextButton(false)}
          >
            Abbrechen
          </button>
        </div>
      </Modal>
    </>
  );
};

export default AddDayButton;
