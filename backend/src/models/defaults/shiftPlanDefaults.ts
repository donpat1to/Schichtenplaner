// backend/src/models/defaults/shiftPlanDefaults.ts
import { TimeSlot, Shift } from '../ShiftPlan.js';

// Default time slots for ZEBRA (specific workplace)
export const DEFAULT_ZEBRA_TIME_SLOTS: (Omit<TimeSlot, 'id' | 'planId'> & { timeSlotId: string })[] = [
  {
    timeSlotId: 'morning',
    name: 'Vormittag',
    startTime: '08:00',
    endTime: '12:00',
    description: 'Vormittagsschicht'
  },
  {
    timeSlotId: 'afternoon',
    name: 'Nachmittag',
    startTime: '11:30',
    endTime: '15:30',
    description: 'Nachmittagsschicht'
  },
];

export const DEFAULT_TIME_SLOTS: (Omit<TimeSlot, 'id' | 'planId'> & { timeSlotId: string })[] = [
  {
    timeSlotId: 'morning',
    name: 'Vormittag',
    startTime: '08:00',
    endTime: '12:00',
    description: 'Vormittagsschicht'
  },
  {
    timeSlotId: 'afternoon',
    name: 'Nachmittag',
    startTime: '11:30',
    endTime: '15:30',
    description: 'Nachmittagsschicht'
  },
  {
    timeSlotId: 'evening',
    name: 'Abend',
    startTime: '14:00',
    endTime: '18:00',
    description: 'Abendschicht'
  },
];

// Default shifts for ZEBRA standard week template with variable required employees
export const DEFAULT_ZEBRA_SHIFTS: Omit<Shift, 'id' | 'planId'>[] = [
  // Monday-Thursday: Morning + Afternoon
  ...Array.from({ length: 4 }, (_, i) => i + 1).flatMap(day => [
    { timeSlotId: 'morning', dayOfWeek: day, requiredEmployees: 2, minEmployees: 1, maxEmployees: 2, color: '#3498db' },
    { timeSlotId: 'afternoon', dayOfWeek: day, requiredEmployees: 2, minEmployees: 1, maxEmployees: 2, color: '#3498db' }
  ]),
  // Friday: Morning only
  { timeSlotId: 'morning', dayOfWeek: 5, requiredEmployees: 2, minEmployees: 1, maxEmployees: 2, color: '#3498db' }
];

export const DEFAULT_SHIFTS: Omit<Shift, 'id' | 'planId'>[] = [
  // Monday-Friday: Morning + Afternoon + Evening
  ...Array.from({ length: 5 }, (_, i) => i + 1).flatMap(day => [
    { timeSlotId: 'morning', dayOfWeek: day, requiredEmployees: 2, minEmployees: 1, maxEmployees: 2, color: '#3498db' },
    { timeSlotId: 'afternoon', dayOfWeek: day, requiredEmployees: 2, minEmployees: 1, maxEmployees: 2, color: '#3498db' },
    { timeSlotId: 'evening', dayOfWeek: day, requiredEmployees: 1, minEmployees: 1, maxEmployees: 2, color: '#3498db' }
  ])
];

// Template presets for quick creation
export const TEMPLATE_PRESETS = {
  ZEBRA_STANDARD: {
    name: 'ZEBRA Standardwoche',
    description: 'Standard Vorlage für ZEBRA: Mo-Do Vormittag+Nachmittag, Fr nur Vormittag',
    timeSlots: DEFAULT_ZEBRA_TIME_SLOTS,
    shifts: DEFAULT_ZEBRA_SHIFTS
  },

  GENERAL_STANDARD: {
    name: 'Standard Wochenplan',
    description: 'Standard Vorlage: Mo-Fr Vormittag+Nachmittag+Abend',
    timeSlots: DEFAULT_TIME_SLOTS,
    shifts: DEFAULT_SHIFTS
  },

} as const;

// Helper function to create plan from preset
export function createPlanFromPreset(
  presetName: keyof typeof TEMPLATE_PRESETS,
  isTemplate: boolean = true,
  startDate?: string,
  endDate?: string
) {
  const preset = TEMPLATE_PRESETS[presetName];
  return {
    name: preset.name,
    description: preset.description,
    startDate,
    endDate,
    isTemplate,
    timeSlots: preset.timeSlots,
    shifts: preset.shifts
  };
}

// Status descriptions
export const PLAN_STATUS_DESCRIPTIONS = {
  draft: 'Entwurf - Kann bearbeitet werden',
  published: 'Veröffentlicht - Für alle sichtbar',
  archived: 'Archiviert - Nur noch lesbar',
  template: 'Vorlage - Kann für neue Pläne verwendet werden'
} as const;