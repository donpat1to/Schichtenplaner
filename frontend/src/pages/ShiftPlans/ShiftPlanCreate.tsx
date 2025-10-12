// frontend/src/pages/ShiftPlans/ShiftPlanCreate.tsx
import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { shiftTemplateService } from '../../services/shiftTemplateService';
import { shiftPlanService } from '../../services/shiftPlanService';
import styles from './ShiftPlanCreate.module.css';
import { TimeSlot, Shift } from '../../models/ShiftPlan';

export interface TemplateShift {
  id: string;
  name: string;
  isDefault?: boolean;
}

const ShiftPlanCreate: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  const [planName, setPlanName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [templates, setTemplates] = useState<TemplateShift[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadTemplates();
  }, []);

  useEffect(() => {
    // Template aus URL-Parameter setzen, falls vorhanden
    const templateId = searchParams.get('template');
    if (templateId) {
      setSelectedTemplate(templateId);
    }
  }, [searchParams]);

  const loadTemplates = async () => {
    try {
      const data = await shiftTemplateService.getTemplates();
      setTemplates(data);
      
      // Wenn keine Template-ID in der URL ist, setze die Standard-Vorlage
      if (!searchParams.get('template')) {
        if (!searchParams.get('template') && data.length > 0) {
          setSelectedTemplate(data[0].id);
        }
      }
    } catch (error) {
      console.error('Fehler beim Laden der Vorlagen:', error);
      setError('Vorlagen konnten nicht geladen werden');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    try {
      if (!planName.trim()) {
        setError('Bitte geben Sie einen Namen für den Schichtplan ein');
        return;
      }
      if (!startDate) {
        setError('Bitte wählen Sie ein Startdatum');
        return;
      }
      if (!endDate) {
        setError('Bitte wählen Sie ein Enddatum');
        return;
      }
      if (new Date(endDate) < new Date(startDate)) {
        setError('Das Enddatum muss nach dem Startdatum liegen');
        return;
      }

      let timeSlots: Omit<TimeSlot, 'id' | 'planId'>[] = [];
      let shifts: Omit<Shift, 'id' | 'planId'>[] = [];

      // If a template is selected, load its data
      if (selectedTemplate) {
        try {
          const template = await shiftTemplateService.getTemplate(selectedTemplate);
          timeSlots = template.timeSlots.map(slot => ({
            name: slot.name,
            startTime: slot.startTime,
            endTime: slot.endTime,
            description: slot.description
          }));
          shifts = template.shifts.map(shift => ({
            timeSlotId: shift.timeSlotId,
            dayOfWeek: shift.dayOfWeek,
            requiredEmployees: shift.requiredEmployees,
            color: shift.color
          }));
        } catch (error) {
          console.error('Fehler beim Laden der Vorlage:', error);
          setError('Die ausgewählte Vorlage konnte nicht geladen werden');
          return;
        }
      }

      await shiftPlanService.createShiftPlan({
        name: planName,
        startDate,
        endDate,
        isTemplate: false,
        templateId: selectedTemplate || undefined,
        timeSlots,
        shifts
      });

      // Nach erfolgreicher Erstellung zur Liste der Schichtpläne navigieren
      navigate('/shift-plans');
    } catch (error) {
      console.error('Fehler beim Erstellen des Schichtplans:', error);
      setError('Der Schichtplan konnte nicht erstellt werden. Bitte versuchen Sie es später erneut.');
    }
  };

  if (loading) {
    return <div>Lade Vorlagen...</div>;
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>Neuen Schichtplan erstellen</h1>
        <button onClick={() => navigate(-1)} className={styles.backButton}>
          Zurück
        </button>
      </div>

      {error && (
        <div className={styles.error}>
          {error}
        </div>
      )}
      
      <div className={styles.form}>
        <div className={styles.formGroup}>
          <label>Plan Name:</label>
          <input 
            type="text" 
            value={planName}
            onChange={(e) => setPlanName(e.target.value)}
            placeholder="z.B. KW 42 2025"
          />
        </div>

        <div className={styles.dateGroup}>
          <div className={styles.formGroup}>
            <label>Von:</label>
            <input 
              type="date" 
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>

          <div className={styles.formGroup}>
            <label>Bis:</label>
            <input 
              type="date" 
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
        </div>

        <div className={styles.formGroup}>
          <label>Vorlage verwenden:</label>
          <select 
            value={selectedTemplate} 
            onChange={(e) => setSelectedTemplate(e.target.value)}
            className={templates.length === 0 ? styles.empty : ''}
          >
            <option value="">Keine Vorlage</option>
            {templates.map(template => (
              <option key={template.id} value={template.id}>
                {template.name} {template.isDefault ? '(Standard)' : ''}
              </option>
            ))}
          </select>
          {templates.length === 0 && (
            <p className={styles.noTemplates}>
              Keine Vorlagen verfügbar. 
              <button onClick={() => navigate('/shift-templates/new')} className={styles.linkButton}>
                Neue Vorlage erstellen
              </button>
            </p>
          )}
        </div>

        <div className={styles.actions}>
          <button onClick={handleCreate} className={styles.createButton} disabled={!selectedTemplate}>
            Schichtplan erstellen
          </button>
        </div>
      </div>
    </div>
  );
};

export default ShiftPlanCreate;