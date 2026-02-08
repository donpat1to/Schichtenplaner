// frontend/src/pages/Plans/PlanCreate.tsx
import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { shiftPlanService } from '../../services/shiftPlanService';
import { weeklyPlanService } from '../../services/weeklyPlanService';
import { useNotification } from '../../contexts/NotificationContext';
import { useBackendValidation } from '../../hooks/useBackendValidation';
import { WEEK_DAYS, DEFAULT_WORK_DAYS } from '../../models/WeeklyPlan';
import styles from './PlanCreate.module.css';

type PlanType = 'shift' | 'weekly';

interface TemplatePreset {
  name: string;
  label: string;
  description: string;
}

const PlanCreate: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { showNotification } = useNotification();
  const { executeWithValidation, isSubmitting } = useBackendValidation();

  const [planType, setPlanType] = useState<PlanType>('shift');
  const [planName, setPlanName] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [workDays, setWorkDays] = useState<number[]>(DEFAULT_WORK_DAYS);
  const [selectedPreset, setSelectedPreset] = useState('');
  const [presets, setPresets] = useState<TemplatePreset[]>([]);
  const [isLoadingPresets, setIsLoadingPresets] = useState(false);

  const planTypeName = planType === 'shift' ? 'Schichtplan' : 'Wochenplan';

  useEffect(() => {
    if (planType === 'shift') {
      loadTemplatePresets();
    }
  }, [planType]);

  useEffect(() => {
    // Reset form when plan type changes
    setPlanName('');
    setDescription('');
    setStartDate('');
    setEndDate('');
    setWorkDays(DEFAULT_WORK_DAYS);
    setSelectedPreset('');
  }, [planType]);

  const toggleWorkDay = (dayId: number) => {
    setWorkDays(prev => {
      if (prev.includes(dayId)) {
        // Don't allow removing if only one day left
        if (prev.length === 1) return prev;
        return prev.filter(d => d !== dayId);
      } else {
        return [...prev, dayId].sort((a, b) => a - b);
      }
    });
  };

  const setWorkDaysPreset = (preset: 'mo-fr' | 'mo-so') => {
    if (preset === 'mo-fr') {
      setWorkDays([1, 2, 3, 4, 5]);
    } else {
      setWorkDays([1, 2, 3, 4, 5, 6, 7]);
    }
  };

  const loadTemplatePresets = async () => {
    setIsLoadingPresets(true);
    try {
      const data = await shiftPlanService.getTemplatePresets();
      setPresets(data);

      // Set first preset as default if available
      if (data.length > 0) {
        setSelectedPreset(data[0].name);
      }
    } catch (error) {
      console.error('Error loading template presets:', error);
      showNotification({
        type: 'error',
        title: 'Fehler beim Laden',
        message: 'Vorlagen-Presets konnten nicht geladen werden'
      });
    } finally {
      setIsLoadingPresets(false);
    }
  };

  const calculateWeekCount = (): number => {
    if (!startDate || !endDate || planType !== 'weekly') return 0;

    const start = new Date(startDate);
    const end = new Date(endDate);
    if (end < start) return 0;

    // Adjust to Monday of start week
    const dayOfWeek = start.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    start.setDate(start.getDate() + mondayOffset);

    let weeks = 0;
    const current = new Date(start);
    while (current <= end) {
      weeks++;
      current.setDate(current.getDate() + 7);
    }
    return weeks;
  };

  const validateForm = (): { isValid: boolean; message?: string } => {
    // Basic validation common to both plan types
    if (!planName.trim()) {
      return { isValid: false, message: 'Bitte geben Sie einen Namen für den Plan ein' };
    }
    if (!startDate) {
      return { isValid: false, message: 'Bitte wählen Sie ein Startdatum' };
    }
    if (!endDate) {
      return { isValid: false, message: 'Bitte wählen Sie ein Enddatum' };
    }
    if (new Date(endDate) < new Date(startDate)) {
      return { isValid: false, message: 'Das Enddatum muss nach dem Startdatum liegen' };
    }

    // Plan type specific validations
    if (planType === 'shift' && !selectedPreset) {
      return { isValid: false, message: 'Bitte wählen Sie eine Vorlage aus' };
    }
    if (planType === 'weekly') {
      const weekCount = calculateWeekCount();
      if (weekCount === 0) {
        return { isValid: false, message: 'Der Zeitraum muss mindestens eine Woche umfassen' };
      }
    }

    return { isValid: true };
  };

  const handleCreatePlan = async () => {
    const validation = validateForm();
    if (!validation.isValid) {
      showNotification({
        type: 'error',
        title: 'Fehlende Angaben',
        message: validation.message || 'Bitte überprüfen Sie Ihre Eingaben'
      });
      return;
    }

    await executeWithValidation(async () => {
      if (planType === 'shift') {
        // Create shift plan from template
        const createdPlan = await shiftPlanService.createFromPreset({
          presetName: selectedPreset,
          name: planName,
          startDate: startDate,
          endDate: endDate,
          isTemplate: false
        });

        showNotification({
          type: 'success',
          title: 'Erfolg',
          message: 'Schichtplan erfolgreich erstellt!'
        });

        setTimeout(() => {
          navigate(`/plans/${createdPlan.id}`);
        }, 1000);
      } else {
        // Create weekly plan
        const createdPlan = await weeklyPlanService.createWeeklyPlan({
          name: planName.trim(),
          description: description.trim() || undefined,
          startDate,
          endDate,
          workDays
        });

        const weekCount = calculateWeekCount();
        showNotification({
          type: 'success',
          title: 'Erfolg',
          message: `Wochenplan "${planName}" mit ${weekCount} Wochen erstellt!`
        });

        setTimeout(() => {
          navigate(`/plans/${createdPlan.id}`);
        }, 1000);
      }
    });
  };

  const getSelectedPresetDescription = () => {
    const preset = presets.find(p => p.name === selectedPreset);
    return preset ? preset.description : '';
  };

  const weekCount = calculateWeekCount();

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>Neuen Plan erstellen</h1>
      </div>

      <div className={styles.planTypeSelector}>
        <button
          type="button"
          onClick={() => setPlanType('shift')}
          className={`${styles.planTypeButton} ${planType === 'shift' ? styles.active : ''}`}
          disabled={isSubmitting}
        >
          <span className={styles.icon}>📅</span>
          <span className={styles.buttonText}>Schichtplan</span>
          <span className={styles.description}>Tägliche Schichtplanung mit Vorlagen</span>
        </button>
        <button
          type="button"
          onClick={() => setPlanType('weekly')}
          className={`${styles.planTypeButton} ${planType === 'weekly' ? styles.active : ''}`}
          disabled={isSubmitting}
        >
          <span className={styles.icon}>📆</span>
          <span className={styles.buttonText}>Wochenplan</span>
          <span className={styles.description}>Wochenweise Mitarbeiterzuweisung</span>
        </button>
      </div>

      <div className={styles.form}>
        <div className={styles.infoBox}>
          <h4>{planTypeName} Erstellung</h4>
          {planType === 'shift' ? (
            <p>
              Ein Schichtplan ermöglicht die detaillierte Planung von täglichen Schichten.
              Wählen Sie eine Vorlage aus, die als Grundlage für die Schichtmuster dient.
            </p>
          ) : (
            <>
              <p>
                Ein Wochenplan ermöglicht die Zuweisung von Mitarbeitern zu ganzen Arbeitswochen.
                Nach der Erstellung können Mitarbeiter ihre Verfügbarkeit eintragen.
              </p>
              <ul>
                <li>Wochen werden automatisch aus dem Zeitraum generiert (Mo-So)</li>
                <li>Mitarbeiter können 3-stufige Präferenzen angeben</li>
                <li>Der Solver berücksichtigt Trainee-Betreuung und Mitarbeiterzahlen</li>
              </ul>
            </>
          )}
        </div>

        <div className={styles.formGroup}>
          <label>{planTypeName} Name *</label>
          <input
            type="text"
            value={planName}
            onChange={(e) => setPlanName(e.target.value)}
            placeholder={planType === 'shift' ? "z.B. KW 42 2025" : "z.B. Q1 2026 Wochenzuweisungen"}
            className={styles.input}
            disabled={isSubmitting}
          />
        </div>

        {planType === 'weekly' && (
          <div className={styles.formGroup}>
            <label>Beschreibung (optional)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optionale Beschreibung für den Plan..."
              className={styles.textarea}
              disabled={isSubmitting}
              rows={3}
            />
          </div>
        )}

        <div className={styles.dateGroup}>
          <div className={styles.formGroup}>
            <label>Startdatum *</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className={styles.input}
              disabled={isSubmitting}
            />
          </div>

          <div className={styles.formGroup}>
            <label>Enddatum *</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className={styles.input}
              disabled={isSubmitting}
            />
          </div>
        </div>

        {planType === 'shift' && (
          <div className={styles.formGroup}>
            <label>Vorlage verwenden *</label>
            <select
              value={selectedPreset}
              onChange={(e) => setSelectedPreset(e.target.value)}
              className={`${styles.select} ${presets.length === 0 ? styles.empty : ''}`}
              disabled={isSubmitting || isLoadingPresets}
            >
              <option value="">Bitte wählen...</option>
              {presets.map(preset => (
                <option key={preset.name} value={preset.name}>
                  {preset.label}
                </option>
              ))}
            </select>

            {isLoadingPresets && (
              <div className={styles.loadingText}>Lade Vorlagen...</div>
            )}

            {selectedPreset && (
              <div className={styles.presetDescription}>
                {getSelectedPresetDescription()}
              </div>
            )}

            {!isLoadingPresets && presets.length === 0 && (
              <p className={styles.noTemplates}>
                Keine Vorlagen verfügbar.
              </p>
            )}
          </div>
        )}

        {planType === 'weekly' && (
          <div className={styles.formGroup}>
            <label>Arbeitstage</label>
            <div className={styles.workDaysSelector}>
              <div className={styles.workDaysButtons}>
                {WEEK_DAYS.map(day => (
                  <button
                    key={day.id}
                    type="button"
                    onClick={() => toggleWorkDay(day.id)}
                    className={`${styles.workDayButton} ${workDays.includes(day.id) ? styles.active : ''}`}
                    disabled={isSubmitting}
                    title={day.name}
                  >
                    {day.shortName}
                  </button>
                ))}
              </div>
              <div className={styles.workDaysPresets}>
                <span className={styles.presetLabel}>Schnellauswahl:</span>
                <button
                  type="button"
                  onClick={() => setWorkDaysPreset('mo-fr')}
                  className={styles.presetButton}
                  disabled={isSubmitting}
                >
                  Mo-Fr
                </button>
                <button
                  type="button"
                  onClick={() => setWorkDaysPreset('mo-so')}
                  className={styles.presetButton}
                  disabled={isSubmitting}
                >
                  Mo-So
                </button>
              </div>
            </div>
          </div>
        )}

        {planType === 'weekly' && weekCount > 0 && (
          <div className={styles.preview}>
            <strong>Vorschau:</strong> {weekCount} Woche{weekCount !== 1 ? 'n' : ''} werden erstellt
          </div>
        )}

        <div className={styles.actions}>
          <button
            onClick={() => navigate('/plans')}
            className={styles.cancelButton}
            disabled={isSubmitting}
          >
            Abbrechen
          </button>
          <button
            onClick={handleCreatePlan}
            className={styles.createButton}
            disabled={isSubmitting || !planName.trim() || !startDate || !endDate ||
              (planType === 'shift' && !selectedPreset) ||
              (planType === 'weekly' && weekCount === 0)}
            style={{
              backgroundColor: planType === 'shift' ? '#51258f' : '#2980b9'
            }}
          >
            {isSubmitting
              ? 'Wird erstellt...'
              : `${planTypeName} erstellen`}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PlanCreate;