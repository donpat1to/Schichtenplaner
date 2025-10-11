// frontend/src/shared/utils.ts
// import { ScheduledShift } from '../../../backend/src/models/shiftPlan.js';

// Shared date and time formatting utilities
export const formatDate = (dateString: string | undefined): string => {
  if (!dateString) return 'Kein Datum';
  
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return 'Ungültiges Datum';
  
  return date.toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
};

export const formatTime = (timeString: string): string => {
  return timeString?.substring(0, 5) || '';
};

export const formatDateTime = (dateString: string): string => {
  if (!dateString) return 'Kein Datum';
  
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return 'Ungültiges Datum';
  
  return date.toLocaleDateString('de-DE', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};