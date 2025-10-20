// frontend/src/pages/ShiftPlans/ShiftPlanView.tsx - UPDATED
import React, { useState, useEffect } from 'react';
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

// Local interface extensions (same as AvailabilityManager)
interface ExtendedTimeSlot extends TimeSlot {
  displayName?: string;
}

const weekdays = [
  { id: 1, name: 'Mo' },
  { id: 2, name: 'Di' },
  { id: 3, name: 'Mi' },
  { id: 4, name: 'Do' },
  { id: 5, name: 'Fr' },
  { id: 6, name: 'Sa' },
  { id: 7, name: 'So' }
];

const ShiftPlanView: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { hasRole, user } = useAuth();
  const { showNotification } = useNotification();
  
  const [shiftPlan, setShiftPlan] = useState<ShiftPlan | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [availabilities, setAvailabilities] = useState<EmployeeAvailability[]>([]);
  const [assignmentResult, setAssignmentResult] = useState<AssignmentResult | null>(null); // Add this line
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [scheduledShifts, setScheduledShifts] = useState<ScheduledShift[]>([]);
  const [showAssignmentPreview, setShowAssignmentPreview] = useState(false);
  const [recreating, setRecreating] = useState(false);


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

  useEffect(() => {
    if (assignmentResult) {
      console.log("🔄 assignmentResult UPDATED:", {
        success: assignmentResult.success,
        assignmentsCount: Object.keys(assignmentResult.assignments).length,
        assignmentKeys: Object.keys(assignmentResult.assignments).slice(0, 5), // First 5 keys
        violations: assignmentResult.violations.length
      });
      
      // Log all assignments with their keys
      Object.entries(assignmentResult.assignments).forEach(([key, empIds]) => {
        console.log(`   🗂️ Assignment Key: ${key}`);
        console.log(`      Employees: ${empIds.join(', ')}`);
        
        // Try to identify what this key represents
        const isUuid = key.length === 36; // UUID format
        console.log(`      Type: ${isUuid ? 'UUID (likely scheduled shift)' : 'Pattern (likely shift pattern)'}`);
      });
    }
  }, [assignmentResult]);

  useEffect(() => {
    (window as any).debugRenderLogic = debugRenderLogic;
    return () => { (window as any).debugRenderLogic = undefined; };
  }, [shiftPlan, scheduledShifts]);

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

      // Load availabilities
      const availabilityPromises = employeesData
        .filter(emp => emp.isActive)
        .map(emp => employeeService.getAvailabilities(emp.id));
      
      const allAvailabilities = await Promise.all(availabilityPromises);
      const flattenedAvailabilities = allAvailabilities.flat();
      
      const planAvailabilities = flattenedAvailabilities.filter(
        availability => availability.planId === id
      );
      
      setAvailabilities(planAvailabilities);

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

  const debugRenderLogic = () => {
    if (!shiftPlan) return;
    
    console.log('🔍 RENDER LOGIC DEBUG:');
    console.log('=====================');
    
    const { days, allTimeSlots, timeSlotsByDay } = getTimetableData();
    
    console.log('📊 TABLE STRUCTURE:');
    console.log('- Days in table:', days.length);
    console.log('- TimeSlots in table:', allTimeSlots.length);
    console.log('- Days with data:', Object.keys(timeSlotsByDay).length);
    
    // Zeige die tatsächliche Struktur der Tabelle
    console.log('\n📅 ACTUAL TABLE DAYS:');
    days.forEach(day => {
      const slotsForDay = timeSlotsByDay[day.id] || [];
      console.log(`- ${day.name}: ${slotsForDay.length} time slots`);
    });
    
    console.log('\n⏰ ACTUAL TIME SLOTS:');
    allTimeSlots.forEach(slot => {
      console.log(`- ${slot.name} (${slot.startTime}-${slot.endTime})`);
    });
    
    // Prüfe wie viele Scheduled Shifts tatsächlich gerendert werden
    console.log('\n🔍 SCHEDULED SHIFTS RENDER ANALYSIS:');
    
    let totalRenderedShifts = 0;
    let shiftsWithAssignments = 0;
    
    days.forEach(day => {
      const slotsForDay = timeSlotsByDay[day.id] || [];
      slotsForDay.forEach(timeSlot => {
        totalRenderedShifts++;
        
        // Finde den entsprechenden Scheduled Shift
        const scheduledShift = scheduledShifts.find(scheduled => {
          const scheduledDayOfWeek = getDayOfWeek(scheduled.date);
          return scheduledDayOfWeek === day.id && 
                scheduled.timeSlotId === timeSlot.id;
        });
        
        if (scheduledShift && scheduledShift.assignedEmployees && scheduledShift.assignedEmployees.length > 0) {
          shiftsWithAssignments++;
        }
      });
    });
    
    console.log(`- Total shifts in table: ${totalRenderedShifts}`);
    console.log(`- Shifts with assignments: ${shiftsWithAssignments}`);
    console.log(`- Total scheduled shifts: ${scheduledShifts.length}`);
    console.log(`- Coverage: ${Math.round((totalRenderedShifts / scheduledShifts.length) * 100)}%`);
    
    // Problem-Analyse
    if (totalRenderedShifts < scheduledShifts.length) {
      console.log('\n🚨 PROBLEM: Table is not showing all scheduled shifts!');
      console.log('💡 The table structure (days × timeSlots) is smaller than actual scheduled shifts');
      
      // Zeige die fehlenden Shifts
      const missingShifts = scheduledShifts.filter(scheduled => {
        const dayOfWeek = getDayOfWeek(scheduled.date);
        const timeSlotExists = allTimeSlots.some(ts => ts.id === scheduled.timeSlotId);
        const dayExists = days.some(day => day.id === dayOfWeek);
        
        return !(timeSlotExists && dayExists);
      });
      
      if (missingShifts.length > 0) {
        console.log(`❌ ${missingShifts.length} shifts cannot be rendered in table:`);
        missingShifts.slice(0, 5).forEach(shift => {
          const dayOfWeek = getDayOfWeek(shift.date);
          const timeSlot = shiftPlan.timeSlots?.find(ts => ts.id === shift.timeSlotId);
          console.log(`   - ${shift.date} (Day ${dayOfWeek}): ${timeSlot?.name || 'Unknown'} - ${shift.assignedEmployees?.length || 0} assignments`);
        });
      }
    }
  };

  // Extract plan-specific shifts using the same logic as AvailabilityManager
  const getTimetableData = () => {
    if (!shiftPlan || !shiftPlan.shifts || !shiftPlan.timeSlots) {
      return { days: [], timeSlotsByDay: {}, allTimeSlots: [] };
    }

    // Group shifts by day
    const shiftsByDay = shiftPlan.shifts.reduce((acc, shift) => {
      if (!acc[shift.dayOfWeek]) {
        acc[shift.dayOfWeek] = [];
      }
      acc[shift.dayOfWeek].push(shift);
      return acc;
    }, {} as Record<number, typeof shiftPlan.shifts>);

    // Get unique days that have shifts
    const days = Array.from(new Set(shiftPlan.shifts.map(shift => shift.dayOfWeek)))
      .sort()
      .map(dayId => {
        return weekdays.find(day => day.id === dayId) || { id: dayId, name: `Tag ${dayId}` };
      });

    // For each day, get the time slots that actually have shifts
    const timeSlotsByDay: Record<number, ExtendedTimeSlot[]> = {};
    
    days.forEach(day => {
      const shiftsForDay = shiftsByDay[day.id] || [];
      const timeSlotIdsForDay = new Set(shiftsForDay.map(shift => shift.timeSlotId));
      
      timeSlotsByDay[day.id] = shiftPlan.timeSlots
        .filter(timeSlot => timeSlotIdsForDay.has(timeSlot.id))
        .map(timeSlot => ({
          ...timeSlot,
          displayName: `${timeSlot.name} (${formatTime(timeSlot.startTime)}-${formatTime(timeSlot.endTime)})`
        }))
        .sort((a, b) => a.startTime.localeCompare(b.startTime));
    });

    // Get all unique time slots across all days for row headers
    const allTimeSlotIds = new Set<string>();
    days.forEach(day => {
      timeSlotsByDay[day.id]?.forEach(timeSlot => {
        allTimeSlotIds.add(timeSlot.id);
      });
    });

    const allTimeSlots = Array.from(allTimeSlotIds)
      .map(timeSlotId => shiftPlan.timeSlots.find(ts => ts.id === timeSlotId))
      .filter(Boolean)
      .map(timeSlot => ({
        ...timeSlot!,
        displayName: `${timeSlot!.name} (${formatTime(timeSlot!.startTime)}-${formatTime(timeSlot!.endTime)})`
      }))
      .sort((a, b) => a.startTime.localeCompare(b.startTime));

    return { days, timeSlotsByDay, allTimeSlots };
  };

  const getDayOfWeek = (dateString: string): number => {
    const date = new Date(dateString);
    return date.getDay() === 0 ? 7 : date.getDay();
  };

  const handlePreviewAssignment = async () => {
    if (!shiftPlan) return;

    try {
      setPublishing(true);
      
      // FORCE COMPLETE REFRESH - don't rely on cached state
      const [refreshedEmployees, refreshedAvailabilities] = await Promise.all([
        // Reload employees fresh
        employeeService.getEmployees().then(emps => emps.filter(emp => emp.isActive)),
        // Reload availabilities fresh
        refreshAllAvailabilities()
      ]);

      console.log('🔄 USING FRESH DATA:');
      console.log('- Employees:', refreshedEmployees.length);
      console.log('- Availabilities:', refreshedAvailabilities.length);

      // ADD THIS: Define constraints object
      const constraints = {
        enforceNoTraineeAlone: true,
        enforceExperiencedWithChef: true,
        maxRepairAttempts: 50,
        targetEmployeesPerShift: 2
      };

      // Use the freshly loaded data, not the state
      const result = await shiftAssignmentService.assignShifts(
        shiftPlan,
        refreshedEmployees,
        refreshedAvailabilities,
        constraints
      );

      // COMPREHENSIVE DEBUGGING
      console.log("🎯 RAW ASSIGNMENT RESULT FROM API:", {
        success: result.success,
        assignmentsCount: Object.keys(result.assignments).length,
        assignmentKeys: Object.keys(result.assignments),
        violations: result.violations.length,
        resolutionReport: result.resolutionReport?.length || 0
      });

      // Log the actual assignments with more context
      Object.entries(result.assignments).forEach(([shiftId, empIds]) => {
        console.log(`   📅 Assignment Key: ${shiftId}`);
        console.log(`      Employees: ${empIds.join(', ')}`);
        
        // Try to identify what type of ID this is
        const isUuid = shiftId.length === 36; // UUID format
        console.log(`      Type: ${isUuid ? 'UUID (likely scheduled shift)' : 'Pattern (likely shift pattern)'}`);
        
        // If it's a UUID, check if it matches any scheduled shift
        if (isUuid) {
          const matchingScheduledShift = scheduledShifts.find(s => s.id === shiftId);
          if (matchingScheduledShift) {
            console.log(`      ✅ Matches scheduled shift: ${matchingScheduledShift.date} - TimeSlot: ${matchingScheduledShift.timeSlotId}`);
          } else {
            console.log(`      ❌ No matching scheduled shift found for UUID`);
          }
        }
      });

      setAssignmentResult(result);
      setShowAssignmentPreview(true);

    } catch (error) {
      console.error('Error during assignment:', error);
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

      const updatePromises = updatedShifts.map(async (scheduledShift) => {
        // ✅ FIX: Map scheduled shift to shift pattern to find assignments
        const dayOfWeek = getDayOfWeek(scheduledShift.date);
        
        // Find the corresponding shift pattern for this day and time slot
        const shiftPattern = shiftPlan.shifts?.find(shift => 
          shift.dayOfWeek === dayOfWeek && 
          shift.timeSlotId === scheduledShift.timeSlotId
        );
        
        let assignedEmployees: string[] = [];
        
        if (shiftPattern) {
          // Look for assignments using the shift pattern ID (what scheduler uses)
          assignedEmployees = assignmentResult.assignments[shiftPattern.id] || [];
          console.log(`📝 Updating scheduled shift ${scheduledShift.id} (Day ${dayOfWeek}, TimeSlot ${scheduledShift.timeSlotId}) with`, assignedEmployees, 'employees');
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

      showNotification({
        type: 'success',
        title: 'Erfolg',
        message: 'Schichtplan wurde erfolgreich veröffentlicht!'
      });

      setShowAssignmentPreview(false);

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

  const validateSchedulingData = (): boolean => {
    console.log('🔍 Validating scheduling data...');
    
    const totalEmployees = employees.length;
    const employeesWithAvailabilities = new Set(
      availabilities.map(avail => avail.employeeId)
    ).size;
    
    const availabilityStatus = {
      totalEmployees,
      employeesWithAvailabilities,
      coverage: Math.round((employeesWithAvailabilities / totalEmployees) * 100)
    };
    
    console.log('📊 Availability Coverage:', availabilityStatus);
    
    // Check if we have ALL employee availabilities
    if (employeesWithAvailabilities < totalEmployees) {
      const missingEmployees = employees.filter(emp => 
        !availabilities.some(avail => avail.employeeId === emp.id)
      );
      
      console.warn('⚠️ Missing availabilities for employees:', 
        missingEmployees.map(emp => emp.email));
      
      return false;
    }
    
    return true;
  };

  const canPublish = () => {
    if (!shiftPlan || shiftPlan.status === 'published') return false;
    
    // Check if all active employees have set their availabilities
    const employeesWithoutAvailabilities = employees.filter(emp => {
      const empAvailabilities = availabilities.filter(avail => avail.employeeId === emp.id);
      return empAvailabilities.length === 0;
    });

    return employeesWithoutAvailabilities.length === 0;
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
    
    // First try direct match with scheduled shift ID
    if (assignmentResult.assignments[scheduledShift.id]) {
      return assignmentResult.assignments[scheduledShift.id];
    }
    
    // If no direct match, try to find by day and timeSlot pattern
    const dayOfWeek = getDayOfWeek(scheduledShift.date);
    const shiftPattern = shiftPlan?.shifts?.find(shift => 
      shift.dayOfWeek === dayOfWeek && 
      shift.timeSlotId === scheduledShift.timeSlotId
    );
    
    if (shiftPattern && assignmentResult.assignments[shiftPattern.id]) {
      return assignmentResult.assignments[shiftPattern.id];
    }
    
    return [];
  };

  // Render timetable using the same structure as AvailabilityManager
  const renderTimetable = () => {
    const { days, allTimeSlots, timeSlotsByDay } = getTimetableData();
    if (!shiftPlan?.id) {
      console.warn("Shift plan ID is missing");
      return null;
    }

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
            {allTimeSlots.length} Schichttypen • {days.length} Tage • Nur tatsächlich im Plan verwendete Schichten
          </div>
        </div>

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
                  minWidth: '200px'
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
              {allTimeSlots.map((timeSlot, timeIndex) => (
                <tr key={timeSlot.id} style={{
                  backgroundColor: timeIndex % 2 === 0 ? 'white' : '#f8f9fa'
                }}>
                  <td style={{
                    padding: '12px 16px',
                    border: '1px solid #dee2e6',
                    fontWeight: '500',
                    backgroundColor: '#f8f9fa'
                  }}>
                    {timeSlot.displayName}
                  </td>
                  {days.map(weekday => {
                    // Check if this time slot exists for this day
                    const timeSlotForDay = timeSlotsByDay[weekday.id]?.find(ts => ts.id === timeSlot.id);
                    
                    if (!timeSlotForDay) {
                      return (
                        <td key={weekday.id} style={{
                          padding: '12px 16px',
                          border: '1px solid #dee2e6',
                          textAlign: 'center',
                          backgroundColor: '#f8f9fa',
                          color: '#ccc',
                          fontStyle: 'italic'
                        }}>
                          -
                        </td>
                      );
                    }

                    let assignedEmployees: string[] = [];
                    let displayText = '';

                    if (shiftPlan?.status === 'published') {
                      // For published plans, use actual assignments from scheduled shifts
                      const scheduledShift = scheduledShifts.find(scheduled => {
                        const scheduledDayOfWeek = getDayOfWeek(scheduled.date);
                        return scheduledDayOfWeek === weekday.id && 
                              scheduled.timeSlotId === timeSlot.id;
                      });
                      
                      if (scheduledShift) {
                        assignedEmployees = scheduledShift.assignedEmployees || [];
                        
                        // DEBUG: Log if we're still seeing old data
                        if (assignedEmployees.length > 0) {
                          console.warn(`⚠️ Found non-empty assignments for ${weekday.name} ${timeSlot.name}:`, assignedEmployees);
                        }
                        
                        displayText = assignedEmployees.map(empId => {
                          const employee = employees.find(emp => emp.id === empId);
                          return employee ? employee.email : 'Unbekannt';
                        }).join(', ');
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
                        displayText = assignedEmployees.map(empId => {
                          const employee = employees.find(emp => emp.id === empId);
                          return employee ? employee.email : 'Unbekannt';
                        }).join(', ');
                      }
                    }

                    // If no assignments yet, show empty or required count
                    if (!displayText) {
                      const shiftsForSlot = shiftPlan?.shifts?.filter(shift => 
                        shift.dayOfWeek === weekday.id && 
                        shift.timeSlotId === timeSlot.id
                      ) || [];
                      
                      const totalRequired = shiftsForSlot.reduce((sum, shift) => 
                        sum + shift.requiredEmployees, 0);
                      
                      // Show "0/2" instead of just "0" to indicate it's empty
                      displayText = `0/${totalRequired}`;
                      
                      // Optional: Show empty state more clearly
                      if (totalRequired === 0) {
                        displayText = '-';
                      }
                    }

                    return (
                      <td key={weekday.id} style={{
                        padding: '12px 16px',
                        border: '1px solid #dee2e6',
                        textAlign: 'center',
                        backgroundColor: assignedEmployees.length > 0 ? '#e8f5e8' : 'transparent',
                        color: assignedEmployees.length > 0 ? '#2c3e50' : '#666',
                        fontSize: assignedEmployees.length > 0 ? '14px' : 'inherit'
                      }}>
                        {displayText}
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


  return (
    <div style={{ padding: '20px' }}>
      {/* Header with Plan Information and Actions */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'flex-start',
        marginBottom: '20px'
      }}>
        <div>
          <h1>{shiftPlan.name}</h1>
          <p style={{ color: '#666', margin: 0 }}>
            {shiftPlan.startDate && shiftPlan.endDate && 
              `Zeitraum: ${formatDate(shiftPlan.startDate)} - ${formatDate(shiftPlan.endDate)}`
            }
          </p>
          <div style={{ 
            display: 'inline-block',
            padding: '4px 12px',
            backgroundColor: shiftPlan.status === 'published' ? '#2ecc71' : '#f1c40f',
            color: 'white',
            borderRadius: '20px',
            fontSize: '14px',
            fontWeight: 'bold',
            marginTop: '5px'
          }}>
            {shiftPlan.status === 'published' ? 'Veröffentlicht' : 'Entwurf'}
          </div>
        </div>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            {shiftPlan.status === 'published' && hasRole(['admin', 'instandhalter']) && (
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
          
          <button
            onClick={() => navigate('/shift-plans')}
            style={{
              padding: '10px 20px',
              backgroundColor: '#95a5a6',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Zurück zur Übersicht
          </button>
        </div>
      </div>

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
            
            {hasRole(['admin', 'instandhalter']) && (
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
      {showAssignmentPreview && assignmentResult && (
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
            overflow: 'auto'
          }}>
            <h2>Wochenmuster-Zuordnung</h2>
            
            {/* Detaillierter Reparatur-Bericht anzeigen */}
            {assignmentResult.resolutionReport && (
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
              
            {/* KORRIGIERTE ZUSAMMENFASSUNG */}
            {assignmentResult && (
              <div style={{ marginBottom: '20px' }}>
                <h4>Zusammenfassung:</h4>
                
                {/* Entscheidung basierend auf tatsächlichen kritischen Problemen */}
                {assignmentResult.violations.filter(v => 
                  v.includes('ERROR:') || v.includes('❌ KRITISCH:')
                ).length === 0 ? (
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
                onClick={() => setShowAssignmentPreview(false)}
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
              
              <button
                onClick={handlePublish}
                disabled={publishing || assignmentResult.violations.filter(v => 
                  v.includes('ERROR:') || v.includes('❌ KRITISCH:')
                ).length > 0}
                style={{
                  padding: '10px 20px',
                  backgroundColor: assignmentResult.violations.filter(v => 
                    v.includes('ERROR:') || v.includes('❌ KRITISCH:')
                  ).length === 0 ? '#2ecc71' : '#95a5a6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: assignmentResult.violations.filter(v => 
                    v.includes('ERROR:') || v.includes('❌ KRITISCH:')
                  ).length === 0 ? 'pointer' : 'not-allowed',
                  fontWeight: 'bold',
                  fontSize: '16px'
                }}
              >
                {publishing ? 'Veröffentliche...' : (
                  assignmentResult.violations.filter(v => 
                    v.includes('ERROR:') || v.includes('❌ KRITISCH:')
                  ).length === 0 
                    ? 'Schichtplan veröffentlichen' 
                    : 'Kritische Probleme müssen behoben werden'
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