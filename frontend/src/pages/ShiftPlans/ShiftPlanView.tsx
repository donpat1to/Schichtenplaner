// frontend/src/pages/ShiftPlans/ShiftPlanView.tsx
import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { shiftPlanService } from '../../services/shiftPlanService';
import { employeeService } from '../../services/employeeService';
import { shiftAssignmentService } from '../../services/shiftAssignmentService';
import { AssignmentResult } from '../../models/scheduling';
import { ShiftPlan, TimeSlot, ScheduledShift } from '../../models/ShiftPlan';
import { Employee, EmployeeAvailability } from '../../models/Employee';
import { useNotification } from '../../contexts/NotificationContext';
import { formatDate, formatTime } from '../../utils/foramatters';
import { saveAs } from 'file-saver';
import styles from './ShiftPlanView.module.css';

// Local interface extensions (same as AvailabilityManager)
interface ExtendedTimeSlot extends TimeSlot {
  displayName?: string;
}

interface ExtendedShift {
  id: string;
  planId: string;
  timeSlotId: string;
  dayOfWeek: number;
  requiredEmployees: number;
  color?: string;
  timeSlotName?: string;
  startTime?: string;
  endTime?: string;
  displayName?: string;
}

const weekdays = [
  { id: 1, name: 'Montag' },
  { id: 2, name: 'Dienstag' },
  { id: 3, name: 'Mittwoch' },
  { id: 4, name: 'Donnerstag' },
  { id: 5, name: 'Freitag' },
  { id: 6, name: 'Samstag' },
  { id: 7, name: 'Sonntag' }
];

const ShiftPlanView: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { hasRole, user } = useAuth();
  const { showNotification } = useNotification();

  const [shiftPlan, setShiftPlan] = useState<ShiftPlan | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [availabilities, setAvailabilities] = useState<EmployeeAvailability[]>([]);
  const [assignmentResult, setAssignmentResult] = useState<AssignmentResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [scheduledShifts, setScheduledShifts] = useState<ScheduledShift[]>([]);
  const [showAssignmentPreview, setShowAssignmentPreview] = useState(false);
  const [recreating, setRecreating] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportType, setExportType] = useState<'pdf' | 'excel' | null>(null);
  const [dropdownWidth, setDropdownWidth] = useState(0);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadShiftPlanData();

    // Event Listener für Verfügbarkeits-Änderungen
    const handleAvailabilityChange = () => {
      console.log('📢 Verfügbarkeiten wurden geändert - lade Daten neu...');
      reloadAvailabilities();
    };

    // Globales Event für Verfügbarkeits-Änderungen
    window.addEventListener('availabilitiesChanged', handleAvailabilityChange);

    return () => {
      window.removeEventListener('availabilitiesChanged', handleAvailabilityChange);
    };
  }, [id]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // Seite ist wieder sichtbar - Daten neu laden
        console.log('🔄 Seite ist wieder sichtbar - lade Daten neu...');
        reloadAvailabilities();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // Add this useEffect to debug state changes
  useEffect(() => {
    console.log('🔍 STATE DEBUG - showAssignmentPreview:', showAssignmentPreview);
    console.log('🔍 STATE DEBUG - assignmentResult:', assignmentResult ? 'EXISTS' : 'NULL');
    console.log('🔍 STATE DEBUG - publishing:', publishing);
  }, [showAssignmentPreview, assignmentResult, publishing]);

  const debugAvailabilityShiftIds = () => {
    if (!availabilities.length) return;

    console.log('🔍 AVAILABILITY SHIFT ID ANALYSIS:');
    const uniqueShiftIds = [...new Set(availabilities.map(a => a.shiftId))];

    console.log(`Unique shift IDs in availabilities: ${uniqueShiftIds.length}`);
    uniqueShiftIds.forEach(shiftId => {
      const count = availabilities.filter(a => a.shiftId === shiftId).length;
      const pref1 = availabilities.filter(a => a.shiftId === shiftId && a.preferenceLevel === 1).length;
      const pref2 = availabilities.filter(a => a.shiftId === shiftId && a.preferenceLevel === 2).length;
      const pref3 = availabilities.filter(a => a.shiftId === shiftId && a.preferenceLevel === 3).length;

      console.log(`   ${shiftId}: ${count} total (✅${pref1} 🔶${pref2} ❌${pref3})`);
    });
  };

  // Call this after loading availabilities
  useEffect(() => {
    if (availabilities.length > 0) {
      debugAvailabilityShiftIds();
    }
  }, [availabilities]);

  useEffect(() => {
    if (dropdownRef.current) {
      setDropdownWidth(dropdownRef.current.offsetWidth / 40);  // Adjust divisor for desired slide distance
    }
  }, [exportType]);

  // Create a data structure that maps days to their shifts with time slot info - SAME AS AVAILABILITYMANAGER
  const getTimetableData = () => {
    if (!shiftPlan || !shiftPlan.shifts || !shiftPlan.timeSlots) {
      return { days: [], shiftsByDay: {}, allTimeSlots: [] };
    }

    // Create a map for quick time slot lookups
    const timeSlotMap = new Map(shiftPlan.timeSlots.map(ts => [ts.id, ts]));

    // Group shifts by day and enhance with time slot info - SAME LOGIC AS AVAILABILITYMANAGER
    const shiftsByDay = shiftPlan.shifts.reduce((acc, shift) => {
      if (!acc[shift.dayOfWeek]) {
        acc[shift.dayOfWeek] = [];
      }

      const timeSlot = timeSlotMap.get(shift.timeSlotId);
      const enhancedShift: ExtendedShift = {
        ...shift,
        timeSlotName: timeSlot?.name,
        startTime: timeSlot?.startTime,
        endTime: timeSlot?.endTime,
        displayName: timeSlot ? `${timeSlot.name} (${formatTime(timeSlot.startTime)}-${formatTime(timeSlot.endTime)})` : shift.id
      };

      acc[shift.dayOfWeek].push(enhancedShift);
      return acc;
    }, {} as Record<number, ExtendedShift[]>);

    // Sort shifts within each day by start time - SAME LOGIC AS AVAILABILITYMANAGER
    Object.keys(shiftsByDay).forEach(day => {
      shiftsByDay[parseInt(day)].sort((a, b) => {
        const timeA = a.startTime || '';
        const timeB = b.startTime || '';
        return timeA.localeCompare(timeB);
      });
    });

    // Get unique days that have shifts - SAME LOGIC AS AVAILABILITYMANAGER
    const days = Array.from(new Set(shiftPlan.shifts.map(shift => shift.dayOfWeek)))
      .sort()
      .map(dayId => {
        return weekdays.find(day => day.id === dayId) || { id: dayId, name: `Tag ${dayId}` };
      });

    // Get all unique time slots (rows) by collecting from all shifts - SAME LOGIC AS AVAILABILITYMANAGER
    const allTimeSlotsMap = new Map();
    days.forEach(day => {
      shiftsByDay[day.id]?.forEach(shift => {
        const timeSlot = timeSlotMap.get(shift.timeSlotId);
        if (timeSlot && !allTimeSlotsMap.has(timeSlot.id)) {
          allTimeSlotsMap.set(timeSlot.id, {
            ...timeSlot,
            shiftsByDay: {} // Initialize empty object to store shifts by day
          });
        }
      });
    });

    // Populate shifts for each time slot by day - SAME LOGIC AS AVAILABILITYMANAGER
    days.forEach(day => {
      shiftsByDay[day.id]?.forEach(shift => {
        const timeSlot = allTimeSlotsMap.get(shift.timeSlotId);
        if (timeSlot) {
          timeSlot.shiftsByDay[day.id] = shift;
        }
      });
    });

    // Convert to array and sort by start time - SAME LOGIC AS AVAILABILITYMANAGER
    const allTimeSlots = Array.from(allTimeSlotsMap.values()).sort((a, b) => {
      // Convert time strings to minutes for proper numeric comparison
      const timeToMinutes = (timeStr: string) => {
        if (!timeStr) return 0;
        const [hours, minutes] = timeStr.split(':').map(Number);
        return hours * 60 + minutes;
      };

      const minutesA = timeToMinutes(a.startTime);
      const minutesB = timeToMinutes(b.startTime);

      return minutesA - minutesB; // Ascending order (earliest first)
    });

    return { days, shiftsByDay, allTimeSlots };
  };

  // VALIDATION FUNCTION - Check if shifts are correctly placed (like in AvailabilityManager)
  const validateTimetableStructure = () => {
    if (!shiftPlan || !shiftPlan.shifts || !shiftPlan.timeSlots) {
      return { isValid: false, errors: ['No shift plan data available'] };
    }

    const validationErrors: string[] = [];

    // Check for missing time slots - SAME VALIDATION AS AVAILABILITYMANAGER
    const usedTimeSlotIds = new Set(shiftPlan.shifts.map(s => s.timeSlotId));
    const availableTimeSlotIds = new Set(shiftPlan.timeSlots.map(ts => ts.id));

    usedTimeSlotIds.forEach(timeSlotId => {
      if (!availableTimeSlotIds.has(timeSlotId)) {
        validationErrors.push(`Zeitslot ${timeSlotId} wird verwendet, existiert aber nicht in timeSlots`);
      }
    });

    // Check for shifts with invalid day numbers - SAME VALIDATION AS AVAILABILITYMANAGER
    shiftPlan.shifts.forEach(shift => {
      if (shift.dayOfWeek < 1 || shift.dayOfWeek > 7) {
        validationErrors.push(`Shift ${shift.id} hat ungültigen Wochentag: ${shift.dayOfWeek}`);
      }

      // Check if shift timeSlotId exists in timeSlots
      const timeSlotExists = shiftPlan.timeSlots.some(ts => ts.id === shift.timeSlotId);
      if (!timeSlotExists) {
        validationErrors.push(`Shift ${shift.id} verweist auf nicht existierenden Zeitslot: ${shift.timeSlotId}`);
      }
    });

    // Check for scheduled shifts consistency
    scheduledShifts.forEach(scheduledShift => {
      const timeSlotExists = shiftPlan.timeSlots.some(ts => ts.id === scheduledShift.timeSlotId);
      if (!timeSlotExists) {
        validationErrors.push(`Scheduled Shift ${scheduledShift.id} verweist auf nicht existierenden Zeitslot: ${scheduledShift.timeSlotId}`);
      }
    });

    return {
      isValid: validationErrors.length === 0,
      errors: validationErrors
    };
  };

  const handleExport = async () => {
    if (!shiftPlan || !exportType) return;

    try {
      setExporting(true);

      let blob: Blob;
      if (exportType === 'excel') {
        blob = await shiftPlanService.exportShiftPlanToExcel(shiftPlan.id);
        saveAs(blob, `Schichtplan_${shiftPlan.name}_${new Date().toISOString().split('T')[0]}.xlsx`);
      } else {
        blob = await shiftPlanService.exportShiftPlanToPDF(shiftPlan.id);
        saveAs(blob, `Schichtplan_${shiftPlan.name}_${new Date().toISOString().split('T')[0]}.pdf`);
      }

      showNotification({
        type: 'success',
        title: 'Export erfolgreich',
        message: `Der Schichtplan wurde als ${exportType === 'excel' ? 'Excel' : 'PDF'} exportiert.`
      });

    } catch (error) {
      console.error(`Error exporting to ${exportType}:`, error);
      showNotification({
        type: 'error',
        title: 'Export fehlgeschlagen',
        message: `Der ${exportType === 'excel' ? 'Excel' : 'PDF'}-Export konnte nicht durchgeführt werden.`
      });
    } finally {
      setExporting(false);
    }
  };

  const loadShiftPlanData = async () => {
    if (!id) return;

    try {
      setLoading(true);

      // Load plan and employees first
      const [plan, employeesData] = await Promise.all([
        shiftPlanService.getShiftPlan(id),
        employeeService.getEmployees(),
      ]);

      setShiftPlan(plan);
      setEmployees(employeesData.filter(emp => emp.isActive));

      // CRITICAL: Load scheduled shifts and verify they exist
      const shiftsData = await shiftAssignmentService.getScheduledShiftsForPlan(id);
      console.log('📋 Loaded scheduled shifts:', shiftsData.length);

      if (shiftsData.length === 0) {
        console.warn('⚠️ No scheduled shifts found for plan:', id);
        showNotification({
          type: 'warning',
          title: 'Keine Schichten gefunden',
          message: 'Der Schichtplan hat keine generierten Schichten. Bitte überprüfen Sie die Plan-Konfiguration.'
        });
      }

      setScheduledShifts(shiftsData);

      // Load availabilities - USING THE SAME LOGIC AS AVAILABILITYMANAGER
      console.log('🔄 LADE VERFÜGBARKEITEN FÜR PLAN:', id);

      const availabilityPromises = employeesData
        .filter(emp => emp.isActive)
        .map(emp => employeeService.getAvailabilities(emp.id));

      const allAvailabilities = await Promise.all(availabilityPromises);
      const flattenedAvailabilities = allAvailabilities.flat();

      // Filter to only include availabilities for the current plan - SAME LOGIC AS AVAILABILITYMANAGER
      const planAvailabilities = flattenedAvailabilities.filter(
        availability => availability.planId === id
      );

      console.log('✅ VERFÜGBARKEITEN FÜR DIESEN PLAN:', planAvailabilities.length);

      setAvailabilities(planAvailabilities);

      // Run validation
      const validation = validateTimetableStructure();
      if (!validation.isValid) {
        console.warn('⚠️ TIMETABLE VALIDATION ERRORS:', validation.errors);
      }

    } catch (error) {
      console.error('Error loading shift plan data:', error);
      showNotification({
        type: 'error',
        title: 'Fehler',
        message: 'Daten konnten nicht geladen werden.'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRecreateAssignments = async () => {
    if (!shiftPlan) return;

    try {
      setRecreating(true);

      if (!window.confirm('Möchten Sie die aktuellen Zuweisungen wirklich zurücksetzen? Alle vorhandenen Zuweisungen werden gelöscht.')) {
        return;
      }

      console.log('🔄 STARTING COMPLETE ASSIGNMENT CLEARING PROCESS');

      // STEP 1: Get current scheduled shifts
      const currentScheduledShifts = await shiftAssignmentService.getScheduledShiftsForPlan(shiftPlan.id);
      console.log(`📋 Found ${currentScheduledShifts.length} shifts to clear`);

      // STEP 2: Clear ALL assignments by setting empty arrays
      const clearPromises = currentScheduledShifts.map(async (scheduledShift) => {
        console.log(`🗑️ Clearing assignments for shift: ${scheduledShift.id}`);
        await shiftAssignmentService.updateScheduledShift(scheduledShift.id, {
          assignedEmployees: [] // EMPTY ARRAY - this clears the assignments
        });
      });

      await Promise.all(clearPromises);
      console.log('✅ All assignments cleared from database');

      // STEP 3: Update plan status to draft
      await shiftPlanService.updateShiftPlan(shiftPlan.id, {
        status: 'draft'
      });
      console.log('📝 Plan status set to draft');

      // STEP 4: CRITICAL - Force reload of scheduled shifts to get EMPTY assignments
      const refreshedShifts = await shiftAssignmentService.getScheduledShiftsForPlan(shiftPlan.id);
      setScheduledShifts(refreshedShifts); // Update state with EMPTY assignments

      // STEP 5: Clear any previous assignment results
      setAssignmentResult(null);
      setShowAssignmentPreview(false);

      // STEP 6: Force complete data refresh
      await loadShiftPlanData();

      console.log('🎯 ASSIGNMENT CLEARING COMPLETE - Table should now be empty');

      showNotification({
        type: 'success',
        title: 'Zuweisungen gelöscht',
        message: 'Alle Zuweisungen wurden erfolgreich gelöscht. Die Tabelle sollte jetzt leer sein.'
      });

    } catch (error) {
      console.error('❌ Error clearing assignments:', error);
      showNotification({
        type: 'error',
        title: 'Fehler',
        message: `Löschen der Zuweisungen fehlgeschlagen: ${error instanceof Error ? error.message : 'Unbekannter Fehler'}`
      });
    } finally {
      setRecreating(false);
    }
  };

  const getDayOfWeek = (dateString: string): number => {
    const date = new Date(dateString);
    return date.getDay() === 0 ? 7 : date.getDay();
  };

  const handlePreviewAssignment = async () => {
    if (!shiftPlan) return;

    try {
      setPublishing(true);
      setAssignmentResult(null); // Reset previous results
      setShowAssignmentPreview(false); // Reset preview

      console.log('🔄 STARTING ASSIGNMENT PREVIEW...');

      // FORCE COMPLETE REFRESH - don't rely on cached state
      const [refreshedEmployees, refreshedAvailabilities] = await Promise.all([
        employeeService.getEmployees().then(emps => emps.filter(emp => emp.isActive)),
        refreshAllAvailabilities()
      ]);

      console.log('🔄 USING FRESH DATA:');
      console.log('- Employees:', refreshedEmployees.length);
      console.log('- Availabilities:', refreshedAvailabilities.length);
      console.log('- Shift Patterns:', shiftPlan.shifts?.length || 0);
      console.log('- Scheduled Shifts:', scheduledShifts.length);

      const constraints = {
        enforceNoTraineeAlone: true,
        enforceExperiencedWithChef: true,
        maxRepairAttempts: 50,
        targetEmployeesPerShift: 2
      };

      console.log('🧠 Calling shift assignment service...');

      // Use the freshly loaded data, not the state
      const result = await shiftAssignmentService.assignShifts(
        shiftPlan,
        refreshedEmployees,
        refreshedAvailabilities,
        constraints
      );

      console.log("🎯 RAW ASSIGNMENT RESULT FROM API:", {
        success: result.success,
        assignmentsCount: Object.keys(result.assignments).length,
        assignmentKeys: Object.keys(result.assignments),
        violations: result.violations.length,
        resolutionReport: result.resolutionReport?.length || 0
      });

      // Log assignments with shift pattern context
      console.log('🔍 ASSIGNMENTS BY SHIFT PATTERN:');
      Object.entries(result.assignments).forEach(([shiftId, empIds]) => {
        const shiftPattern = shiftPlan.shifts?.find(s => s.id === shiftId);

        if (shiftPattern) {
          console.log(`   ✅ Shift Pattern: ${shiftId}`);
          console.log(`      - Day: ${shiftPattern.dayOfWeek}, TimeSlot: ${shiftPattern.timeSlotId}`);
          console.log(`      - Employees: ${empIds.join(', ')}`);
        } else {
          console.log(`   ❌ UNKNOWN ID: ${shiftId}`);
          console.log(`      - Employees: ${empIds.join(', ')}`);
          console.log(`      - This ID does not match any shift pattern!`);
        }
      });

      // CRITICAL: Update state and show preview
      console.log('🔄 Setting assignment result and showing preview...');
      setAssignmentResult(result);
      setShowAssignmentPreview(true);

      console.log('✅ Assignment preview ready, modal should be visible');

    } catch (error) {
      console.error('❌ Error during assignment:', error);
      showNotification({
        type: 'error',
        title: 'Fehler',
        message: 'Automatische Zuordnung fehlgeschlagen.'
      });
    } finally {
      setPublishing(false);
    }
  };

  const handlePublish = async () => {
    if (!shiftPlan || !assignmentResult) return;

    try {
      setPublishing(true);

      console.log('🔄 Starting to publish assignments...');

      // Get fresh scheduled shifts
      const updatedShifts = await shiftAssignmentService.getScheduledShiftsForPlan(shiftPlan.id);

      if (!updatedShifts || updatedShifts.length === 0) {
        throw new Error('No scheduled shifts found in the plan');
      }

      console.log(`📊 Found ${updatedShifts.length} scheduled shifts to update`);
      console.log('🎯 Assignment keys from algorithm:', Object.keys(assignmentResult.assignments));

      const updatePromises = updatedShifts.map(async (scheduledShift) => {
        const dayOfWeek = getDayOfWeek(scheduledShift.date);

        // Find the corresponding shift pattern for this day and time slot
        const shiftPattern = shiftPlan?.shifts?.find(shift =>
          shift.dayOfWeek === dayOfWeek &&
          shift.timeSlotId === scheduledShift.timeSlotId
        );

        let assignedEmployees: string[] = [];

        if (shiftPattern) {
          assignedEmployees = assignmentResult.assignments[shiftPattern.id] || [];
          console.log(`📝 Updating scheduled shift ${scheduledShift.id} (Day ${dayOfWeek}, TimeSlot ${scheduledShift.timeSlotId}) with`, assignedEmployees, 'employees');

          if (assignedEmployees.length === 0) {
            console.warn(`⚠️ No assignments found for shift pattern ${shiftPattern.id}`);
            console.log('🔍 Available assignment keys:', Object.keys(assignmentResult.assignments));
          }
        } else {
          console.warn(`⚠️ No shift pattern found for scheduled shift ${scheduledShift.id} (Day ${dayOfWeek}, TimeSlot ${scheduledShift.timeSlotId})`);
        }

        try {
          // Update the scheduled shift with assigned employees
          await shiftAssignmentService.updateScheduledShift(scheduledShift.id, {
            assignedEmployees
          });

          console.log(`✅ Successfully updated scheduled shift ${scheduledShift.id}`);
        } catch (error) {
          console.error(`❌ Failed to update shift ${scheduledShift.id}:`, error);
          throw error;
        }
      });

      await Promise.all(updatePromises);

      // Update plan status to published
      console.log('🔄 Updating plan status to published...');
      await shiftPlanService.updateShiftPlan(shiftPlan.id, {
        status: 'published'
      });

      // Reload all data to reflect changes
      const [reloadedPlan, reloadedShifts] = await Promise.all([
        shiftPlanService.getShiftPlan(shiftPlan.id),
        shiftAssignmentService.getScheduledShiftsForPlan(shiftPlan.id)
      ]);

      setShiftPlan(reloadedPlan);
      setScheduledShifts(reloadedShifts);

      setShowAssignmentPreview(false);
      setAssignmentResult(null);

      console.log('✅ Publishing completed, modal closed');

      showNotification({
        type: 'success',
        title: 'Erfolg',
        message: 'Schichtplan wurde erfolgreich veröffentlicht!'
      });

    } catch (error) {
      console.error('❌ Error publishing shift plan:', error);

      let message = 'Unbekannter Fehler';
      if (error instanceof Error) {
        message = error.message;
      }

      showNotification({
        type: 'error',
        title: 'Fehler',
        message: `Schichtplan konnte nicht veröffentlicht werden: ${message}`
      });
    } finally {
      setPublishing(false);
    }
  };

  const refreshAllAvailabilities = async (): Promise<EmployeeAvailability[]> => {
    try {
      console.log('🔄 Force refreshing ALL availabilities with error handling...');

      if (!id) {
        console.error('❌ No plan ID available');
        return [];
      }

      const availabilityPromises = employees
        .filter(emp => emp.isActive)
        .map(async (emp) => {
          try {
            return await employeeService.getAvailabilities(emp.id);
          } catch (error) {
            console.error(`❌ Failed to load availabilities for ${emp.email}:`, error);
            return []; // Return empty array instead of failing entire operation
          }
        });

      const allAvailabilities = await Promise.all(availabilityPromises);
      const flattenedAvailabilities = allAvailabilities.flat();

      // More robust filtering
      const planAvailabilities = flattenedAvailabilities.filter(
        availability => availability && availability.planId === id
      );

      console.log(`✅ Successfully refreshed ${planAvailabilities.length} availabilities for plan ${id}`);

      // IMMEDIATELY update state
      setAvailabilities(planAvailabilities);

      return planAvailabilities;
    } catch (error) {
      console.error('❌ Critical error refreshing availabilities:', error);
      // DON'T return old data - throw error or return empty array
      throw new Error('Failed to refresh availabilities: ' + error);
    }
  };

  const debugShiftMatching = () => {
    if (!shiftPlan || !scheduledShifts.length) return;

    console.log('🔍 DEBUG: Shift Pattern to Scheduled Shift Matching');
    console.log('==================================================');

    shiftPlan.shifts?.forEach(shiftPattern => {
      const matchingScheduledShifts = scheduledShifts.filter(scheduled => {
        const dayOfWeek = getDayOfWeek(scheduled.date);
        return dayOfWeek === shiftPattern.dayOfWeek &&
          scheduled.timeSlotId === shiftPattern.timeSlotId;
      });

      console.log(`📅 Shift Pattern: ${shiftPattern.id}`);
      console.log(`   - Day: ${shiftPattern.dayOfWeek}, TimeSlot: ${shiftPattern.timeSlotId}`);
      console.log(`   - Matching scheduled shifts: ${matchingScheduledShifts.length}`);

      if (assignmentResult) {
        const assignments = assignmentResult.assignments[shiftPattern.id] || [];
        console.log(`   - Assignments: ${assignments.length} employees`);
      }
    });
  };

  // Rufe die Debug-Funktion auf, wenn Assignment-Ergebnisse geladen werden
  useEffect(() => {
    if (assignmentResult && shiftPlan) {
      debugShiftMatching();
    }
  }, [assignmentResult, shiftPlan]);

  const canPublish = () => {
    if (!shiftPlan || shiftPlan.status === 'published') return false;

    // Check if all active employees have set their availabilities
    const employeesWithoutAvailabilities = employees.filter(emp => {
      const empAvailabilities = availabilities.filter(avail => avail.employeeId === emp.id);
      return empAvailabilities.length === 0;
    });

    return employeesWithoutAvailabilities.length === 0;
  };

  const canPublishAssignment = (): boolean => {
    if (!assignmentResult) return false;

    // Check if assignment was successful
    if (assignmentResult.success === false) return false;

    // Check if there are any critical violations
    const hasCriticalViolations = assignmentResult.violations.some(v =>
      v.includes('ERROR:') || v.includes('KRITISCH:')
    );

    return !hasCriticalViolations;
  };

  const getAvailabilityStatus = () => {
    const totalEmployees = employees.length;
    const employeesWithAvailabilities = new Set(
      availabilities.map(avail => avail.employeeId)
    ).size;

    return {
      completed: employeesWithAvailabilities,
      total: totalEmployees,
      percentage: Math.round((employeesWithAvailabilities / totalEmployees) * 100)
    };
  };

  const reloadAvailabilities = async () => {
    try {
      console.log('🔄 Lade Verfügbarkeiten neu...');

      // Load availabilities for all employees
      const availabilityPromises = employees
        .filter(emp => emp.isActive)
        .map(emp => employeeService.getAvailabilities(emp.id));

      const allAvailabilities = await Promise.all(availabilityPromises);
      const flattenedAvailabilities = allAvailabilities.flat();

      // Filter availabilities to only include those for the current shift plan
      const planAvailabilities = flattenedAvailabilities.filter(
        availability => availability.planId === id
      );

      setAvailabilities(planAvailabilities);
      console.log('✅ Verfügbarkeiten neu geladen:', planAvailabilities.length);

    } catch (error) {
      console.error('❌ Fehler beim Neuladen der Verfügbarkeiten:', error);
    }
  };

  const getAssignmentsForScheduledShift = (scheduledShift: ScheduledShift): string[] => {
    if (!assignmentResult) return [];

    const dayOfWeek = getDayOfWeek(scheduledShift.date);

    // Find the corresponding shift pattern for this day and time slot
    const shiftPattern = shiftPlan?.shifts?.find(shift =>
      shift.dayOfWeek === dayOfWeek &&
      shift.timeSlotId === scheduledShift.timeSlotId
    );

    if (shiftPattern && assignmentResult.assignments[shiftPattern.id]) {
      console.log(`✅ Found assignments for shift pattern ${shiftPattern.id}:`, assignmentResult.assignments[shiftPattern.id]);
      return assignmentResult.assignments[shiftPattern.id];
    }

    // Fallback: Check if there's a direct match with scheduled shift ID (unlikely)
    if (assignmentResult.assignments[scheduledShift.id]) {
      console.log(`⚠️ Using direct scheduled shift assignment for ${scheduledShift.id}`);
      return assignmentResult.assignments[scheduledShift.id];
    }

    console.warn(`❌ No assignments found for scheduled shift ${scheduledShift.id} (Day ${dayOfWeek}, TimeSlot ${scheduledShift.timeSlotId})`);
    return [];
  };

  // Render timetable using the same structure as AvailabilityManager
  const renderTimetable = () => {
    const { days, allTimeSlots } = getTimetableData();
    const validation = validateTimetableStructure();

    if (days.length === 0 || allTimeSlots.length === 0) {
      return (
        <div style={{
          padding: '40px',
          textAlign: 'center',
          backgroundColor: '#f8f9fa',
          color: '#6c757d',
          borderRadius: '8px',
          border: '1px solid #e9ecef'
        }}>
          <div style={{ fontSize: '48px', marginBottom: '20px' }}>📅</div>
          <h4>Keine Shifts im Plan definiert</h4>
          <p>Der Schichtplan hat keine Shifts definiert oder keine Zeit-Slots konfiguriert.</p>
        </div>
      );
    }

    return (
      <div style={{
        marginBottom: '30px',
        border: '1px solid #e0e0e0',
        borderRadius: '8px',
        overflow: 'hidden'
      }}>
        <div style={{
          backgroundColor: '#2c3e50',
          color: 'white',
          padding: '15px 20px',
          fontWeight: 'bold'
        }}>
          Schichtplan
          <div style={{ fontSize: '14px', fontWeight: 'normal', marginTop: '5px' }}>
            {allTimeSlots.length} Zeitslots • {days.length} Tage • Zeitbasierte Darstellung
          </div>
        </div>

        {/* Validation Warnings - SAME AS AVAILABILITYMANAGER */}
        {!validation.isValid && (
          <div style={{
            backgroundColor: '#fff3cd',
            border: '1px solid #ffeaa7',
            padding: '15px',
            margin: '10px'
          }}>
            <h4 style={{ margin: '0 0 10px 0', color: '#856404' }}>⚠️ Validierungswarnungen:</h4>
            <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '12px' }}>
              {validation.errors.map((error, index) => (
                <li key={index}>{error}</li>
              ))}
            </ul>
          </div>
        )}
        <div style={{ overflowX: 'auto' }}>
          <table style={{
            width: '100%',
            borderCollapse: 'collapse',
            backgroundColor: 'white'
          }}>
            <thead>
              <tr style={{ backgroundColor: '#f8f9fa' }}>
                <th style={{
                  padding: '12px 16px',
                  textAlign: 'left',
                  border: '1px solid #dee2e6',
                  fontWeight: 'bold',
                  minWidth: '120px'
                }}>
                  Schicht (Zeit)
                </th>
                {days.map(weekday => (
                  <th key={weekday.id} style={{
                    padding: '12px 16px',
                    textAlign: 'center',
                    border: '1px solid #dee2e6',
                    fontWeight: 'bold',
                    minWidth: '120px'
                  }}>
                    {weekday.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {allTimeSlots.map((timeSlot, timeSlotIndex) => (
                <tr key={timeSlot.id} style={{
                  backgroundColor: timeSlotIndex % 2 === 0 ? 'white' : '#f8f9fa'
                }}>
                  <td style={{
                    padding: '12px 16px',
                    border: '1px solid #dee2e6',
                    fontWeight: '500',
                    backgroundColor: '#f8f9fa',
                    position: 'sticky',
                    left: 0
                  }}>
                    <div style={{ fontWeight: 'bold' }}>
                      {timeSlot.name}
                    </div>
                    <div style={{ fontSize: '14px', color: '#666' }}>
                      {formatTime(timeSlot.startTime)} - {formatTime(timeSlot.endTime)}
                    </div>
                  </td>
                  {days.map(weekday => {
                    const shift = timeSlot.shiftsByDay[weekday.id];

                    if (!shift) {
                      return (
                        <td key={weekday.id} style={{
                          padding: '12px 16px',
                          border: '1px solid #dee2e6',
                          textAlign: 'center',
                          backgroundColor: '#f8f9fa',
                          color: '#ccc',
                          fontStyle: 'italic'
                        }}>
                          Keine Schicht
                        </td>
                      );
                    }

                    // Validation: Check if shift has correct timeSlotId and dayOfWeek - SAME AS AVAILABILITYMANAGER
                    const isValidShift = shift.timeSlotId === timeSlot.id && shift.dayOfWeek === weekday.id;

                    let assignedEmployees: string[] = [];
                    let displayContent: React.ReactNode = null;

                    // Helper function to create employee boxes
                    const createEmployeeBoxes = (employeeIds: string[]) => {
                      return employeeIds.map(empId => {
                        const employee = employees.find(emp => emp.id === empId);
                        if (!employee) return null;

                        // Determine background color based on employee role
                        let backgroundColor = '#642ab5'; // Default: non-trainee personnel (purple)

                        if (employee.isTrainee) {
                          backgroundColor = '#cda8f0'; // Trainee
                        } else if (employee.employeeType === 'manager') {
                          backgroundColor = '#CC0000'; // Manager
                        }

                        return (
                          <div
                            key={empId}
                            style={{
                              backgroundColor,
                              color: 'white',
                              padding: '4px 8px',
                              borderRadius: '4px',
                              marginBottom: '2px',
                              fontSize: '12px',
                              textAlign: 'center',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis'
                            }}
                            title={`${employee.firstname} ${employee.lastname}${employee.isTrainee ? ' (Trainee)' : ''}`}
                          >
                            {employee.firstname} {employee.lastname}
                          </div>
                        );
                      }).filter(Boolean);
                    };

                    // Helper function to get fallback content
                    const getFallbackContent = () => {
                      const shiftsForSlot = shiftPlan?.shifts?.filter(s =>
                        s.dayOfWeek === weekday.id &&
                        s.timeSlotId === timeSlot.id
                      ) || [];
                      const totalRequired = shiftsForSlot.reduce((sum, s) => sum + s.requiredEmployees, 0);
                      return totalRequired === 0 ? '-' : `0/${totalRequired}`;
                    };

                    if (shiftPlan?.status === 'published') {
                      // For published plans, use actual assignments from scheduled shifts
                      const scheduledShift = scheduledShifts.find(scheduled => {
                        const scheduledDayOfWeek = getDayOfWeek(scheduled.date);
                        return scheduledDayOfWeek === weekday.id &&
                          scheduled.timeSlotId === timeSlot.id;
                      });

                      if (scheduledShift) {
                        assignedEmployees = scheduledShift.assignedEmployees || [];

                        // Log if we're still seeing old data
                        if (assignedEmployees.length > 0) {
                          console.warn(`⚠️ Found non-empty assignments for ${weekday.name} ${timeSlot.name}:`, assignedEmployees);
                        }

                        const employeeBoxes = createEmployeeBoxes(assignedEmployees);
                        displayContent = employeeBoxes.length > 0 ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            {employeeBoxes}
                          </div>
                        ) : (
                          <div style={{ color: '#666', fontStyle: 'italic' }}>
                            {getFallbackContent()}
                          </div>
                        );
                      }
                    } else if (assignmentResult) {
                      // For draft with preview, use assignment result
                      const scheduledShift = scheduledShifts.find(scheduled => {
                        const scheduledDayOfWeek = getDayOfWeek(scheduled.date);
                        return scheduledDayOfWeek === weekday.id &&
                          scheduled.timeSlotId === timeSlot.id;
                      });

                      if (scheduledShift) {
                        assignedEmployees = getAssignmentsForScheduledShift(scheduledShift);
                        const employeeBoxes = createEmployeeBoxes(assignedEmployees);
                        displayContent = employeeBoxes.length > 0 ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            {employeeBoxes}
                          </div>
                        ) : (
                          <div style={{ color: '#666', fontStyle: 'italic' }}>
                            {getFallbackContent()}
                          </div>
                        );
                      }
                    }

                    // If no display content set yet, use fallback
                    if (!displayContent) {
                      displayContent = (
                        <div style={{ color: '#666', fontStyle: 'italic' }}>
                          {getFallbackContent()}
                        </div>
                      );
                    }

                    return (
                      <td key={weekday.id} style={{
                        padding: '12px 16px',
                        border: '1px solid #dee2e6',
                        textAlign: 'center',
                        backgroundColor: !isValidShift ? '#fff3cd' : (assignedEmployees.length > 0 ? '#e8f5e8' : 'transparent'),
                        color: assignedEmployees.length > 0 ? '#2c3e50' : '#666',
                        fontSize: assignedEmployees.length > 0 ? '14px' : 'inherit',
                        position: 'relative'
                      }}>
                        {/* Validation indicator - SAME AS AVAILABILITYMANAGER */}
                        {!isValidShift && (
                          <div style={{
                            position: 'absolute',
                            top: '2px',
                            right: '2px',
                            backgroundColor: '#f39c12',
                            color: 'white',
                            borderRadius: '50%',
                            width: '16px',
                            height: '16px',
                            fontSize: '10px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                            title={`Shift Validierung: timeSlotId=${shift.timeSlotId}, dayOfWeek=${shift.dayOfWeek}`}
                          >
                            ⚠️
                          </div>
                        )}

                        {displayContent}

                        {/* Shift debug info - SAME AS AVAILABILITYMANAGER */}
                        <div style={{
                          fontSize: '10px',
                          color: '#666',
                          marginTop: '4px',
                          textAlign: 'left',
                          fontFamily: 'monospace'
                        }}>
                          {!isValidShift && (
                            <div style={{ color: '#e74c3c', fontWeight: 'bold' }}>
                              VALIDATION ERROR
                            </div>
                          )}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  if (loading) return <div>Lade Schichtplan...</div>;
  if (!shiftPlan) return <div>Schichtplan nicht gefunden</div>;

  const { days, allTimeSlots } = getTimetableData();
  const availabilityStatus = getAvailabilityStatus();
  const validation = validateTimetableStructure();

  return (
    <div style={{ padding: '20px' }}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <h1>{shiftPlan.name}</h1>
          <div className={styles.headerMeta}>
            <div style={{
              backgroundColor: shiftPlan.status === 'published' ? '#d5f4e6' :
                shiftPlan.status === 'archived' ? '#f8f9fa' : '#fef5e7',
              color: shiftPlan.status === 'published' ? '#27ae60' :
                shiftPlan.status === 'archived' ? '#95a5a6' : '#f39c12',
              padding: '4px 12px',
              borderRadius: '12px',
              fontSize: '13px',
              fontWeight: 'bold',
            }}>
              {shiftPlan.status === 'published' ? 'Veröffentlicht' :
                shiftPlan.status === 'archived' ? 'Archiviert' : 'Entwurf'}
            </div>
            <span className={styles.metaText}>
              {shiftPlan.startDate && shiftPlan.endDate &&
                `Zeitraum: ${formatDate(shiftPlan.startDate)} - ${formatDate(shiftPlan.endDate)}`
              }
              {shiftPlan.shifts && shiftPlan.timeSlots &&
                ` | ${shiftPlan.shifts.length} Schichten | ${shiftPlan.timeSlots.length} Zeitslots`
              }
            </span>
          </div>
          {shiftPlan.description && (
            <p className={styles.description}>{shiftPlan.description}</p>
          )}
        </div>
        <div className={styles.headerActions}>
          <button
            onClick={() => navigate('/shift-plans')}
            className={styles.backButton}
          >
            Zurück
          </button>
        </div>
      </div>

      {/* "Zuweisungen neu berechnen" button */}
      {shiftPlan.status === 'published' && hasRole(['admin', 'maintenance']) && (
        <button
          onClick={handleRecreateAssignments}
          disabled={recreating}
          style={{
            padding: '10px 20px',
            backgroundColor: '#e74c3c',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: recreating ? 'not-allowed' : 'pointer',
            fontWeight: 'bold'
          }}
        >
          {recreating ? 'Lösche Zuweisungen...' : 'Zuweisungen neu berechnen'}
        </button>
      )}

      {/* Availability Status - only show for drafts */}
      {shiftPlan.status === 'draft' && (
        <div style={{
          backgroundColor: 'white',
          borderRadius: '8px',
          padding: '20px',
          marginBottom: '20px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
        }}>
          <h3>Veröffentlichungsvoraussetzungen</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '15px' }}>
            <div>
              <div style={{ fontSize: '14px', color: '#666', marginBottom: '5px' }}>
                Verfügbarkeitseinträge:
              </div>
              <div style={{ fontSize: '18px', fontWeight: 'bold' }}>
                {availabilityStatus.completed} / {availabilityStatus.total} Mitarbeiter
              </div>
              <div style={{
                width: '200px',
                height: '8px',
                backgroundColor: '#e0e0e0',
                borderRadius: '4px',
                marginTop: '5px',
                overflow: 'hidden'
              }}>
                <div
                  style={{
                    width: `${availabilityStatus.percentage}%`,
                    height: '100%',
                    backgroundColor: availabilityStatus.percentage === 100 ? '#2ecc71' : '#f1c40f',
                    transition: 'all 0.3s ease'
                  }}
                />
              </div>
            </div>

            {hasRole(['admin', 'maintenance']) && (
              <div>
                <button
                  onClick={handlePreviewAssignment}
                  disabled={!canPublish() || publishing}
                  style={{
                    padding: '10px 20px',
                    backgroundColor: canPublish() ? '#3498db' : '#95a5a6',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: canPublish() ? 'pointer' : 'not-allowed',
                    fontWeight: 'bold'
                  }}
                >
                  {publishing ? 'Berechne...' : 'Automatisch zuweisen'}
                </button>

                {!canPublish() && (
                  <div style={{ fontSize: '12px', color: '#666', marginTop: '5px' }}>
                    {availabilityStatus.percentage === 100
                      ? 'Bereit zur Berechnung'
                      : `${availabilityStatus.total - availabilityStatus.completed} Mitarbeiter müssen noch Verfügbarkeit eintragen`}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Plan Structure Info */}
          <div style={{
            backgroundColor: '#e8f4fd',
            border: '1px solid #b8d4f0',
            borderRadius: '4px',
            padding: '12px 16px',
            fontSize: '14px'
          }}>
            <strong>Plan-Struktur:</strong> {allTimeSlots.length} Schichttypen an {days.length} Tagen
          </div>
        </div>
      )}

      {/* Assignment Preview Modal */}
      {(showAssignmentPreview || assignmentResult) && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '8px',
            padding: '30px',
            maxWidth: '800px',
            maxHeight: '80vh',
            overflow: 'auto',
            width: '90%'
          }}>
            <h2>Wochenmuster-Zuordnung</h2>

            {/* Detaillierter Reparatur-Bericht anzeigen */}
            {assignmentResult?.resolutionReport && (
              <div style={{
                backgroundColor: '#f8f9fa',
                border: '1px solid #e9ecef',
                borderRadius: '4px',
                padding: '15px',
                marginBottom: '20px',
                fontSize: '14px',
                maxHeight: '400px',
                overflow: 'auto'
              }}>
                <h4 style={{ color: '#2c3e50', marginTop: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span>📋</span> Detaillierter Reparatur-Bericht
                </h4>
                <div style={{
                  fontFamily: 'monospace',
                  fontSize: '12px',
                  lineHeight: '1.4'
                }}>
                  {assignmentResult.resolutionReport.map((line, index) => {
                    let color = '#2c3e50';
                    let fontWeight = 'normal';

                    if (line.includes('✅') || line.includes('ALLES KRITISCHEN PROBLEME BEHOBEN')) {
                      color = '#2ecc71';
                      fontWeight = 'bold';
                    } else if (line.includes('❌') || line.includes('KRITISCHEN PROBLEME')) {
                      color = '#e74c3c';
                      fontWeight = 'bold';
                    } else if (line.includes('⚠️')) {
                      color = '#f39c12';
                    } else if (line.includes('📊') || line.includes('🔧') || line.includes('📅') || line.includes('🚨') || line.includes('🛠️') || line.includes('💡') || line.includes('🎯')) {
                      color = '#3498db';
                      fontWeight = 'bold';
                    } else if (line.startsWith('   •') || line.startsWith('   -')) {
                      color = '#7f8c8d';
                    }

                    return (
                      <div key={index} style={{
                        color,
                        fontWeight,
                        marginBottom: line === '' ? '5px' : '2px',
                        paddingLeft: line.startsWith('   ') ? '20px' : '0px'
                      }}>
                        {line}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ZUSAMMENFASSUNG */}
            {assignmentResult && (
              <div style={{ marginBottom: '20px' }}>
                <h4>Zusammenfassung:</h4>

                {/* Entscheidung basierend auf tatsächlichen kritischen Problemen */}
                {(assignmentResult.violations.length === 0) || assignmentResult.success == true ? (
                  <div style={{
                    padding: '15px',
                    backgroundColor: '#d4edda',
                    border: '1px solid #c3e6cb',
                    borderRadius: '4px',
                    color: '#155724',
                    marginBottom: '15px'
                  }}>
                    <h5 style={{ margin: '0 0 10px 0', color: '#155724' }}>✅ Bereit zur Veröffentlichung</h5>
                    <p style={{ margin: 0 }}>
                      Alle kritischen Probleme wurden behoben. Der Schichtplan kann veröffentlicht werden.
                    </p>
                  </div>
                ) : (
                  <div style={{
                    padding: '15px',
                    backgroundColor: '#f8d7da',
                    border: '1px solid #f5c6cb',
                    borderRadius: '4px',
                    color: '#721c24',
                    marginBottom: '15px'
                  }}>
                    <h5 style={{ margin: '0 0 10px 0', color: '#721c24' }}>❌ Kritische Probleme</h5>
                    <p style={{ margin: '0 0 10px 0' }}>
                      Folgende kritische Probleme müssen behoben werden, bevor der Plan veröffentlicht werden kann:
                    </p>
                    <ul style={{ margin: 0, paddingLeft: '20px' }}>
                      {assignmentResult.violations
                        .filter(v => v.includes('ERROR:') || v.includes('❌ KRITISCH:'))
                        .map((violation, index) => (
                          <li key={index} style={{ fontSize: '14px' }}>
                            {violation.replace('ERROR: ', '').replace('❌ KRITISCH: ', '')}
                          </li>
                        ))}
                    </ul>
                  </div>
                )}

                {/* Warnungen separat anzeigen - NUR wenn welche vorhanden sind */}
                {assignmentResult.violations.some(v => v.includes('WARNING:') || v.includes('⚠️')) && (
                  <div style={{
                    padding: '10px',
                    backgroundColor: '#fff3cd',
                    border: '1px solid #ffeaa7',
                    borderRadius: '4px',
                    color: '#856404'
                  }}>
                    <h6 style={{ margin: '0 0 5px 0', color: '#856404' }}>
                      ⚠️ Hinweise & Warnungen
                    </h6>
                    <ul style={{ margin: 0, paddingLeft: '20px' }}>
                      {assignmentResult.violations
                        .filter(v => v.includes('WARNING:') || v.includes('⚠️'))
                        .map((warning, index) => (
                          <li key={index} style={{ fontSize: '13px' }}>
                            {warning.replace('WARNING: ', '').replace('⚠️ WARNHINWEIS: ', '')}
                          </li>
                        ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => {
                  setShowAssignmentPreview(false);
                  setAssignmentResult(null);
                }}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#95a5a6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                Abbrechen
              </button>

              {/* BUTTON zum publishen */}
              <button
                onClick={handlePublish}
                disabled={publishing || !canPublishAssignment()}
                style={{
                  padding: '10px 20px',
                  backgroundColor: canPublishAssignment() ? '#2ecc71' : '#95a5a6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: canPublishAssignment() ? 'pointer' : 'not-allowed',
                  fontWeight: 'bold',
                  fontSize: '16px'
                }}
              >
                {publishing ? 'Veröffentliche...' : (
                  assignmentResult ? (
                    canPublishAssignment()
                      ? 'Schichtplan veröffentlichen'
                      : 'Kritische Probleme müssen behoben werden'
                  ) : 'Lade Zuordnungen...'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Timetable */}
      <div style={{
        backgroundColor: 'white',
        borderRadius: '8px',
        padding: '20px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
      }}>
        <h3>
          Schichtplan
          {shiftPlan.status === 'published' && ' (Aktuelle Zuweisungen)'}
          {assignmentResult && shiftPlan.status === 'draft' && ' (Exemplarische Woche)'}
        </h3>

        {renderTimetable()}

        {shiftPlan.status === 'published' && hasRole(['admin', 'maintenance']) && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            marginTop: '20px',
            gap: '10px'
          }}>
            {/* Export Dropdown Container */}
            <div
              ref={dropdownRef}
              style={{
                transform: exportType ? `translateX(-${dropdownWidth}px)` : 'translateX(0)',
                transition: 'transform 0.3s ease-in-out',
                position: 'relative'
              }}
            >
              <select
                value={exportType || ''}
                onChange={(e) => setExportType(e.target.value as 'pdf' | 'excel' | null)}
                style={{
                  padding: '10px 20px',
                  backgroundColor: 'white',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  minWidth: '120px'
                }}
              >
                <option value="">Export</option>
                <option value="pdf">PDF</option>
                <option value="excel">Excel</option>
              </select>
            </div>

            {/* Export Button - erscheint nur wenn eine Option ausgewählt ist */}
            {exportType && (
              <button
                onClick={handleExport}
                disabled={exporting}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#51258f',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: exporting ? 'not-allowed' : 'pointer',
                  fontWeight: 'bold',
                  opacity: exporting ? 0.7 : 1,
                  transition: 'opacity 0.2s ease'
                }}
              >
                {exporting ? '🔄 Exportiert...' : 'EXPORT'}
              </button>
            )}
          </div>
        )}

        {/* Summary */}
        {days.length > 0 && (
          <div style={{
            marginTop: '20px',
            padding: '12px 16px',
            backgroundColor: shiftPlan.status === 'published' ? '#d4edda' : '#e8f4fd',
            borderRadius: '4px',
            border: shiftPlan.status === 'published' ? '1px solid #c3e6cb' : '1px solid #b8d4f0',
            fontSize: '14px'
          }}>
            <strong>Legende:</strong> {
              shiftPlan.status === 'published'
                ? 'Angezeigt werden die aktuell zugewiesenen Mitarbeiter'
                : assignmentResult
                  ? 'Angezeigt werden die vorgeschlagenen Mitarbeiter für eine exemplarische Woche'
                  : 'Angezeigt wird "zugewiesene/benötigte Mitarbeiter" pro Schicht und Wochentag'
            }
          </div>
        )}
      </div>
    </div>
  );
};

export default ShiftPlanView;