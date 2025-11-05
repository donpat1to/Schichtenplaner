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
  const [selectedExportType, setSelectedExportType] = useState('');
  const [dropdownWidth, setDropdownWidth] = useState(0);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

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

  // Measure dropdown width when component mounts or selectedExportType changes
  useEffect(() => {
    if (dropdownRef.current) {
      setDropdownWidth(dropdownRef.current.offsetWidth);
    }
  }, [selectedExportType]);

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
      return (a.startTime || '').localeCompare(b.startTime || '');
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
    if (!shiftPlan || !selectedExportType) return;

    try {
      setExporting(true);

      let blob: Blob;
      if (selectedExportType === 'PDF') {
        // Call the PDF export service
        blob = await shiftPlanService.exportShiftPlanToPDF(shiftPlan.id);
      } else {
        // Call the Excel export service
        blob = await shiftPlanService.exportShiftPlanToExcel(shiftPlan.id);
      }

      // Use file-saver to download the file
      const fileExtension = selectedExportType.toLowerCase();
      saveAs(blob, `Schichtplan_${shiftPlan.name}_${new Date().toISOString().split('T')[0]}.${fileExtension}`);

      showNotification({
        type: 'success',
        title: 'Export erfolgreich',
        message: `Der Schichtplan wurde als ${selectedExportType}-Datei exportiert.`
      });

    } catch (error) {
      console.error(`Error exporting to ${selectedExportType}:`, error);
      showNotification({
        type: 'error',
        title: 'Export fehlgeschlagen',
        message: `Der ${selectedExportType}-Export konnte nicht durchgeführt werden.`
      });
    } finally {
      setExporting(false);
    }
  };

  const handleExportTypeChange = (type: string) => {
    setSelectedExportType(type);
  };

  const handleCancelExport = () => {
    setSelectedExportType('');
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

  // ... (rest of the functions remain the same as in the original file)

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
            {/* Table content remains the same */}
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

        {/* Export Dropdown - Only show when plan is published */}
        {shiftPlan?.status === 'published' && (
          <div style={{
            padding: '15px 20px',
            backgroundColor: '#f8f9fa',
            borderTop: '1px solid #e0e0e0',
            display: 'flex',
            justifyContent: 'flex-end',
            alignItems: 'center'
          }}>
            <div
              ref={containerRef}
              style={{
                position: 'relative',
                display: 'flex',
                gap: '10px',
                alignItems: 'center',
                minHeight: '40px'
              }}
            >
              {/* Export Dropdown - Always visible but moves when option selected */}
              <div
                ref={dropdownRef}
                style={{
                  position: 'relative',
                  transform: selectedExportType ? `translateX(-${dropdownWidth + 10}px)` : 'translateX(0)',
                  transition: 'transform 0.3s ease',
                  zIndex: selectedExportType ? 1 : 2
                }}
              >
                <select
                  value={selectedExportType}
                  onChange={(e) => handleExportTypeChange(e.target.value)}
                  style={{
                    padding: '8px 16px',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    backgroundColor: 'white',
                    cursor: 'pointer',
                    minWidth: '120px'
                  }}
                >
                  <option value="">Export</option>
                  <option value="PDF">PDF</option>
                  <option value="Excel">Excel</option>
                </select>
              </div>

              {/* Export Button - Only shows when an export type is selected */}
              {selectedExportType && (
                <div style={{
                  display: 'flex',
                  gap: '8px',
                  alignItems: 'center',
                  position: 'absolute',
                  right: 0,
                  top: 0,
                  bottom: 0,
                  opacity: selectedExportType ? 1 : 0,
                  transform: selectedExportType ? 'translateX(0)' : 'translateX(20px)',
                  transition: 'all 0.3s ease'
                }}>
                  <button
                    onClick={handleExport}
                    disabled={exporting}
                    style={{
                      padding: '8px 16px',
                      backgroundColor: '#51258f',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: exporting ? 'not-allowed' : 'pointer',
                      fontWeight: 'bold',
                      minWidth: '100px'
                    }}
                  >
                    {exporting ? 'Exportiert...' : 'EXPORT'}
                  </button>
                  <button
                    onClick={handleCancelExport}
                    disabled={exporting}
                    style={{
                      padding: '8px 12px',
                      backgroundColor: '#95a5a6',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: exporting ? 'not-allowed' : 'pointer',
                      fontWeight: 'bold'
                    }}
                    title="Abbrechen"
                  >
                    ✕
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  // ... (rest of the component remains the same, including all the other functions)

  if (loading) return <div>Lade Schichtplan...</div>;
  if (!shiftPlan) return <div>Schichtplan nicht gefunden</div>;

  const { days, allTimeSlots } = getTimetableData();
  const availabilityStatus = getAvailabilityStatus();
  const validation = validateTimetableStructure();

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

      {/* ... (rest of the JSX remains the same) */}

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