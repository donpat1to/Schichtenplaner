// frontend/src/pages/ShiftPlans/ShiftPlanEdit.tsx
import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { shiftPlanService } from '../../services/shiftPlanService';
import { ShiftPlan, Shift, TimeSlot } from '../../models/ShiftPlan';
import { useNotification } from '../../contexts/NotificationContext';
import { useBackendValidation } from '../../hooks/useBackendValidation';
import Timetable from '../../components/Timetable/Timetable'
import { formatTime } from '../../utils/formatters';
import {
  ICONS,
  smallDeleteButton,
  addTextButton,
  cancelTextButton,
  addOutlineButton,
  BUTTON_COLORS,
} from '../../utils/buttonStyles';

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
  const [showGridEditor, setShowGridEditor] = useState(false);

  // Shift plan basic info form state
  const [shiftPlanInfo, setShiftPlanInfo] = useState({
    name: '',
    description: '',
    startDate: '',
    endDate: '',
  });

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

      // Set shift plan basic info
      setShiftPlanInfo({
        name: shiftPlan.name || '',
        description: shiftPlan.description || '',
        startDate: shiftPlan.startDate || '',
        endDate: shiftPlan.endDate || '',
      });
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
        navigate('/plans');
      } finally {
        setLoading(false);
      }
    });
  };

  // Update shift plan basic information
  const handleUpdateShiftPlan = async () => {
    if (!id || !shiftPlanInfo.name.trim()) {
      showNotification({
        type: 'error',
        title: 'Fehlende Angaben',
        message: 'Bitte geben Sie einen Namen für den Schichtplan ein.'
      });
      return;
    }

    await executeWithValidation(async () => {
      await shiftPlanService.updateShiftPlan(id, {
        name: shiftPlanInfo.name,
        description: shiftPlanInfo.description || undefined,
        startDate: shiftPlanInfo.startDate || undefined,
        endDate: shiftPlanInfo.endDate || undefined,
      });

      showNotification({
        type: 'success',
        title: 'Erfolg',
        message: 'Schichtplan wurde aktualisiert.'
      });

      await loadShiftPlan();
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
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={() => setShowGridEditor(!showGridEditor)}
            style={{
              padding: '8px 16px',
              backgroundColor: showGridEditor ? '#3498db' : '#2ecc71',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
              opacity: isSubmitting ? 0.6 : 1
            }}
            disabled={isSubmitting}
          >
            {showGridEditor ? 'Tabellen-Editor ausblenden' : 'Tabellen-Editor anzeigen'}
          </button>
          <button
            onClick={() => navigate('/plans')}
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

      {/* Basic Information Form */}
      <div style={{
        backgroundColor: 'white',
        borderRadius: '8px',
        padding: '24px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        marginBottom: '20px'
      }}>
        <h2 style={{ marginTop: 0, marginBottom: '20px', color: '#2c3e50' }}>
          Grundinformationen
        </h2>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
              Name *
            </label>
            <input
              type="text"
              value={shiftPlanInfo.name}
              onChange={(e) => setShiftPlanInfo({ ...shiftPlanInfo, name: e.target.value })}
              style={{
                width: '100%',
                padding: '10px',
                borderRadius: '4px',
                border: '1px solid #ddd',
                fontSize: '14px'
              }}
              placeholder="Name des Schichtplans"
              disabled={isSubmitting}
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
              Beschreibung
            </label>
            <input
              type="text"
              value={shiftPlanInfo.description}
              onChange={(e) => setShiftPlanInfo({ ...shiftPlanInfo, description: e.target.value })}
              style={{
                width: '100%',
                padding: '10px',
                borderRadius: '4px',
                border: '1px solid #ddd',
                fontSize: '14px'
              }}
              placeholder="Beschreibung (optional)"
              disabled={isSubmitting}
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
              Startdatum
            </label>
            <input
              type="date"
              value={shiftPlanInfo.startDate}
              onChange={(e) => setShiftPlanInfo({ ...shiftPlanInfo, startDate: e.target.value })}
              style={{
                width: '100%',
                padding: '10px',
                borderRadius: '4px',
                border: '1px solid #ddd',
                fontSize: '14px'
              }}
              disabled={isSubmitting}
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
              Enddatum
            </label>
            <input
              type="date"
              value={shiftPlanInfo.endDate}
              onChange={(e) => setShiftPlanInfo({ ...shiftPlanInfo, endDate: e.target.value })}
              style={{
                width: '100%',
                padding: '10px',
                borderRadius: '4px',
                border: '1px solid #ddd',
                fontSize: '14px'
              }}
              disabled={isSubmitting}
            />
          </div>
        </div>

        <div style={{ marginTop: '20px' }}>
          <button
            onClick={handleUpdateShiftPlan}
            disabled={isSubmitting || !shiftPlanInfo.name.trim()}
            style={{
              padding: '10px 20px',
              backgroundColor: !shiftPlanInfo.name.trim() ? '#bdc3c7' : '#3498db',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: !shiftPlanInfo.name.trim() || isSubmitting ? 'not-allowed' : 'pointer',
              fontWeight: '500',
              fontSize: '14px'
            }}
          >
            {isSubmitting ? 'Speichern...' : 'Grundinformationen speichern'}
          </button>
        </div>
      </div>

      {/* Grid Editor Toggle and Content */}
      {showGridEditor && (
        <>
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
          {showGridEditor && (
            <Timetable
              mode="edit"
              shifts={shiftPlan?.shifts || []}
              timeSlots={sortedTimeSlots}
              days={DAYS_OF_WEEK}
              onAddDay={handleAddDay}
              onRemoveDay={handleRemoveDay}
              onAddTimeSlot={handleAddTimeSlot}
              onUpdateTimeSlot={handleUpdateTimeSlot}
              onDeleteTimeSlot={handleDeleteTimeSlot}
              onAddShift={handleAddShift}
              onUpdateShift={handleUpdateShift}
              onDeleteShift={handleDeleteShift}
              disabled={isSubmitting}
              headerTitle="Schichtplan bearbeiten"
              showLegend={true}
            />
          )}
        </>
      )}
    </div>
  );
};

export default ShiftPlanEdit;