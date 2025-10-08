// frontend/src/pages/Employees/components/AvailabilityManager.tsx
import React, { useState, useEffect } from 'react';
import { Employee, Availability } from '../../../types/employee';
import { employeeService } from '../../../services/employeeService';

interface AvailabilityManagerProps {
  employee: Employee;
  onSave: () => void;
  onCancel: () => void;
}

const AvailabilityManager: React.FC<AvailabilityManagerProps> = ({
  employee,
  onSave,
  onCancel
}) => {
  const [availabilities, setAvailabilities] = useState<Availability[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const daysOfWeek = [
    { id: 1, name: 'Montag' },
    { id: 2, name: 'Dienstag' },
    { id: 3, name: 'Mittwoch' },
    { id: 4, name: 'Donnerstag' },
    { id: 5, name: 'Freitag' },
    { id: 6, name: 'Samstag' },
    { id: 0, name: 'Sonntag' }
  ];

  const defaultTimeSlots = [
    { name: 'Vormittag', start: '08:00', end: '12:00' },
    { name: 'Nachmittag', start: '12:00', end: '16:00' },
    { name: 'Abend', start: '16:00', end: '20:00' }
  ];

  useEffect(() => {
    loadAvailabilities();
  }, [employee.id]);

  const loadAvailabilities = async () => {
    try {
      setLoading(true);
      const data = await employeeService.getAvailabilities(employee.id);
      setAvailabilities(data);
    } catch (err: any) {
      // Falls keine Verfügbarkeiten existieren, erstelle Standard-Einträge
      const defaultAvailabilities = daysOfWeek.flatMap(day =>
        defaultTimeSlots.map(slot => ({
          id: `temp-${day.id}-${slot.name}`,
          employeeId: employee.id,
          dayOfWeek: day.id,
          startTime: slot.start,
          endTime: slot.end,
          isAvailable: false
        }))
      );
      setAvailabilities(defaultAvailabilities);
    } finally {
      setLoading(false);
    }
  };

  const handleAvailabilityChange = (id: string, isAvailable: boolean) => {
    setAvailabilities(prev =>
      prev.map(avail =>
        avail.id === id ? { ...avail, isAvailable } : avail
      )
    );
  };

  const handleTimeChange = (id: string, field: 'startTime' | 'endTime', value: string) => {
    setAvailabilities(prev =>
      prev.map(avail =>
        avail.id === id ? { ...avail, [field]: value } : avail
      )
    );
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError('');
      
      await employeeService.updateAvailabilities(employee.id, availabilities);
      onSave();
    } catch (err: any) {
      setError(err.message || 'Fehler beim Speichern der Verfügbarkeiten');
    } finally {
      setSaving(false);
    }
  };

  const getAvailabilitiesForDay = (dayId: number) => {
    return availabilities.filter(avail => avail.dayOfWeek === dayId);
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '40px' }}>
        <div>⏳ Lade Verfügbarkeiten...</div>
      </div>
    );
  }

  return (
    <div style={{
      maxWidth: '800px',
      margin: '0 auto',
      backgroundColor: 'white',
      padding: '30px',
      borderRadius: '8px',
      border: '1px solid #e0e0e0',
      boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
    }}>
      <h2 style={{ 
        margin: '0 0 25px 0', 
        color: '#2c3e50',
        borderBottom: '2px solid #f0f0f0',
        paddingBottom: '15px'
      }}>
        📅 Verfügbarkeit verwalten
      </h2>

      <div style={{ marginBottom: '20px' }}>
        <h3 style={{ margin: '0 0 10px 0', color: '#34495e' }}>
          {employee.name}
        </h3>
        <p style={{ margin: 0, color: '#7f8c8d' }}>
          Legen Sie fest, an welchen Tagen und Zeiten {employee.name} verfügbar ist.
        </p>
      </div>

      {error && (
        <div style={{
          backgroundColor: '#fee',
          border: '1px solid #f5c6cb',
          color: '#721c24',
          padding: '12px',
          borderRadius: '6px',
          marginBottom: '20px'
        }}>
          <strong>Fehler:</strong> {error}
        </div>
      )}

      {/* Verfügbarkeiten Tabelle */}
      <div style={{
        border: '1px solid #e0e0e0',
        borderRadius: '8px',
        overflow: 'hidden',
        marginBottom: '30px'
      }}>
        {daysOfWeek.map((day, dayIndex) => {
          const dayAvailabilities = getAvailabilitiesForDay(day.id);
          const isLastDay = dayIndex === daysOfWeek.length - 1;
          
          return (
            <div key={day.id} style={{
              borderBottom: isLastDay ? 'none' : '1px solid #f0f0f0'
            }}>
              {/* Tag Header */}
              <div style={{
                backgroundColor: '#f8f9fa',
                padding: '15px 20px',
                fontWeight: 'bold',
                color: '#2c3e50',
                borderBottom: '1px solid #e0e0e0'
              }}>
                {day.name}
              </div>

              {/* Zeit-Slots */}
              <div style={{ padding: '15px 20px' }}>
                {dayAvailabilities.map((availability, availabilityIndex) => {
                  const isLastAvailability = availabilityIndex === dayAvailabilities.length - 1;
                  
                  return (
                    <div
                      key={availability.id}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr auto auto auto',
                        gap: '15px',
                        alignItems: 'center',
                        padding: '10px 0',
                        borderBottom: isLastAvailability ? 'none' : '1px solid #f8f9fa'
                      }}
                    >
                      {/* Verfügbarkeit Toggle */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <input
                          type="checkbox"
                          id={`avail-${availability.id}`}
                          checked={availability.isAvailable}
                          onChange={(e) => handleAvailabilityChange(availability.id, e.target.checked)}
                          style={{ width: '18px', height: '18px' }}
                        />
                        <label 
                          htmlFor={`avail-${availability.id}`}
                          style={{ 
                            fontWeight: 'bold',
                            color: availability.isAvailable ? '#27ae60' : '#95a5a6'
                          }}
                        >
                          {availability.isAvailable ? 'Verfügbar' : 'Nicht verfügbar'}
                        </label>
                      </div>

                      {/* Startzeit */}
                      <div>
                        <label style={{ fontSize: '12px', color: '#7f8c8d', display: 'block', marginBottom: '4px' }}>
                          Von
                        </label>
                        <input
                          type="time"
                          value={availability.startTime}
                          onChange={(e) => handleTimeChange(availability.id, 'startTime', e.target.value)}
                          disabled={!availability.isAvailable}
                          style={{
                            padding: '6px 8px',
                            border: `1px solid ${availability.isAvailable ? '#ddd' : '#f0f0f0'}`,
                            borderRadius: '4px',
                            backgroundColor: availability.isAvailable ? 'white' : '#f8f9fa',
                            color: availability.isAvailable ? '#333' : '#999'
                          }}
                        />
                      </div>

                      {/* Endzeit */}
                      <div>
                        <label style={{ fontSize: '12px', color: '#7f8c8d', display: 'block', marginBottom: '4px' }}>
                          Bis
                        </label>
                        <input
                          type="time"
                          value={availability.endTime}
                          onChange={(e) => handleTimeChange(availability.id, 'endTime', e.target.value)}
                          disabled={!availability.isAvailable}
                          style={{
                            padding: '6px 8px',
                            border: `1px solid ${availability.isAvailable ? '#ddd' : '#f0f0f0'}`,
                            borderRadius: '4px',
                            backgroundColor: availability.isAvailable ? 'white' : '#f8f9fa',
                            color: availability.isAvailable ? '#333' : '#999'
                          }}
                        />
                      </div>

                      {/* Status Badge */}
                      <div>
                        <span
                          style={{
                            backgroundColor: availability.isAvailable ? '#d5f4e6' : '#fadbd8',
                            color: availability.isAvailable ? '#27ae60' : '#e74c3c',
                            padding: '4px 8px',
                            borderRadius: '12px',
                            fontSize: '12px',
                            fontWeight: 'bold'
                          }}
                        >
                          {availability.isAvailable ? 'Aktiv' : 'Inaktiv'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Info Text */}
      <div style={{
        backgroundColor: '#e8f4fd',
        border: '1px solid #b6d7e8',
        borderRadius: '6px',
        padding: '15px',
        marginBottom: '20px'
      }}>
        <h4 style={{ margin: '0 0 8px 0', color: '#2c3e50' }}>💡 Information</h4>
        <p style={{ margin: 0, color: '#546e7a', fontSize: '14px' }}>
          Verfügbarkeiten bestimmen, wann dieser Mitarbeiter für Schichten eingeplant werden kann.
          Nur als "verfügbar" markierte Zeitfenster werden bei der automatischen Schichtplanung berücksichtigt.
        </p>
      </div>

      {/* Buttons */}
      <div style={{ 
        display: 'flex', 
        gap: '15px', 
        justifyContent: 'flex-end'
      }}>
        <button
          onClick={onCancel}
          disabled={saving}
          style={{
            padding: '12px 24px',
            backgroundColor: '#95a5a6',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: saving ? 'not-allowed' : 'pointer',
            opacity: saving ? 0.6 : 1
          }}
        >
          Abbrechen
        </button>
        
        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            padding: '12px 24px',
            backgroundColor: saving ? '#bdc3c7' : '#3498db',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: saving ? 'not-allowed' : 'pointer',
            fontWeight: 'bold'
          }}
        >
          {saving ? '⏳ Wird gespeichert...' : 'Verfügbarkeiten speichern'}
        </button>
      </div>
    </div>
  );
};

export default AvailabilityManager;