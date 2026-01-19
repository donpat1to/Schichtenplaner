// frontend/src/pages/ShiftPlans/ShiftPlanEdit.tsx
import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { shiftPlanService } from '../../services/shiftPlanService';
import { ShiftPlan, Shift, TimeSlot } from '../../models/ShiftPlan';
import { useNotification } from '../../contexts/NotificationContext';
import { useBackendValidation } from '../../hooks/useBackendValidation';
import { formatTime } from '../../utils/foramatters';
import {
  ICONS,
  smallDeleteButton,
  addTextButton,
  cancelTextButton,
  addOutlineButton,
  BUTTON_COLORS,
} from '../../utils/buttonStyles';
import ShiftCell from './components/ShiftCell';
import TimeSlotEditor from './components/TimeSlotEditor';
import AddDayButton from './components/AddDayButton';

const DAYS_OF_WEEK = [
  { id: 1, name: 'Montag', shortName: 'Mo' },
  { id: 2, name: 'Dienstag', shortName: 'Di' },
  { id: 3, name: 'Mittwoch', shortName: 'Mi' },
  { id: 4, name: 'Donnerstag', shortName: 'Do' },
  { id: 5, name: 'Freitag', shortName: 'Fr' },
  { id: 6, name: 'Samstag', shortName: 'Sa' },
  { id: 7, name: 'Sonntag', shortName: 'So' },
];

const ShiftPlanEdit: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { showNotification, confirmDialog } = useNotification();
  const { executeWithValidation, isSubmitting } = useBackendValidation();

  const [shiftPlan, setShiftPlan] = useState<ShiftPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeDays, setActiveDays] = useState<number[]>([]);

  // New time slot form state
  const [showAddTimeSlot, setShowAddTimeSlot] = useState(false);
  const [newTimeSlot, setNewTimeSlot] = useState({
    name: '',
    startTime: '08:00',
    endTime: '12:00',
    description: '',
  });

  useEffect(() => {
    loadShiftPlan();
  }, [id]);

  useEffect(() => {
    if (shiftPlan) {
      // Determine active days from existing shifts
      const daysWithShifts = new Set(shiftPlan.shifts.map(s => s.dayOfWeek));
      setActiveDays(Array.from(daysWithShifts).sort((a, b) => a - b));
    }
  }, [shiftPlan]);

  const loadShiftPlan = async () => {
    if (!id) return;

    await executeWithValidation(async () => {
      try {
        const plan = await shiftPlanService.getShiftPlan(id);
        setShiftPlan(plan);
      } catch (error) {
        console.error('Error loading shift plan:', error);
        navigate('/shift-plans');
      } finally {
        setLoading(false);
      }
    });
  };

  // Get shift for a specific cell
  const getShift = (timeSlotId: string, dayOfWeek: number): Shift | null => {
    if (!shiftPlan) return null;
    return shiftPlan.shifts.find(
      s => s.timeSlotId === timeSlotId && s.dayOfWeek === dayOfWeek
    ) || null;
  };

  // Count shifts for a time slot
  const getShiftsCountForSlot = (slotId: string): number => {
    if (!shiftPlan) return 0;
    return shiftPlan.shifts.filter(s => s.timeSlotId === slotId).length;
  };

  // Sort time slots by start time (early to late)
  const sortedTimeSlots = useMemo(() => {
    if (!shiftPlan) return [];

    const timeToMinutes = (timeStr: string): number => {
      if (!timeStr) return 0;
      const [hours, minutes] = timeStr.split(':').map(Number);
      return hours * 60 + minutes;
    };

    return [...shiftPlan.timeSlots].sort((a, b) => {
      const minutesA = timeToMinutes(a.startTime);
      const minutesB = timeToMinutes(b.startTime);
      return minutesA - minutesB;
    });
  }, [shiftPlan]);

  // Add a new day column
  const handleAddDay = (dayOfWeek: number) => {
    if (!activeDays.includes(dayOfWeek)) {
      setActiveDays([...activeDays, dayOfWeek].sort((a, b) => a - b));
    }
  };

  // Remove a day column (delete all shifts for that day)
  const handleRemoveDay = async (dayOfWeek: number) => {
    if (!shiftPlan || !id) return;

    const shiftsForDay = shiftPlan.shifts.filter(s => s.dayOfWeek === dayOfWeek);

    if (shiftsForDay.length > 0) {
      const confirmed = await confirmDialog({
        title: 'Tag entfernen',
        message: `Dieser Tag enthält ${shiftsForDay.length} Schicht(en). Alle Schichten für diesen Tag werden gelöscht. Fortfahren?`,
        confirmText: 'Löschen',
        cancelText: 'Abbrechen',
        type: 'warning'
      });

      if (!confirmed) return;

      // Delete all shifts for this day
      await executeWithValidation(async () => {
        for (const shift of shiftsForDay) {
          await shiftPlanService.deleteShift(id, shift.id);
        }
        await loadShiftPlan();
        showNotification({
          type: 'success',
          title: 'Erfolg',
          message: `Alle Schichten für diesen Tag wurden gelöscht.`
        });
      });
    }

    setActiveDays(activeDays.filter(d => d !== dayOfWeek));
  };

  // Add a new time slot
  const handleAddTimeSlot = async () => {
    if (!id || !newTimeSlot.name || !newTimeSlot.startTime || !newTimeSlot.endTime) {
      showNotification({
        type: 'error',
        title: 'Fehlende Angaben',
        message: 'Bitte füllen Sie alle Pflichtfelder aus.'
      });
      return;
    }

    await executeWithValidation(async () => {
      await shiftPlanService.addTimeSlot(id, {
        name: newTimeSlot.name,
        startTime: newTimeSlot.startTime,
        endTime: newTimeSlot.endTime,
        description: newTimeSlot.description || undefined,
      });

      showNotification({
        type: 'success',
        title: 'Erfolg',
        message: 'Zeit-Slot wurde hinzugefügt.'
      });

      setNewTimeSlot({ name: '', startTime: '08:00', endTime: '12:00', description: '' });
      setShowAddTimeSlot(false);
      await loadShiftPlan();
    });
  };

  // Update a time slot
  const handleUpdateTimeSlot = async (
    slot: TimeSlot,
    name: string,
    startTime: string,
    endTime: string,
    description?: string
  ) => {
    if (!id) return;

    await executeWithValidation(async () => {
      await shiftPlanService.updateTimeSlot(id, slot.id, {
        name,
        startTime,
        endTime,
        description,
      });

      showNotification({
        type: 'success',
        title: 'Erfolg',
        message: 'Zeit-Slot wurde aktualisiert.'
      });

      await loadShiftPlan();
    });
  };

  // Delete a time slot
  const handleDeleteTimeSlot = async (slotId: string) => {
    if (!id || !shiftPlan) return;

    const shiftsCount = getShiftsCountForSlot(slotId);

    const confirmed = await confirmDialog({
      title: 'Zeit-Slot löschen',
      message: shiftsCount > 0
        ? `Dieser Zeit-Slot enthält ${shiftsCount} Schicht(en). Alle zugehörigen Schichten werden ebenfalls gelöscht. Fortfahren?`
        : 'Möchten Sie diesen Zeit-Slot wirklich löschen?',
      confirmText: 'Löschen',
      cancelText: 'Abbrechen',
      type: 'warning'
    });

    if (!confirmed) return;

    await executeWithValidation(async () => {
      await shiftPlanService.deleteTimeSlot(id, slotId);

      showNotification({
        type: 'success',
        title: 'Erfolg',
        message: 'Zeit-Slot wurde gelöscht.'
      });

      await loadShiftPlan();
    });
  };

  // Add a new shift
  const handleAddShift = async (
    dayOfWeek: number,
    timeSlotId: string,
    requiredEmployees: number,
    color: string
  ) => {
    if (!id) return;

    await executeWithValidation(async () => {
      await shiftPlanService.addShift(id, {
        dayOfWeek,
        timeSlotId,
        requiredEmployees,
        color,
      });

      showNotification({
        type: 'success',
        title: 'Erfolg',
        message: 'Schicht wurde hinzugefügt.'
      });

      await loadShiftPlan();
    });
  };

  // Update a shift
  const handleUpdateShift = async (
    shift: Shift,
    requiredEmployees: number,
    color: string
  ) => {
    if (!id) return;

    await executeWithValidation(async () => {
      await shiftPlanService.updateShift(id, shift.id, {
        requiredEmployees,
        color,
      });

      showNotification({
        type: 'success',
        title: 'Erfolg',
        message: 'Schicht wurde aktualisiert.'
      });

      await loadShiftPlan();
    });
  };

  // Delete a shift
  const handleDeleteShift = async (shiftId: string) => {
    if (!id) return;

    const confirmed = await confirmDialog({
      title: 'Schicht löschen',
      message: 'Möchten Sie diese Schicht wirklich löschen?',
      confirmText: 'Löschen',
      cancelText: 'Abbrechen',
      type: 'warning'
    });

    if (!confirmed) return;

    await executeWithValidation(async () => {
      await shiftPlanService.deleteShift(id, shiftId);

      showNotification({
        type: 'success',
        title: 'Erfolg',
        message: 'Schicht wurde gelöscht.'
      });

      await loadShiftPlan();
    });
  };

  // Publish the shift plan
  const handlePublish = async () => {
    if (!shiftPlan || !id) return;

    await executeWithValidation(async () => {
      await shiftPlanService.updateShiftPlan(id, {
        ...shiftPlan,
        status: 'published'
      });

      showNotification({
        type: 'success',
        title: 'Erfolg',
        message: 'Schichtplan wurde veröffentlicht.'
      });

      await loadShiftPlan();
    });
  };

  if (loading) {
    return (
      <div style={{
        textAlign: 'center',
        padding: '40px',
        fontSize: '18px',
        color: '#666'
      }}>
        Lade Schichtplan...
      </div>
    );
  }

  if (!shiftPlan) {
    return (
      <div style={{
        textAlign: 'center',
        padding: '40px',
        fontSize: '18px',
        color: '#e74c3c'
      }}>
        Schichtplan nicht gefunden
      </div>
    );
  }

  const hasTimeSlots = shiftPlan.timeSlots.length > 0;
  const hasActiveDays = activeDays.length > 0;

  return (
    <div style={{ padding: '20px' }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '30px'
      }}>
        <h1 style={{ margin: 0 }}>{shiftPlan.name} bearbeiten</h1>
        <div>
          {shiftPlan.status === 'draft' && (
            <button
              onClick={handlePublish}
              disabled={isSubmitting}
              style={{
                padding: '8px 16px',
                backgroundColor: '#2ecc71',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                marginRight: '10px',
                opacity: isSubmitting ? 0.6 : 1
              }}
            >
              {isSubmitting ? 'Wird veröffentlicht...' : 'Veröffentlichen'}
            </button>
          )}
          <button
            onClick={() => navigate('/shift-plans')}
            disabled={isSubmitting}
            style={{
              padding: '8px 16px',
              backgroundColor: '#95a5a6',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
              opacity: isSubmitting ? 0.6 : 1
            }}
          >
            Zurück
          </button>
        </div>
      </div>

      {/* Empty State */}
      {!hasTimeSlots && !hasActiveDays && (
        <div style={{
          backgroundColor: 'white',
          borderRadius: '8px',
          padding: '60px 40px',
          textAlign: 'center',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          marginBottom: '20px',
        }}>
          <div style={{ fontSize: '48px', marginBottom: '16px', opacity: 0.5 }}>
            📋
          </div>
          <h2 style={{ color: '#2c3e50', marginBottom: '8px' }}>
            Keine Schichten vorhanden
          </h2>
          <p style={{ color: '#666', marginBottom: '24px' }}>
            Fügen Sie zunächst einen Zeit-Slot hinzu und wählen Sie dann die Tage aus,
            an denen Schichten stattfinden sollen.
          </p>
          <button
            onClick={() => setShowAddTimeSlot(true)}
            style={{
              ...addTextButton(false),
              padding: '12px 24px',
              fontSize: '16px',
            }}
          >
            {ICONS.add} Zeit-Slot hinzufügen
          </button>
        </div>
      )}

      {/* Grid Editor */}
      {(hasTimeSlots || hasActiveDays) && (
        <div style={{
          marginBottom: '30px',
          border: '1px solid #e0e0e0',
          borderRadius: '8px',
          overflow: 'hidden'
        }}>
          {/* Header bar matching ShiftPlanView */}
          <div style={{
            backgroundColor: '#2c3e50',
            color: 'white',
            padding: '15px 20px',
            fontWeight: 'bold'
          }}>
            Schichtplan bearbeiten
            <div style={{ fontSize: '14px', fontWeight: 'normal', marginTop: '5px' }}>
              {sortedTimeSlots.length} Zeitslots • {activeDays.length} Tage
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{
              width: '100%',
              borderCollapse: 'collapse',
              backgroundColor: 'white'
            }}>
              <thead>
                <tr style={{ backgroundColor: '#f8f9fa' }}>
                  <th style={{
                    padding: '12px 16px',
                    textAlign: 'left',
                    border: '1px solid #dee2e6',
                    fontWeight: 'bold',
                    minWidth: '180px'
                  }}>
                    Schicht (Zeit)
                  </th>
                  {activeDays.map(dayId => {
                    const day = DAYS_OF_WEEK.find(d => d.id === dayId);
                    return (
                      <th key={dayId} style={{
                        padding: '12px 16px',
                        textAlign: 'center',
                        border: '1px solid #dee2e6',
                        fontWeight: 'bold',
                        minWidth: '120px'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                          <span>{day?.name}</span>
                          <button
                            onClick={() => handleRemoveDay(dayId)}
                            disabled={isSubmitting}
                            style={smallDeleteButton(isSubmitting)}
                            title="Tag entfernen"
                          >
                            {ICONS.delete}
                          </button>
                        </div>
                      </th>
                    );
                  })}
                  <th style={{
                    padding: '12px 16px',
                    textAlign: 'center',
                    border: '1px solid #dee2e6',
                    minWidth: '70px',
                    backgroundColor: '#f8f9fa',
                  }}>
                    <AddDayButton
                      activeDays={activeDays}
                      onAddDay={handleAddDay}
                      disabled={isSubmitting}
                    />
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedTimeSlots.map((slot, index) => (
                  <tr key={slot.id} style={{
                    backgroundColor: index % 2 === 0 ? 'white' : '#f8f9fa'
                  }}>
                    <td style={{
                      padding: '12px 16px',
                      border: '1px solid #dee2e6',
                      fontWeight: '500',
                      backgroundColor: '#f8f9fa',
                      position: 'sticky',
                      left: 0
                    }}>
                      <TimeSlotEditor
                        slot={slot}
                        onUpdate={handleUpdateTimeSlot}
                        onDelete={handleDeleteTimeSlot}
                        shiftsCount={getShiftsCountForSlot(slot.id)}
                        disabled={isSubmitting}
                      />
                    </td>
                    {activeDays.map(dayId => (
                      <ShiftCell
                        key={`${slot.id}-${dayId}`}
                        shift={getShift(slot.id, dayId)}
                        dayOfWeek={dayId}
                        timeSlotId={slot.id}
                        onAdd={handleAddShift}
                        onEdit={handleUpdateShift}
                        onDelete={handleDeleteShift}
                        disabled={isSubmitting}
                      />
                    ))}
                    <td style={{
                      border: '1px solid #dee2e6',
                      padding: '8px',
                      textAlign: 'center',
                    }}>
                      <button
                        onClick={() => handleDeleteTimeSlot(slot.id)}
                        disabled={isSubmitting}
                        style={smallDeleteButton(isSubmitting)}
                        title="Zeit-Slot löschen"
                      >
                        {ICONS.delete}
                      </button>
                    </td>
                  </tr>
                ))}

                {/* Add Time Slot Row */}
                <tr>
                  <td colSpan={activeDays.length + 2} style={{
                    padding: '16px',
                    borderTop: '2px solid #dee2e6',
                  }}>
                    {showAddTimeSlot ? (
                      <div style={{
                        display: 'flex',
                        gap: '12px',
                        alignItems: 'flex-end',
                        flexWrap: 'wrap',
                      }}>
                        <div>
                          <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px', color: '#666' }}>
                            Name *
                          </label>
                          <input
                            type="text"
                            value={newTimeSlot.name}
                            onChange={(e) => setNewTimeSlot({ ...newTimeSlot, name: e.target.value })}
                            placeholder="z.B. Vormittag"
                            style={{
                              padding: '8px',
                              borderRadius: '4px',
                              border: '1px solid #ddd',
                              width: '150px',
                            }}
                            disabled={isSubmitting}
                          />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px', color: '#666' }}>
                            Startzeit *
                          </label>
                          <input
                            type="time"
                            value={newTimeSlot.startTime}
                            onChange={(e) => setNewTimeSlot({ ...newTimeSlot, startTime: e.target.value })}
                            style={{
                              padding: '8px',
                              borderRadius: '4px',
                              border: '1px solid #ddd',
                            }}
                            disabled={isSubmitting}
                          />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px', color: '#666' }}>
                            Endzeit *
                          </label>
                          <input
                            type="time"
                            value={newTimeSlot.endTime}
                            onChange={(e) => setNewTimeSlot({ ...newTimeSlot, endTime: e.target.value })}
                            style={{
                              padding: '8px',
                              borderRadius: '4px',
                              border: '1px solid #ddd',
                            }}
                            disabled={isSubmitting}
                          />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px', color: '#666' }}>
                            Beschreibung
                          </label>
                          <input
                            type="text"
                            value={newTimeSlot.description}
                            onChange={(e) => setNewTimeSlot({ ...newTimeSlot, description: e.target.value })}
                            placeholder="Optional"
                            style={{
                              padding: '8px',
                              borderRadius: '4px',
                              border: '1px solid #ddd',
                              width: '150px',
                            }}
                            disabled={isSubmitting}
                          />
                        </div>
                        <button
                          onClick={handleAddTimeSlot}
                          disabled={isSubmitting || !newTimeSlot.name}
                          style={addTextButton(isSubmitting || !newTimeSlot.name)}
                        >
                          {ICONS.add} Hinzufügen
                        </button>
                        <button
                          onClick={() => {
                            setShowAddTimeSlot(false);
                            setNewTimeSlot({ name: '', startTime: '08:00', endTime: '12:00', description: '' });
                          }}
                          disabled={isSubmitting}
                          style={cancelTextButton(isSubmitting)}
                        >
                          Abbrechen
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setShowAddTimeSlot(true)}
                        disabled={isSubmitting}
                        style={addOutlineButton(isSubmitting)}
                        onMouseEnter={(e) => {
                          if (!isSubmitting) {
                            e.currentTarget.style.backgroundColor = '#f0fff4';
                          }
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = 'transparent';
                        }}
                      >
                        {ICONS.add} Neuer Zeit-Slot hinzufügen
                      </button>
                    )}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Legend */}
      <div style={{
        marginTop: '20px',
        padding: '16px',
        backgroundColor: 'white',
        borderRadius: '8px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
      }}>
        <h4 style={{ margin: '0 0 12px 0', color: '#2c3e50' }}>Legende</h4>
        <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', fontSize: '13px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{
              width: '24px',
              height: '24px',
              backgroundColor: '#d5f4e6',
              border: `2px solid ${BUTTON_COLORS.add}`,
              borderRadius: '4px',
            }} />
            <span>Aktive Schicht (klicken zum Bearbeiten)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{
              width: '24px',
              height: '24px',
              backgroundColor: '#f8f9fa',
              border: '2px dashed #dee2e6',
              borderRadius: '4px',
            }} />
            <span>Leere Zelle (klicken zum Hinzufügen)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ color: BUTTON_COLORS.edit, fontSize: '16px' }}>{ICONS.edit}</span>
            <span>Zeit-Slot bearbeiten</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ color: BUTTON_COLORS.delete, fontSize: '16px' }}>{ICONS.delete}</span>
            <span>Löschen</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ShiftPlanEdit;
