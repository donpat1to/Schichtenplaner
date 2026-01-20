// frontend/src/pages/WeeklyPlans/WeeklyPlanCreate.tsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { weeklyPlanService } from '../../services/weeklyPlanService';
import { useNotification } from '../../contexts/NotificationContext';
import { useBackendValidation } from '../../hooks/useBackendValidation';
import styles from './WeeklyPlanCreate.module.css';

const WeeklyPlanCreate: React.FC = () => {
  const navigate = useNavigate();
  const { showNotification } = useNotification();
  const { executeWithValidation, isSubmitting } = useBackendValidation();

  const [planName, setPlanName] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Calculate preview of weeks
  const calculateWeeks = (): number => {
    if (!startDate || !endDate) return 0;
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

  const handleCreate = async () => {
    if (!planName.trim()) {
      showNotification({
        type: 'error',
        title: 'Fehlende Angaben',
        message: 'Bitte geben Sie einen Namen für den Wochenplan ein'
      });
      return;
    }
    if (!startDate) {
      showNotification({
        type: 'error',
        title: 'Fehlende Angaben',
        message: 'Bitte wählen Sie ein Startdatum'
      });
      return;
    }
    if (!endDate) {
      showNotification({
        type: 'error',
        title: 'Fehlende Angaben',
        message: 'Bitte wählen Sie ein Enddatum'
      });
      return;
    }
    if (new Date(endDate) < new Date(startDate)) {
      showNotification({
        type: 'error',
        title: 'Ungültige Daten',
        message: 'Das Enddatum muss nach dem Startdatum liegen'
      });
      return;
    }

    await executeWithValidation(async () => {
      const createdPlan = await weeklyPlanService.createWeeklyPlan({
        name: planName.trim(),
        description: description.trim() || undefined,
        startDate,
        endDate
      });

      showNotification({
        type: 'success',
        title: 'Erfolg',
        message: `Wochenplan "${planName}" mit ${createdPlan.weeks.length} Wochen erstellt!`
      });

      setTimeout(() => {
        navigate(`/weekly-plans/${createdPlan.id}`);
      }, 1000);
    });
  };

  const weekCount = calculateWeeks();

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>Neuen Wochenplan erstellen</h1>
        <button
          onClick={() => navigate(-1)}
          className={styles.backButton}
          disabled={isSubmitting}
        >
          Zurück
        </button>
      </div>

      <div className={styles.form}>
        <div className={styles.infoBox}>
          <h4>Wochenplan-Erstellung</h4>
          <p>
            Ein Wochenplan ermöglicht die Zuweisung von Mitarbeitern zu ganzen Arbeitswochen.
            Nach der Erstellung können Mitarbeiter ihre Verfügbarkeit eintragen, und der
            Algorithmus generiert eine optimale Zuweisung.
          </p>
          <ul>
            <li>Wochen werden automatisch aus dem Zeitraum generiert (Mo-So)</li>
            <li>Mitarbeiter können 3-stufige Präferenzen angeben (Bevorzugt/Verfügbar/Nicht verfügbar)</li>
            <li>Der Solver berücksichtigt Trainee-Betreuung und Min/Max-Mitarbeiterzahlen</li>
          </ul>
        </div>

        <div className={styles.formGroup}>
          <label>Plan Name *</label>
          <input
            type="text"
            value={planName}
            onChange={(e) => setPlanName(e.target.value)}
            placeholder="z.B. Q1 2026 Wochenzuweisungen"
            className={styles.input}
            disabled={isSubmitting}
          />
        </div>

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

        {weekCount > 0 && (
          <div className={styles.preview}>
            <strong>Vorschau:</strong> {weekCount} Woche{weekCount !== 1 ? 'n' : ''} werden erstellt
          </div>
        )}

        <div className={styles.actions}>
          <button
            onClick={() => navigate('/weekly-plans')}
            className={styles.cancelButton}
            disabled={isSubmitting}
          >
            Abbrechen
          </button>
          <button
            onClick={handleCreate}
            className={styles.createButton}
            disabled={isSubmitting || !planName.trim() || !startDate || !endDate || weekCount === 0}
          >
            {isSubmitting ? 'Wird erstellt...' : 'Wochenplan erstellen'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default WeeklyPlanCreate;
