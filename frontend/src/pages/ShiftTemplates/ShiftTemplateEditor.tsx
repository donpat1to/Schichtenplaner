// frontend/src/pages/ShiftTemplates/ShiftTemplateEditor.tsx
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ShiftTemplate, TemplateShift, DEFAULT_DAYS } from '../../types/shiftTemplate';
import { shiftTemplateService } from '../../services/shiftTemplateService';
import ShiftDayEditor from './components/ShiftDayEditor';
import DefaultTemplateView from './components/DefaultTemplateView';
import styles from './ShiftTemplateEditor.module.css';

interface ExtendedTemplateShift extends Omit<TemplateShift, 'id'> {
  id?: string;
  isPreview?: boolean;
}

const defaultShift: ExtendedTemplateShift = {
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
  const [showPreview, setShowPreview] = useState(false);

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

  // Preview-Daten für die DefaultTemplateView vorbereiten
  const previewTemplate: ShiftTemplate = {
    id: 'preview',
    name: template.name || 'Vorschau',
    description: template.description,
    shifts: template.shifts.map(shift => ({
      ...shift,
      id: shift.id || 'preview-' + Date.now()
    })),
    createdBy: 'preview',
    createdAt: new Date().toISOString(),
    isDefault: template.isDefault
  };

  if (loading) return <div>Lade Vorlage...</div>;

  return (
    <div className={styles.editorContainer}>
      <div className={styles.header}>
        <h1 className={styles.title}>{isEditing ? 'Vorlage bearbeiten' : 'Neue Vorlage erstellen'}</h1>
        <div className={styles.buttons}>
          <button 
            className={styles.previewButton}
            onClick={() => setShowPreview(!showPreview)}
          >
            {showPreview ? 'Editor anzeigen' : 'Vorschau'}
          </button>
          <button 
            className={styles.saveButton}
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? 'Speichern...' : 'Speichern'}
          </button>
        </div>
      </div>

      {showPreview ? (
        <DefaultTemplateView template={previewTemplate} />
      ) : (
        <>
          <div className={styles.formGroup}>
            <label>Vorlagenname *</label>
            <input
              type="text"
              value={template.name}
              onChange={(e) => setTemplate(prev => ({ ...prev, name: e.target.value }))}
              placeholder="z.B. Standard Woche, Teilzeit Modell, etc."
            />
          </div>

          <div className={styles.formGroup}>
            <label>Beschreibung</label>
            <textarea
              value={template.description || ''}
              onChange={(e) => setTemplate(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Beschreibung der Vorlage (optional)"
            />
          </div>

          <div className={styles.defaultCheckbox}>
            <input
              type="checkbox"
              id="isDefault"
              checked={template.isDefault}
              onChange={(e) => setTemplate(prev => ({ ...prev, isDefault: e.target.checked }))}
            />
            <label htmlFor="isDefault">Als Standardvorlage festlegen</label>
          </div>

          <div style={{ marginTop: '30px' }}>
            <h2>Schichten pro Wochentag</h2>
            <div style={{ display: 'grid', gap: '20px', marginTop: '20px' }}>
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
        </>
      )}
    </div>
  );
};

export default ShiftTemplateEditor;