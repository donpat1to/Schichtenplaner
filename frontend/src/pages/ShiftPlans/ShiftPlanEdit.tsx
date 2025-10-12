// frontend/src/pages/ShiftPlans/ShiftPlanEdit.tsx
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { shiftPlanService } from '../../services/shiftPlanService';
import { ShiftPlan, Shift, ScheduledShift } from '../../models/ShiftPlan';
import { useNotification } from '../../contexts/NotificationContext';

const ShiftPlanEdit: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { showNotification } = useNotification();
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
    try {
      const plan = await shiftPlanService.getShiftPlan(id);
      setShiftPlan(plan);
    } catch (error) {
      console.error('Error loading shift plan:', error);
      showNotification({
        type: 'error',
        title: 'Fehler',
        message: 'Der Schichtplan konnte nicht geladen werden.'
      });
      navigate('/shift-plans');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateShift = async (shift: Shift) => {
    if (!shiftPlan || !id) return;
    
    try {
      // Update logic here
      loadShiftPlan();
      setEditingShift(null);
    } catch (error) {
      console.error('Error updating shift:', error);
      showNotification({
        type: 'error',
        title: 'Fehler',
        message: 'Die Schicht konnte nicht aktualisiert werden.'
      });
    }
  };

  const handleAddShift = async () => {
    if (!shiftPlan || !id) return;
    
    if (!newShift.timeSlotId || !newShift.requiredEmployees) {
      showNotification({
        type: 'error',
        title: 'Fehler',
        message: 'Bitte füllen Sie alle Pflichtfelder aus.'
      });
      return;
    }
    
    try {
      // Add shift logic here
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
    } catch (error) {
      console.error('Error adding shift:', error);
      showNotification({
        type: 'error',
        title: 'Fehler',
        message: 'Die Schicht konnte nicht hinzugefügt werden.'
      });
    }
  };

  const handleDeleteShift = async (shiftId: string) => {
    if (!window.confirm('Möchten Sie diese Schicht wirklich löschen?')) {
      return;
    }

    try {
      // Delete logic here
      loadShiftPlan();
    } catch (error) {
      console.error('Error deleting shift:', error);
      showNotification({
        type: 'error',
        title: 'Fehler',
        message: 'Die Schicht konnte nicht gelöscht werden.'
      });
    }
  };

  const handlePublish = async () => {
    if (!shiftPlan || !id) return;

    try {
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
    } catch (error) {
      console.error('Error publishing shift plan:', error);
      showNotification({
        type: 'error',
        title: 'Fehler',
        message: 'Der Schichtplan konnte nicht veröffentlicht werden.'
      });
    }
  };

  if (loading) {
    return <div>Lade Schichtplan...</div>;
  }

  if (!shiftPlan) {
    return <div>Schichtplan nicht gefunden</div>;
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
              style={{
                padding: '8px 16px',
                backgroundColor: '#2ecc71',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                marginRight: '10px'
              }}
            >
              Veröffentlichen
            </button>
          )}
          <button
            onClick={() => navigate('/shift-plans')}
            style={{
              padding: '8px 16px',
              backgroundColor: '#95a5a6',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
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
              onChange={(e) => setNewShift({ ...newShift, requiredEmployees: parseInt(e.target.value) })}
              style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
            />
          </div>
        </div>
        <button
          onClick={handleAddShift}
          disabled={!newShift.timeSlotId || !newShift.requiredEmployees}
          style={{
            marginTop: '15px',
            padding: '8px 16px',
            backgroundColor: '#3498db',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Schicht hinzufügen
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
                              onChange={(e) => setEditingShift({ ...editingShift, requiredEmployees: parseInt(e.target.value) })}
                              style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
                            />
                          </div>
                          <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end' }}>
                            <button
                              onClick={() => handleUpdateShift(editingShift)}
                              style={{
                                padding: '8px 16px',
                                backgroundColor: '#2ecc71',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer'
                              }}
                            >
                              Speichern
                            </button>
                            <button
                              onClick={() => setEditingShift(null)}
                              style={{
                                padding: '8px 16px',
                                backgroundColor: '#95a5a6',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer'
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
                                style={{
                                  padding: '6px 12px',
                                  backgroundColor: '#f1c40f',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '4px',
                                  cursor: 'pointer',
                                  marginRight: '8px'
                                }}
                              >
                                Bearbeiten
                              </button>
                              <button
                                onClick={() => handleDeleteShift(shift.id)}
                                style={{
                                  padding: '6px 12px',
                                  backgroundColor: '#e74c3c',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '4px',
                                  cursor: 'pointer'
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