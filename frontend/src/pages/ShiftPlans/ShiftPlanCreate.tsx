// frontend/src/pages/ShiftPlans/ShiftPlanCreate.tsx
import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { shiftPlanService } from '../../services/shiftPlanService';
import styles from './ShiftPlanCreate.module.css';

// Interface für Template Presets
interface TemplatePreset {
  name: string;
  label: string;
  description: string;
}

const ShiftPlanCreate: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  const [planName, setPlanName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedPreset, setSelectedPreset] = useState('');
  const [presets, setPresets] = useState<TemplatePreset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    loadTemplatePresets();
  }, []);

  const loadTemplatePresets = async () => {
    try {
      console.log('🔄 Lade verfügbare Vorlagen-Presets...');
      const data = await shiftPlanService.getTemplatePresets();
      console.log('✅ Presets geladen:', data);
      
      setPresets(data);
      
      // Setze das erste Preset als Standard, falls vorhanden
      if (data.length > 0) {
        setSelectedPreset(data[0].name);
      }
    } catch (error) {
      console.error('❌ Fehler beim Laden der Vorlagen-Presets:', error);
      setError('Vorlagen-Presets konnten nicht geladen werden');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    try {
      // Validierung
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
      if (!selectedPreset) {
        setError('Bitte wählen Sie eine Vorlage aus');
        return;
      }

      console.log('🔄 Erstelle Schichtplan aus Preset...', {
        presetName: selectedPreset,
        name: planName,
        startDate,
        endDate
      });

      // Erstelle den Plan aus dem ausgewählten Preset
      const createdPlan = await shiftPlanService.createFromPreset({
        presetName: selectedPreset,
        name: planName,
        startDate: startDate,
        endDate: endDate,
        isTemplate: false
      });

      console.log('✅ Plan erstellt:', createdPlan);
      
      // Erfolgsmeldung und Weiterleitung
      setSuccess('Schichtplan erfolgreich erstellt!');
      setTimeout(() => {
        navigate(`/shift-plans/${createdPlan.id}`);
      }, 1500);
      
    } catch (error) {
      const err = error as Error;
      console.error('❌ Fehler beim Erstellen des Plans:', err);
      setError(`Plan konnte nicht erstellt werden: ${err.message}`);
    } 
  };

  const getSelectedPresetDescription = () => {
    const preset = presets.find(p => p.name === selectedPreset);
    return preset ? preset.description : '';
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>Lade Vorlagen...</div>
      </div>
    );
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

      {success && (
        <div className={styles.success}>
          {success}
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
            className={styles.input}
          />
        </div>

        <div className={styles.dateGroup}>
          <div className={styles.formGroup}>
            <label>Von:</label>
            <input 
              type="date" 
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className={styles.input}
            />
          </div>

          <div className={styles.formGroup}>
            <label>Bis:</label>
            <input 
              type="date" 
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className={styles.input}
            />
          </div>
        </div>

        <div className={styles.formGroup}>
          <label>Vorlage verwenden:</label>
          <select 
            value={selectedPreset} 
            onChange={(e) => setSelectedPreset(e.target.value)}
            className={`${styles.select} ${presets.length === 0 ? styles.empty : ''}`}
          >
            <option value="">Bitte wählen...</option>
            {presets.map(preset => (
              <option key={preset.name} value={preset.name}>
                {preset.label}
              </option>
            ))}
          </select>
          
          {selectedPreset && (
            <div className={styles.presetDescription}>
              {getSelectedPresetDescription()}
            </div>
          )}

          {presets.length === 0 && (
            <p className={styles.noTemplates}>
              Keine Vorlagen verfügbar.
            </p>
          )}
        </div>

        <div className={styles.actions}>
          <button 
            onClick={handleCreate} 
            className={styles.createButton} 
            disabled={!selectedPreset || !planName.trim() || !startDate || !endDate}
          >
            Schichtplan erstellen
          </button>
        </div>
      </div>
    </div>
  );
};

export default ShiftPlanCreate;