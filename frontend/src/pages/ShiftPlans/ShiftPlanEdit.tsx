// frontend/src/pages/ShiftPlans/ShiftPlanEdit.tsx
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { shiftPlanService } from '../../services/shiftPlanService';
import { ShiftPlan, Shift } from '../../../../backend/src/models/shiftPlan';
import { useNotification } from '../../contexts/NotificationContext';
import { getTimeSlotById } from '../../models/helpers/shiftPlanHelpers';

const ShiftPlanEdit: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { showNotification } = useNotification();
  const [shiftPlan, setShiftPlan] = useState<ShiftPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingShift, setEditingShift] = useState<Shift | null>(null);
  const [newShift, setNewShift] = useState<Partial<ScheduledShift>>({
    date: '',
    timeSlotId: '',
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
    
    if (!getTimeSlotById(shiftPlan, newShift.timeSlotId?) || !newShift.name || !newShift.startTime || !newShift.endTime || !newShift.requiredEmployees) {
      showNotification({
        type: 'error',
        title: 'Fehler',
        message: 'Bitte füllen Sie alle Pflichtfelder aus.'
      });
      return;
    } 
    
    try {
      showNotification({
        type: 'success',
        title: 'Erfolg',
        message: 'Neue Schicht wurde hinzugefügt.'
      });
      setNewShift({
        date: '',
        name: '',
        startTime: '',
        endTime: '',
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

  // Group shifts by date
  const shiftsByDate = shiftPlan.shifts.reduce((acc, shift) => {
    if (!acc[shift.date]) {
      acc[shift.date] = [];
    }
    acc[shift.date].push(shift);
    return acc;
  }, {} as Record<string, typeof shiftPlan.shifts>);

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
            <label>Datum</label>
            <input
              type="date"
              value={newShift.date}
              onChange={(e) => setNewShift({ ...newShift, date: e.target.value })}
              style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
            />
          </div>
          <div>
            <label>Name</label>
            <input
              type="text"
              value={newShift.name}
              onChange={(e) => setNewShift({ ...newShift, name: e.target.value })}
              style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
            />
          </div>
          <div>
            <label>Startzeit</label>
            <input
              type="time"
              value={newShift.startTime}
              onChange={(e) => setNewShift({ ...newShift, startTime: e.target.value })}
              style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
            />
          </div>
          <div>
            <label>Endzeit</label>
            <input
              type="time"
              value={newShift.endTime}
              onChange={(e) => setNewShift({ ...newShift, endTime: e.target.value })}
              style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
            />
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
          disabled={!newShift.date || !newShift.name || !newShift.startTime || !newShift.endTime}
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
        {Object.entries(shiftsByDate).map(([date, shifts]) => (
          <div key={date} style={{
            backgroundColor: 'white',
            borderRadius: '8px',
            padding: '20px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
          }}>
            <h3 style={{ marginTop: 0 }}>{new Date(date).toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })}</h3>
            <div style={{ display: 'grid', gap: '15px' }}>
              {shifts.map(shift => (
                <div key={shift.id} style={{
                  backgroundColor: '#f8f9fa',
                  padding: '15px',
                  borderRadius: '6px',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                }}>
                  {editingShift?.id === shift.id ? (
                    <div style={{ display: 'grid', gap: '10px', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
                      <div>
                        <label>Name</label>
                        <input
                          type="text"
                          value={editingShift.name}
                          onChange={(e) => setEditingShift({ ...editingShift, name: e.target.value })}
                          style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
                        />
                      </div>
                      <div>
                        <label>Startzeit</label>
                        <input
                          type="time"
                          value={editingShift.startTime}
                          onChange={(e) => setEditingShift({ ...editingShift, startTime: e.target.value })}
                          style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
                        />
                      </div>
                      <div>
                        <label>Endzeit</label>
                        <input
                          type="time"
                          value={editingShift.endTime}
                          onChange={(e) => setEditingShift({ ...editingShift, endTime: e.target.value })}
                          style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
                        />
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
                        {shift.name}
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ fontSize: '14px', color: '#666' }}>
                          <span>Zeit: {shift.startTime.substring(0, 5)} - {shift.endTime.substring(0, 5)}</span>
                          <span style={{ margin: '0 15px' }}>|</span>
                          <span>Benötigte Mitarbeiter: {shift.requiredEmployees}</span>
                          <span style={{ margin: '0 15px' }}>|</span>
                          <span>Zugewiesen: {shift.assignedEmployees.length}/{shift.requiredEmployees}</span>
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
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ShiftPlanEdit;