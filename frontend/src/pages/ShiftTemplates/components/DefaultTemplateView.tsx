// frontend/src/pages/ShiftTemplates/components/DefaultTemplateView.tsx
import React from 'react';
import { ShiftTemplate } from '../../../types/shiftTemplate';
import styles from './DefaultTemplateView.module.css';

interface DefaultTemplateViewProps {
  template: ShiftTemplate;
}

const DefaultTemplateView: React.FC<DefaultTemplateViewProps> = ({ template }) => {
  // Gruppiere Schichten nach Wochentag
  const shiftsByDay = template.shifts.reduce((acc, shift) => {
    const day = shift.dayOfWeek;
    if (!acc[day]) {
      acc[day] = [];
    }
    acc[day].push(shift);
    return acc;
  }, {} as Record<number, typeof template.shifts>);

  // Funktion zum Formatieren der Zeit
  const formatTime = (time: string) => {
    return time.substring(0, 5); // Zeigt nur HH:MM
  };

  // Wochentagsnamen
  const dayNames = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];

  return (
    <div className={styles.defaultTemplateView}>
      <h2>{template.name}</h2>
      {template.description && <p>{template.description}</p>}
      
      <div className={styles.weekView}>
        {[1, 2, 3, 4, 5].map(dayIndex => (
          <div key={dayIndex} className={styles.dayColumn}>
            <h3>{dayNames[dayIndex]}</h3>
            <div className={styles.shiftsContainer}>
              {shiftsByDay[dayIndex]?.map(shift => (
                <div key={shift.id} className={styles.shiftCard}>
                  <h4>{shift.name}</h4>
                  <p>
                    {formatTime(shift.startTime)} - {formatTime(shift.endTime)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default DefaultTemplateView;