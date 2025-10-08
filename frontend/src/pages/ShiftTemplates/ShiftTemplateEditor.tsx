// frontend/src/pages/ShiftTemplates/ShiftTemplateEditor.tsx
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ShiftTemplate, TemplateShift, DEFAULT_DAYS } from '../../types/shiftTemplate';
import { shiftTemplateService } from '../../services/shiftTemplateService';
import ShiftDayEditor from './components/ShiftDayEditor';

const defaultShift: Omit<TemplateShift, 'id'> = {
  dayOfWeek: 1, // Montag
  name: '',
  startTime: '08:00',
  endTime: '12:00',
  requiredEmployees: 1,
  color: '#3498db'
};

const ShiftTemplateEditor: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEditing = !!id;

  const [template, setTemplate] = useState<Omit<ShiftTemplate, 'id' | 'createdAt' | 'createdBy'>>({
    name: '',
    description: '',
    shifts: [],
    isDefault: false
  });
  const [loading, setLoading] = useState(isEditing);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isEditing) {
      loadTemplate();
    }
  }, [id]);

  const loadTemplate = async () => {
    try {
      if (!id) return;
      const data = await shiftTemplateService.getTemplate(id);
      setTemplate({
        name: data.name,
        description: data.description,
        shifts: data.shifts,
        isDefault: data.isDefault
      });
    } catch (error) {
      console.error('Fehler beim Laden:', error);
      alert('Vorlage konnte nicht geladen werden');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!template.name.trim()) {
      alert('Bitte geben Sie einen Namen für die Vorlage ein');
      return;
    }

    setSaving(true);
    try {
      if (isEditing && id) {
        await shiftTemplateService.updateTemplate(id, template);
      } else {
        await shiftTemplateService.createTemplate(template);
      }
      navigate('/shift-templates');
    } catch (error) {
      console.error('Speichern fehlgeschlagen:', error);
      alert('Fehler beim Speichern der Vorlage');
    } finally {
      setSaving(false);
    }
  };

  const addShift = (dayOfWeek: number) => {
    const newShift: TemplateShift = {
      ...defaultShift,
      id: Date.now().toString(),
      dayOfWeek,
      name: `Schicht ${template.shifts.filter(s => s.dayOfWeek === dayOfWeek).length + 1}`
    };
    
    setTemplate(prev => ({
      ...prev,
      shifts: [...prev.shifts, newShift]
    }));
  };

  const updateShift = (shiftId: string, updates: Partial<TemplateShift>) => {
    setTemplate(prev => ({
      ...prev,
      shifts: prev.shifts.map(shift =>
        shift.id === shiftId ? { ...shift, ...updates } : shift
      )
    }));
  };

  const removeShift = (shiftId: string) => {
    setTemplate(prev => ({
      ...prev,
      shifts: prev.shifts.filter(shift => shift.id !== shiftId)
    }));
  };

  if (loading) return <div>Lade Vorlage...</div>;

  return (
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
        <h1>{isEditing ? 'Vorlage bearbeiten' : 'Neue Vorlage erstellen'}</h1>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button 
            onClick={() => navigate('/shift-templates')}
            style={{ padding: '10px 20px', border: '1px solid #6c757d', background: 'white', color: '#6c757d' }}
          >
            Abbrechen
          </button>
          <button 
            onClick={handleSave}
            disabled={saving}
            style={{ padding: '10px 20px', backgroundColor: saving ? '#6c757d' : '#007bff', color: 'white', border: 'none' }}
          >
            {saving ? 'Speichern...' : 'Speichern'}
          </button>
        </div>
      </div>

      {/* Template Meta Information */}
      <div style={{ marginBottom: '30px', padding: '20px', border: '1px solid #ddd', borderRadius: '8px' }}>
        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
            Vorlagenname *
          </label>
          <input
            type="text"
            value={template.name}
            onChange={(e) => setTemplate(prev => ({ ...prev, name: e.target.value }))}
            style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }}
            placeholder="z.B. Standard Woche, Teilzeit Modell, etc."
          />
        </div>

        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
            Beschreibung
          </label>
          <textarea
            value={template.description || ''}
            onChange={(e) => setTemplate(prev => ({ ...prev, description: e.target.value }))}
            style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px', minHeight: '60px' }}
            placeholder="Beschreibung der Vorlage (optional)"
          />
        </div>

        <div>
          <label style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <input
              type="checkbox"
              checked={template.isDefault}
              onChange={(e) => setTemplate(prev => ({ ...prev, isDefault: e.target.checked }))}
            />
            Als Standardvorlage festlegen
          </label>
        </div>
      </div>

      {/* Schichten pro Tag */}
      <div>
        <h2 style={{ marginBottom: '20px' }}>Schichten pro Wochentag</h2>
        <div style={{ display: 'grid', gap: '20px' }}>
          {DEFAULT_DAYS.map(day => (
            <ShiftDayEditor
              key={day.id}
              day={day}
              shifts={template.shifts.filter(s => s.dayOfWeek === day.id)}
              onAddShift={() => addShift(day.id)}
              onUpdateShift={updateShift}
              onRemoveShift={removeShift}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default ShiftTemplateEditor;