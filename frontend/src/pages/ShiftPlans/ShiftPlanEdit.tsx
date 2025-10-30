// frontend/src/pages/ShiftPlans/ShiftPlanEdit.tsx
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { shiftPlanService } from '../../services/shiftPlanService';
import { ShiftPlan, Shift, ScheduledShift } from '../../models/ShiftPlan';
import { useNotification } from '../../contexts/NotificationContext';
import { useBackendValidation } from '../../hooks/useBackendValidation';

const ShiftPlanEdit: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { showNotification, confirmDialog } = useNotification();
  const { executeWithValidation, isSubmitting } = useBackendValidation();
  
  const [shiftPlan, setShiftPlan] = useState<ShiftPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingShift, setEditingShift] = useState<Shift | null>(null);
  const [newShift, setNewShift] = useState<Partial<Shift>>({
    timeSlotId: '',
    dayOfWeek: 1,
    requiredEmployees: 1
  });

  useEffect(() => {
    loadShiftPlan();
  }, [id]);

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

  const handleUpdateShift = async (shift: Shift) => {
    if (!shiftPlan || !id) return;
    
    await executeWithValidation(async () => {
      // Update logic here - will be implemented when backend API is available
      // For now, just simulate success
      console.log('Updating shift:', shift);
      
      loadShiftPlan();
      setEditingShift(null);
      
      showNotification({
        type: 'success',
        title: 'Erfolg',
        message: 'Schicht wurde erfolgreich aktualisiert.'
      });
    });
  };

  const handleAddShift = async () => {
    if (!shiftPlan || !id) return;
    
    // Basic frontend validation only
    if (!newShift.timeSlotId) {
      showNotification({
        type: 'error',
        title: 'Fehlende Angaben',
        message: 'Bitte wählen Sie einen Zeit-Slot aus.'
      });
      return;
    }
    
    if (!newShift.requiredEmployees || newShift.requiredEmployees < 1) {
      showNotification({
        type: 'error',
        title: 'Fehlende Angaben',
        message: 'Bitte geben Sie die Anzahl der benötigten Mitarbeiter an.'
      });
      return;
    }

    await executeWithValidation(async () => {
      // Add shift logic here - will be implemented when backend API is available
      // For now, just simulate success
      console.log('Adding shift:', newShift);
      
      showNotification({
        type: 'success',
        title: 'Erfolg',
        message: 'Neue Schicht wurde hinzugefügt.'
      });
      
      setNewShift({
        timeSlotId: '',
        dayOfWeek: 1,
        requiredEmployees: 1
      });
      loadShiftPlan();
    });
  };

  const handleDeleteShift = async (shiftId: string) => {
    const confirmed = await confirmDialog({
      title: 'Schicht löschen',
      message: 'Möchten Sie diese Schicht wirklich löschen?',
      confirmText: 'Löschen',
      cancelText: 'Abbrechen',
      type: 'warning'
    });

    if (!confirmed) return;

    await executeWithValidation(async () => {
      // Delete logic here - will be implemented when backend API is available
      // For now, just simulate success
      console.log('Deleting shift:', shiftId);
      
      loadShiftPlan();
      
      showNotification({
        type: 'success',
        title: 'Erfolg',
        message: 'Schicht wurde erfolgreich gelöscht.'
      });
    });
  };

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
      
      loadShiftPlan();
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

  // Group shifts by dayOfWeek
  const shiftsByDay = shiftPlan.shifts.reduce((acc, shift) => {
    if (!acc[shift.dayOfWeek]) {
      acc[shift.dayOfWeek] = [];
    }
    acc[shift.dayOfWeek].push(shift);
    return acc;
  }, {} as Record<number, typeof shiftPlan.shifts>);

  const daysOfWeek = [
    { id: 1, name: 'Montag' },
    { id: 2, name: 'Dienstag' },
    { id: 3, name: 'Mittwoch' },
    { id: 4, name: 'Donnerstag' },
    { id: 5, name: 'Freitag' },
    { id: 6, name: 'Samstag' },
    { id: 7, name: 'Sonntag' }
  ];

  return (
    <div style={{ padding: '20px' }}>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '30px' 
      }}>
        <h1>{shiftPlan.name} bearbeiten</h1>
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

      {/* Add new shift form */}
      <div style={{
        backgroundColor: 'white',
        borderRadius: '8px',
        padding: '20px',
        marginBottom: '20px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
      }}>
        <h3>Neue Schicht hinzufügen</h3>
        <div style={{ display: 'grid', gap: '15px', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
          <div>
            <label>Wochentag</label>
            <select
              value={newShift.dayOfWeek}
              onChange={(e) => setNewShift({ ...newShift, dayOfWeek: parseInt(e.target.value) })}
              style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
              disabled={isSubmitting}
            >
              {daysOfWeek.map(day => (
                <option key={day.id} value={day.id}>{day.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label>Zeit-Slot</label>
            <select
              value={newShift.timeSlotId}
              onChange={(e) => setNewShift({ ...newShift, timeSlotId: e.target.value })}
              style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
              disabled={isSubmitting}
            >
              <option value="">Bitte auswählen...</option>
              {shiftPlan.timeSlots.map(slot => (
                <option key={slot.id} value={slot.id}>
                  {slot.name} ({slot.startTime}-{slot.endTime})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label>Benötigte Mitarbeiter</label>
            <input
              type="number"
              min="1"
              value={newShift.requiredEmployees}
              onChange={(e) => setNewShift({ ...newShift, requiredEmployees: parseInt(e.target.value) || 1 })}
              style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
              disabled={isSubmitting}
            />
          </div>
        </div>
        <button
          onClick={handleAddShift}
          disabled={isSubmitting || !newShift.timeSlotId || !newShift.requiredEmployees}
          style={{
            marginTop: '15px',
            padding: '8px 16px',
            backgroundColor: isSubmitting ? '#bdc3c7' : '#3498db',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: isSubmitting ? 'not-allowed' : 'pointer',
            opacity: (!newShift.timeSlotId || !newShift.requiredEmployees) ? 0.6 : 1
          }}
        >
          {isSubmitting ? 'Wird hinzugefügt...' : 'Schicht hinzufügen'}
        </button>
      </div>

      {/* Existing shifts */}
      <div style={{ display: 'grid', gap: '20px' }}>
        {daysOfWeek.map(day => {
          const shifts = shiftsByDay[day.id] || [];
          if (shifts.length === 0) return null;
          
          return (
            <div key={day.id} style={{
              backgroundColor: 'white',
              borderRadius: '8px',
              padding: '20px',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
            }}>
              <h3 style={{ marginTop: 0 }}>{day.name}</h3>
              <div style={{ display: 'grid', gap: '15px' }}>
                {shifts.map(shift => {
                  const timeSlot = shiftPlan.timeSlots.find(ts => ts.id === shift.timeSlotId);
                  return (
                    <div key={shift.id} style={{
                      backgroundColor: '#f8f9fa',
                      padding: '15px',
                      borderRadius: '6px',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                    }}>
                      {editingShift?.id === shift.id ? (
                        <div style={{ display: 'grid', gap: '10px', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
                          <div>
                            <label>Zeit-Slot</label>
                            <select
                              value={editingShift.timeSlotId}
                              onChange={(e) => setEditingShift({ ...editingShift, timeSlotId: e.target.value })}
                              style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
                              disabled={isSubmitting}
                            >
                              {shiftPlan.timeSlots.map(slot => (
                                <option key={slot.id} value={slot.id}>
                                  {slot.name} ({slot.startTime}-{slot.endTime})
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label>Benötigte Mitarbeiter</label>
                            <input
                              type="number"
                              min="1"
                              value={editingShift.requiredEmployees}
                              onChange={(e) => setEditingShift({ ...editingShift, requiredEmployees: parseInt(e.target.value) || 1 })}
                              style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
                              disabled={isSubmitting}
                            />
                          </div>
                          <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end' }}>
                            <button
                              onClick={() => handleUpdateShift(editingShift)}
                              disabled={isSubmitting}
                              style={{
                                padding: '8px 16px',
                                backgroundColor: isSubmitting ? '#bdc3c7' : '#2ecc71',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: isSubmitting ? 'not-allowed' : 'pointer'
                              }}
                            >
                              {isSubmitting ? 'Speichern...' : 'Speichern'}
                            </button>
                            <button
                              onClick={() => setEditingShift(null)}
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
                              Abbrechen
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>
                            {timeSlot?.name} ({timeSlot?.startTime?.substring(0, 5)} - {timeSlot?.endTime?.substring(0, 5)})
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ fontSize: '14px', color: '#666' }}>
                              <span>Benötigte Mitarbeiter: {shift.requiredEmployees}</span>
                            </div>
                            <div>
                              <button
                                onClick={() => setEditingShift(shift)}
                                disabled={isSubmitting}
                                style={{
                                  padding: '6px 12px',
                                  backgroundColor: isSubmitting ? '#bdc3c7' : '#f1c40f',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '4px',
                                  cursor: isSubmitting ? 'not-allowed' : 'pointer',
                                  marginRight: '8px',
                                  opacity: isSubmitting ? 0.6 : 1
                                }}
                              >
                                Bearbeiten
                              </button>
                              <button
                                onClick={() => handleDeleteShift(shift.id)}
                                disabled={isSubmitting}
                                style={{
                                  padding: '6px 12px',
                                  backgroundColor: isSubmitting ? '#bdc3c7' : '#e74c3c',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '4px',
                                  cursor: isSubmitting ? 'not-allowed' : 'pointer',
                                  opacity: isSubmitting ? 0.6 : 1
                                }}
                              >
                                Löschen
                              </button>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ShiftPlanEdit;