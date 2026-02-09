// frontend/src/pages/Holidays/HolidaysAdmin.tsx
import React, { useState, useEffect } from 'react';
import { Holiday, CreateHolidayRequest, UpdateHolidayRequest } from '../../models/Holiday';
import { holidayService } from '../../services/holidayService';
import { useAuth } from '../../contexts/AuthContext';
import { useNotification } from '../../contexts/NotificationContext';

type ViewMode = 'list' | 'create' | 'edit';

const HolidaysAdmin: React.FC = () => {
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [selectedHoliday, setSelectedHoliday] = useState<Holiday | null>(null);
  const { hasRole } = useAuth();
  const { showNotification, confirmDialog } = useNotification();

  // Form state
  const [formData, setFormData] = useState<CreateHolidayRequest>({
    name: '',
    date: '',
    endDate: undefined,
    halfDay: undefined,
    isRecurring: false,
    description: ''
  });
  const [isMultiDay, setIsMultiDay] = useState(false);
  const [isHalfDay, setIsHalfDay] = useState(false);

  useEffect(() => {
    loadHolidays();
  }, []);

  const loadHolidays = async () => {
    try {
      setLoading(true);
      const data = await holidayService.getHolidays();
      setHolidays(data);
    } catch (err: any) {
      console.error('Error loading holidays:', err);
      showNotification({
        type: 'error',
        title: 'Fehler',
        message: 'Feiertage konnten nicht geladen werden: ' + err.message
      });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      date: '',
      endDate: undefined,
      halfDay: undefined,
      isRecurring: false,
      description: ''
    });
    setIsMultiDay(false);
    setIsHalfDay(false);
  };

  const handleCreate = () => {
    resetForm();
    setSelectedHoliday(null);
    setViewMode('create');
  };

  const handleEdit = (holiday: Holiday) => {
    setSelectedHoliday(holiday);
    setFormData({
      name: holiday.name,
      date: holiday.date,
      endDate: holiday.endDate,
      halfDay: holiday.halfDay,
      isRecurring: holiday.isRecurring,
      description: holiday.description || ''
    });
    setIsMultiDay(!!holiday.endDate);
    setIsHalfDay(!!holiday.halfDay);
    setViewMode('edit');
  };

  const handleBackToList = () => {
    setViewMode('list');
    setSelectedHoliday(null);
    resetForm();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const submitData: CreateHolidayRequest = {
        name: formData.name,
        date: formData.date,
        endDate: isMultiDay ? formData.endDate : undefined,
        halfDay: isHalfDay && !isMultiDay ? formData.halfDay : undefined,
        isRecurring: formData.isRecurring,
        description: formData.description || undefined
      };

      if (viewMode === 'create') {
        await holidayService.createHoliday(submitData);
        showNotification({
          type: 'success',
          title: 'Erfolg',
          message: 'Feiertag wurde erfolgreich erstellt'
        });
      } else if (viewMode === 'edit' && selectedHoliday) {
        const updateData: UpdateHolidayRequest = {
          ...submitData,
          endDate: isMultiDay ? submitData.endDate : null,
          halfDay: isHalfDay && !isMultiDay ? submitData.halfDay : null
        };
        await holidayService.updateHoliday(selectedHoliday.id, updateData);
        showNotification({
          type: 'success',
          title: 'Erfolg',
          message: 'Feiertag wurde erfolgreich aktualisiert'
        });
      }

      loadHolidays();
      handleBackToList();
    } catch (err: any) {
      showNotification({
        type: 'error',
        title: 'Fehler',
        message: err.message || 'Feiertag konnte nicht gespeichert werden'
      });
    }
  };

  const handleDelete = async (holiday: Holiday) => {
    const confirmed = await confirmDialog({
      title: 'Feiertag löschen',
      message: `Möchten Sie den Feiertag "${holiday.name}" wirklich löschen?`,
      confirmText: 'Löschen',
      cancelText: 'Abbrechen',
      type: 'warning'
    });

    if (!confirmed) return;

    try {
      await holidayService.deleteHoliday(holiday.id);
      showNotification({
        type: 'success',
        title: 'Erfolg',
        message: `Feiertag "${holiday.name}" wurde gelöscht`
      });
      loadHolidays();
    } catch (err: any) {
      showNotification({
        type: 'error',
        title: 'Fehler',
        message: 'Feiertag konnte nicht gelöscht werden'
      });
    }
  };

  const formatDate = (dateStr: string): string => {
    return new Date(dateStr).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const getHolidayTypeLabel = (holiday: Holiday): string => {
    if (holiday.endDate) return 'Mehrtägig';
    if (holiday.halfDay === 'morning') return 'Halbtag (Vormittag)';
    if (holiday.halfDay === 'afternoon') return 'Halbtag (Nachmittag)';
    return 'Ganztägig';
  };

  if (loading && viewMode === 'list') {
    return (
      <div style={{ textAlign: 'center', padding: '40px' }}>
        <div>Lade Feiertage...</div>
      </div>
    );
  }

  // Form view (create/edit)
  if (viewMode === 'create' || viewMode === 'edit') {
    return (
      <div>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '30px'
        }}>
          <div>
            <h1 style={{ margin: 0, color: '#2c3e50' }}>
              {viewMode === 'create' ? 'Neuer Feiertag' : 'Feiertag bearbeiten'}
            </h1>
          </div>
          <button
            onClick={handleBackToList}
            style={{
              padding: '10px 20px',
              backgroundColor: '#7f8c8d',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer'
            }}
          >
            Zurück zur Liste
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{
          backgroundColor: 'white',
          padding: '24px',
          borderRadius: '8px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
        }}>
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#2c3e50' }}>
              Name *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
              style={{
                width: '100%',
                padding: '12px',
                border: '1px solid #ddd',
                borderRadius: '6px',
                fontSize: '16px'
              }}
              placeholder="z.B. Weihnachten, Neujahr, etc."
            />
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#2c3e50' }}>
              Datum *
            </label>
            <input
              type="date"
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              required
              style={{
                width: '100%',
                padding: '12px',
                border: '1px solid #ddd',
                borderRadius: '6px',
                fontSize: '16px'
              }}
            />
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={isMultiDay}
                onChange={(e) => {
                  setIsMultiDay(e.target.checked);
                  if (e.target.checked) setIsHalfDay(false);
                }}
                style={{ width: '18px', height: '18px' }}
              />
              <span style={{ fontWeight: 'bold', color: '#2c3e50' }}>Mehrtägiger Feiertag</span>
            </label>
          </div>

          {isMultiDay && (
            <div style={{ marginBottom: '20px', marginLeft: '28px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#2c3e50' }}>
                Enddatum *
              </label>
              <input
                type="date"
                value={formData.endDate || ''}
                onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                required={isMultiDay}
                min={formData.date}
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '1px solid #ddd',
                  borderRadius: '6px',
                  fontSize: '16px'
                }}
              />
            </div>
          )}

          {!isMultiDay && (
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={isHalfDay}
                  onChange={(e) => {
                    setIsHalfDay(e.target.checked);
                    if (!e.target.checked) {
                      setFormData({ ...formData, halfDay: undefined });
                    } else {
                      setFormData({ ...formData, halfDay: 'morning' });
                    }
                  }}
                  style={{ width: '18px', height: '18px' }}
                />
                <span style={{ fontWeight: 'bold', color: '#2c3e50' }}>Halber Tag</span>
              </label>
            </div>
          )}

          {isHalfDay && !isMultiDay && (
            <div style={{ marginBottom: '20px', marginLeft: '28px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#2c3e50' }}>
                Welche Hälfte?
              </label>
              <div style={{ display: 'flex', gap: '20px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="halfDay"
                    value="morning"
                    checked={formData.halfDay === 'morning'}
                    onChange={() => setFormData({ ...formData, halfDay: 'morning' })}
                  />
                  <span>Vormittag (frei)</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="halfDay"
                    value="afternoon"
                    checked={formData.halfDay === 'afternoon'}
                    onChange={() => setFormData({ ...formData, halfDay: 'afternoon' })}
                  />
                  <span>Nachmittag (frei)</span>
                </label>
              </div>
            </div>
          )}

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={formData.isRecurring}
                onChange={(e) => setFormData({ ...formData, isRecurring: e.target.checked })}
                style={{ width: '18px', height: '18px' }}
              />
              <span style={{ fontWeight: 'bold', color: '#2c3e50' }}>Jährlich wiederkehrend</span>
            </label>
            <p style={{ marginLeft: '28px', marginTop: '4px', color: '#7f8c8d', fontSize: '14px' }}>
              Wird automatisch jedes Jahr am gleichen Datum angezeigt
            </p>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#2c3e50' }}>
              Beschreibung
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
              style={{
                width: '100%',
                padding: '12px',
                border: '1px solid #ddd',
                borderRadius: '6px',
                fontSize: '16px',
                resize: 'vertical'
              }}
              placeholder="Optionale Beschreibung oder Hinweise"
            />
          </div>

          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              type="submit"
              style={{
                padding: '12px 24px',
                backgroundColor: '#51258f',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: 'bold'
              }}
            >
              {viewMode === 'create' ? 'Feiertag erstellen' : 'Änderungen speichern'}
            </button>
            <button
              type="button"
              onClick={handleBackToList}
              style={{
                padding: '12px 24px',
                backgroundColor: '#e0e0e0',
                color: '#333',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer'
              }}
            >
              Abbrechen
            </button>
          </div>
        </form>
      </div>
    );
  }

  // List view
  return (
    <div>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '30px',
        flexWrap: 'wrap',
        gap: '15px'
      }}>
        <div>
          <h1 style={{ margin: 0, color: '#2c3e50' }}>Feiertage Verwaltung</h1>
          <p style={{ margin: '5px 0 0 0', color: '#7f8c8d', fontSize: '14px' }}>
            {holidays.length} Feiertage definiert
          </p>
        </div>

        {hasRole(['admin']) && (
          <button
            onClick={handleCreate}
            style={{
              padding: '12px 24px',
              backgroundColor: '#51258f',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: 'bold',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            + Neuer Feiertag
          </button>
        )}
      </div>

      {holidays.length === 0 ? (
        <div style={{
          backgroundColor: 'white',
          padding: '40px',
          borderRadius: '8px',
          textAlign: 'center',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
        }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🗓️</div>
          <h3 style={{ color: '#2c3e50', marginBottom: '8px' }}>Keine Feiertage definiert</h3>
          <p style={{ color: '#7f8c8d' }}>
            Erstellen Sie Feiertage, um diese im Kalender und in Plänen anzuzeigen.
          </p>
        </div>
      ) : (
        <div style={{
          backgroundColor: 'white',
          borderRadius: '8px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          overflow: 'hidden'
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: '#f8f9fa' }}>
                <th style={{ padding: '16px', textAlign: 'left', borderBottom: '2px solid #e0e0e0', color: '#2c3e50' }}>Name</th>
                <th style={{ padding: '16px', textAlign: 'left', borderBottom: '2px solid #e0e0e0', color: '#2c3e50' }}>Datum</th>
                <th style={{ padding: '16px', textAlign: 'left', borderBottom: '2px solid #e0e0e0', color: '#2c3e50' }}>Typ</th>
                <th style={{ padding: '16px', textAlign: 'center', borderBottom: '2px solid #e0e0e0', color: '#2c3e50' }}>Wiederkehrend</th>
                <th style={{ padding: '16px', textAlign: 'right', borderBottom: '2px solid #e0e0e0', color: '#2c3e50' }}>Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {holidays.map((holiday) => (
                <tr key={holiday.id} style={{ borderBottom: '1px solid #e0e0e0' }}>
                  <td style={{ padding: '16px' }}>
                    <div style={{ fontWeight: 'bold', color: '#2c3e50' }}>{holiday.name}</div>
                    {holiday.description && (
                      <div style={{ fontSize: '13px', color: '#7f8c8d', marginTop: '4px' }}>
                        {holiday.description}
                      </div>
                    )}
                  </td>
                  <td style={{ padding: '16px', color: '#2c3e50' }}>
                    {formatDate(holiday.date)}
                    {holiday.endDate && (
                      <span style={{ color: '#7f8c8d' }}> - {formatDate(holiday.endDate)}</span>
                    )}
                  </td>
                  <td style={{ padding: '16px' }}>
                    <span style={{
                      display: 'inline-block',
                      padding: '4px 12px',
                      backgroundColor: holiday.halfDay ? '#fff3cd' : holiday.endDate ? '#d1ecf1' : '#d4edda',
                      color: holiday.halfDay ? '#856404' : holiday.endDate ? '#0c5460' : '#155724',
                      borderRadius: '12px',
                      fontSize: '13px'
                    }}>
                      {getHolidayTypeLabel(holiday)}
                    </span>
                  </td>
                  <td style={{ padding: '16px', textAlign: 'center' }}>
                    {holiday.isRecurring ? (
                      <span style={{
                        display: 'inline-block',
                        padding: '4px 12px',
                        backgroundColor: '#e2e3f3',
                        color: '#51258f',
                        borderRadius: '12px',
                        fontSize: '13px'
                      }}>
                        Jährlich
                      </span>
                    ) : (
                      <span style={{ color: '#7f8c8d' }}>Einmalig</span>
                    )}
                  </td>
                  <td style={{ padding: '16px', textAlign: 'right' }}>
                    {hasRole(['admin']) && (
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                        <button
                          onClick={() => handleEdit(holiday)}
                          style={{
                            padding: '8px 16px',
                            backgroundColor: '#51258f',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer'
                          }}
                        >
                          Bearbeiten
                        </button>
                        <button
                          onClick={() => handleDelete(holiday)}
                          style={{
                            padding: '8px 16px',
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
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default HolidaysAdmin;
