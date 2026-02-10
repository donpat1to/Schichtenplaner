// frontend/src/pages/Dashboard/Dashboard.tsx - Updated with unified plan display
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { shiftPlanService } from '../../services/shiftPlanService';
import { weeklyPlanService, WeeklyPlanListItem } from '../../services/weeklyPlanService';
import { employeeService } from '../../services/employeeService';
import { ShiftPlan, ShiftPlanWithData } from '../../models/ShiftPlan';
import { WeeklyPlanWithDetails } from '../../models/WeeklyPlan';
import { Employee } from '../../models/Employee';
import { ResolvedHoliday } from '../../models/Holiday';
import { holidayService } from '../../services/holidayService';
import UnifiedCalendarModal from './components/UnifiedCalendarModal';

// Format date to YYYY-MM-DD in local timezone (avoids UTC conversion issues)
const formatDateLocal = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Unified plan type for combined display
interface UnifiedPlan {
  id: string;
  name: string;
  type: 'shift' | 'weekly';
  status: 'draft' | 'published' | 'archived';
  startDate: string;
  endDate: string;
  createdAt: string;
}

// Upcoming assignment for current user
interface UpcomingAssignment {
  id: string;
  date: string;           // Formatted display date
  sortDate: string;       // ISO date for sorting
  time?: string;          // Only for shift plans
  planName: string;
  planType: 'shift' | 'weekly';
  details: string;        // Time slot name or "KW X"
  holidayName?: string;   // If assignment date falls on a holiday
}

// Calendar day assignment
export interface CalendarDayAssignment {
  date: string;
  employeeId: string;
  employeeName: string;
  planName: string;
  planType: 'shift' | 'weekly';
  timeSlotName?: string;
  startTime?: string;
  endTime?: string;
}

interface DashboardData {
  publishedPlans: UnifiedPlan[];      // All published plans
  allPlans: UnifiedPlan[];            // All plans of all statuses
  upcomingAssignments: UpcomingAssignment[];
  teamStats: {
    totalEmployees: number;
    personell: number;
    manager: number;
    trainee: number;
    experienced: number;
    contractSmall: number;
    contractLarge: number;
    contractFlexible: number;
  };
}

const Dashboard: React.FC = () => {
  const { user, hasRole } = useAuth();
  const [loading, setLoading] = useState(true);
  const [showCalendarModal, setShowCalendarModal] = useState(false);
  const [shiftPlansData, setShiftPlansData] = useState<ShiftPlan[]>([]);
  const [weeklyPlansData, setWeeklyPlansData] = useState<WeeklyPlanListItem[]>([]);
  const [data, setData] = useState<DashboardData>({
    publishedPlans: [],
    allPlans: [],
    upcomingAssignments: [],
    teamStats: {
      totalEmployees: 0,
      personell: 0,
      manager: 0,
      trainee: 0,
      experienced: 0,
      contractSmall: 0,
      contractLarge: 0,
      contractFlexible: 0
    }
  });

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);

      console.log('Loading dashboard data...');

      // Calculate date range for holidays (next 3 months)
      const today = new Date();
      const futureDate = new Date(today);
      futureDate.setMonth(futureDate.getMonth() + 3);

      const [shiftPlans, weeklyPlans, employees, holidays] = await Promise.all([
        shiftPlanService.getShiftPlans(),
        weeklyPlanService.getWeeklyPlans(),
        employeeService.getEmployees(),
        holidayService.getHolidaysInRange(
          formatDateLocal(today),
          formatDateLocal(futureDate)
        ).catch(() => [] as ResolvedHoliday[]) // Gracefully handle errors
      ]);

      // Store raw plans for calendar modal
      setShiftPlansData(shiftPlans);
      setWeeklyPlansData(weeklyPlans);

      // Create unified plan list
      const allPlans = createUnifiedPlanList(shiftPlans, weeklyPlans);
      const publishedPlans = allPlans.filter(p => p.status === 'published');

      // Load user's upcoming assignments
      const upcomingAssignments = await loadUserUpcomingAssignments(
        shiftPlans.filter(p => p.status === 'published' && !p.isTemplate),
        weeklyPlans.filter(p => p.status === 'published'),
        user?.id,
        holidays
      );

      // Calculate team stats
      const activeEmployees = employees.filter(emp => emp.isActive);
      const teamStats = calculateTeamStats(activeEmployees);

      console.log('Dashboard data loaded:', {
        allPlans: allPlans.length,
        publishedPlans: publishedPlans.length,
        upcomingAssignments: upcomingAssignments.length,
        teamStats
      });

      setData({
        publishedPlans,
        allPlans,
        upcomingAssignments,
        teamStats
      });

    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const createUnifiedPlanList = (
    shiftPlans: ShiftPlan[],
    weeklyPlans: WeeklyPlanListItem[]
  ): UnifiedPlan[] => {
    const unifiedShiftPlans: UnifiedPlan[] = shiftPlans
      .filter(p => !p.isTemplate)
      .map(plan => ({
        id: plan.id,
        name: plan.name,
        type: 'shift' as const,
        status: plan.status,
        startDate: plan.startDate || '',
        endDate: plan.endDate || '',
        createdAt: plan.createdAt
      }));

    const unifiedWeeklyPlans: UnifiedPlan[] = weeklyPlans.map(plan => ({
      id: plan.id,
      name: plan.name,
      type: 'weekly' as const,
      status: plan.status,
      startDate: plan.startDate,
      endDate: plan.endDate,
      createdAt: plan.createdAt
    }));

    // Combine and sort by creation date (newest first)
    return [...unifiedShiftPlans, ...unifiedWeeklyPlans]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  };

  const loadUserUpcomingAssignments = async (
    shiftPlans: ShiftPlan[],
    weeklyPlans: WeeklyPlanListItem[],
    userId?: string,
    holidays: ResolvedHoliday[] = []
  ): Promise<UpcomingAssignment[]> => {
    if (!userId) return [];

    const assignments: UpcomingAssignment[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Helper to find holiday for a date - returns full holiday object
    const getHolidayForDate = (dateStr: string): ResolvedHoliday | undefined => {
      return holidays.find(h => h.date === dateStr);
    };

    try {
      // Load shift plan assignments
      for (const plan of shiftPlans) {
        if (!plan.startDate || !plan.endDate) continue;

        try {
          const planDetails = await shiftPlanService.getShiftPlan(plan.id) as ShiftPlanWithData;

          // Find user's assignments
          for (const shift of planDetails.shifts || []) {
            const userAssignment = shift.assignments?.find(a => a.employeeId === userId);
            if (!userAssignment) continue;

            // Calculate next occurrence dates based on dayOfWeek
            const occurrences = getNextOccurrences(
              plan.startDate,
              plan.endDate,
              shift.dayOfWeek,
              today,
              3 // Get next 3 occurrences
            );

            for (const date of occurrences) {
              const dateStr = formatDateLocal(date);
              const holiday = getHolidayForDate(dateStr);

              // Skip full holidays - don't show assignments
              if (holiday && !holiday.halfDay) {
                continue;
              }

              assignments.push({
                id: `shift-${plan.id}-${shift.id}-${dateStr}`,
                date: formatShiftDate(dateStr),
                sortDate: dateStr,
                time: `${shift.timeSlot?.startTime || ''} - ${shift.timeSlot?.endTime || ''}`,
                planName: plan.name,
                planType: 'shift',
                details: shift.timeSlot?.name || 'Schicht',
                holidayName: holiday?.name
              });
            }
          }
        } catch (err) {
          console.error(`Error loading shift plan ${plan.id}:`, err);
        }
      }

      // Load weekly plan assignments
      // WeeklyPlanWithDetails stores assignments on each employee's assignedWeeks array
      for (const plan of weeklyPlans) {
        try {
          const planDetails = await weeklyPlanService.getWeeklyPlan(plan.id);

          // Find the current user in the employees list
          const userEmployee = planDetails.employees?.find(e => e.id === userId);
          if (!userEmployee) continue;

          // Get user's assigned weeks
          for (const weekId of userEmployee.assignedWeeks || []) {
            const week = planDetails.weeks?.find(w => w.id === weekId);
            if (!week) continue;

            const weekStart = new Date(week.startDate);
            // Only include future weeks or current week
            if (weekStart < today) {
              const weekEnd = new Date(week.endDate);
              weekEnd.setHours(23, 59, 59, 999);
              if (weekEnd < today) continue;
            }

            const weekNumber = getCalendarWeekNumber(weekStart);
            // For weekly plans, check if start date is a holiday
            const weekStartHoliday = getHolidayForDate(week.startDate);
            assignments.push({
              id: `weekly-${plan.id}-${week.id}`,
              date: formatShiftDate(week.startDate),
              sortDate: week.startDate,
              planName: plan.name,
              planType: 'weekly',
              details: `KW ${weekNumber}`,
              holidayName: weekStartHoliday?.name
            });
          }
        } catch (err) {
          console.error(`Error loading weekly plan ${plan.id}:`, err);
        }
      }

      // Sort by date and limit to 5
      return assignments
        .sort((a, b) => new Date(a.sortDate).getTime() - new Date(b.sortDate).getTime())
        .slice(0, 5);

    } catch (error) {
      console.error('Error loading user assignments:', error);
      return [];
    }
  };

  const getNextOccurrences = (
    startDate: string,
    endDate: string,
    dayOfWeek: number,
    today: Date,
    count: number
  ): Date[] => {
    const occurrences: Date[] = [];
    const start = new Date(startDate);
    const end = new Date(endDate);

    // Find the first occurrence of this dayOfWeek on or after today
    let current = new Date(Math.max(start.getTime(), today.getTime()));

    // Adjust to the target day of week (1=Monday, 7=Sunday)
    const targetDay = dayOfWeek === 7 ? 0 : dayOfWeek; // Convert to JS day (0=Sunday)
    const currentDay = current.getDay();
    let daysUntilTarget = targetDay - currentDay;
    if (daysUntilTarget < 0) daysUntilTarget += 7;
    current.setDate(current.getDate() + daysUntilTarget);

    while (occurrences.length < count && current <= end) {
      if (current >= today) {
        occurrences.push(new Date(current));
      }
      current.setDate(current.getDate() + 7);
    }

    return occurrences;
  };

  const getCalendarWeekNumber = (date: Date): number => {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  };

  const calculateTeamStats = (employees: Employee[]) => {
    const totalEmployees = employees.length;
    const managerCount = employees.filter(e => e.employeeType === 'manager').length;
    const personellCount = employees.filter(e => e.employeeType === 'personell').length;
    const traineeCount = employees.filter(e => e.isTrainee === true).length;
    const experiencedCount = employees.filter(e => e.isTrainee === false).length;
    const contractSmallCount = employees.filter(e => e.contractType === 'small').length;
    const contractLargeCount = employees.filter(e => e.contractType === 'large').length;
    const contractFlexibleCount = employees.filter(e => e.contractType === 'flexible').length;

    return {
      totalEmployees,
      personell: personellCount,
      manager: managerCount,
      trainee: traineeCount,
      experienced: experiencedCount,
      contractSmall: contractSmallCount,
      contractLarge: contractLargeCount,
      contractFlexible: contractFlexibleCount,
    };
  };

  const formatShiftDate = (dateString: string): string => {
    const today = formatDateLocal(new Date());
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowString = formatDateLocal(tomorrow);

    if (dateString === today) {
      return 'Heute';
    } else if (dateString === tomorrowString) {
      return 'Morgen';
    } else {
      return new Date(dateString).toLocaleDateString('de-DE', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
    }
  };

  const formatPlanPeriod = (startDate?: string, endDate?: string): string => {
    if (!startDate || !endDate) return 'Kein Zeitraum definiert';

    const start = new Date(startDate).toLocaleDateString('de-DE');
    const end = new Date(endDate).toLocaleDateString('de-DE');
    return `${start} - ${end}`;
  };

  const getPlanTypeBadge = (type: 'shift' | 'weekly') => ({
    label: type === 'shift' ? 'Schichtplan' : 'Wochenplan',
    color: type === 'shift' ? '#3498db' : '#9b59b6'
  });

  const getStatusBadge = (status: 'draft' | 'published' | 'archived') => ({
    label: status === 'published' ? 'Veröffentlicht' : status === 'draft' ? 'Entwurf' : 'Archiviert',
    color: status === 'published' ? '#2ecc71' : status === 'draft' ? '#f39c12' : '#95a5a6'
  });

  const getPlanLink = (plan: UnifiedPlan): string => {
    return plan.type === 'shift' ? `/plans/${plan.id}` : `/plans/${plan.id}`;
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '40px' }}>
        <div>Lade Dashboard...</div>
      </div>
    );
  }

  return (
    <div>
      {/* Minimalist Welcome Section */}
      <div
        style={{
          width: '100vw',
          position: 'relative',
          left: '50%',
          right: '50%',
          marginLeft: '-50vw',
          marginRight: '-50vw',
          background: `
            radial-gradient(ellipse farthest-corner at center 53%,
              #d9b9f3ff 10%,
              #ddc5f1ff 22%,
              #e9d4f8ff 32%,
              #FBFAF6 55%)
          `,
          textAlign: 'center',
          padding: '10vh 0',
          color: '#161718',
          fontFamily: "'Poppins', 'Inter', 'Manrope', sans-serif",
        }}
      >
        <h1
          style={{
            fontSize: '3rem',
            fontWeight: 100,
            letterSpacing: '0.08em',
            marginBottom: '0.5rem',
            opacity: 0.995,
            filter: 'blur(0.2px)',
          }}
        >
          Willkommen
        </h1>

        <p
          style={{
            fontSize: '1.1rem',
            color: '#3e2069',
            letterSpacing: '0.05em',
            fontWeight: 300,
            opacity: 0.85,
            transition: 'color 0.3s ease',
          }}
        >
          {user?.firstname} {user?.lastname}
        </p>
      </div>

      {/* Quick Actions - Only for Admins/Maintenance */}
      {hasRole(['admin', 'maintenance']) && (
        <div style={{ marginBottom: '30px' }}>
          <h2 style={{ marginBottom: '15px', color: '#2c3e50' }}>Schnellaktionen</h2>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '15px'
          }}>
            <Link to="/plans/new" style={{ textDecoration: 'none' }}>
              <div style={{
                backgroundColor: '#3498db',
                color: 'white',
                padding: '20px',
                borderRadius: '8px',
                textAlign: 'center',
                transition: 'transform 0.2s',
                cursor: 'pointer'
              }} onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
              }} onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
              }}>
                <div style={{ fontSize: '24px', marginBottom: '8px' }}>&#128197;</div>
                <div style={{ fontWeight: 'bold' }}>Neuen Schichtplan</div>
                <div style={{ fontSize: '14px', opacity: 0.9 }}>Erstellen</div>
              </div>
            </Link>

            <Link to="/employees" style={{ textDecoration: 'none' }}>
              <div style={{
                backgroundColor: '#2ecc71',
                color: 'white',
                padding: '20px',
                borderRadius: '8px',
                textAlign: 'center',
                transition: 'transform 0.2s',
                cursor: 'pointer'
              }} onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
              }} onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
              }}>
                <div style={{ fontSize: '24px', marginBottom: '8px' }}>&#128101;</div>
                <div style={{ fontWeight: 'bold' }}>Mitarbeiter</div>
                <div style={{ fontSize: '14px', opacity: 0.9 }}>Verwalten</div>
              </div>
            </Link>

            <Link to="/plans" style={{ textDecoration: 'none' }}>
              <div style={{
                backgroundColor: '#9b59b6',
                color: 'white',
                padding: '20px',
                borderRadius: '8px',
                textAlign: 'center',
                transition: 'transform 0.2s',
                cursor: 'pointer'
              }} onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
              }} onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
              }}>
                <div style={{ fontSize: '24px', marginBottom: '8px' }}>&#128203;</div>
                <div style={{ fontWeight: 'bold' }}>Alle Pläne</div>
                <div style={{ fontSize: '14px', opacity: 0.9 }}>Anzeigen</div>
              </div>
            </Link>
          </div>
        </div>
      )}

      {/* Main Grid with Information */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
        gap: '25px',
        marginBottom: '30px'
      }}>
        {/* Aktuelle Pläne (Published Plans) */}
        <div style={{
          backgroundColor: 'white',
          padding: '20px',
          borderRadius: '8px',
          border: '1px solid #e0e0e0',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '15px'
          }}>
            <h3 style={{ margin: 0, color: '#2c3e50' }}>&#128202; Aktuelle Pläne</h3>
            {data.publishedPlans.length > 0 && (
              <button
                onClick={() => setShowCalendarModal(true)}
                style={{
                  padding: '6px 12px',
                  backgroundColor: '#854eca',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '13px'
                }}
              >
                Kalender anzeigen
              </button>
            )}
          </div>

          {data.publishedPlans.length > 0 ? (
            <div style={{ display: 'grid', gap: '12px' }}>
              {data.publishedPlans.slice(0, 4).map(plan => {
                const typeBadge = getPlanTypeBadge(plan.type);
                return (
                  <Link
                    key={plan.id}
                    to={getPlanLink(plan)}
                    style={{ textDecoration: 'none', color: 'inherit' }}
                  >
                    <div style={{
                      padding: '12px',
                      backgroundColor: '#f8f9fa',
                      borderRadius: '6px',
                      borderLeft: `4px solid ${typeBadge.color}`,
                      cursor: 'pointer',
                      transition: 'transform 0.1s ease'
                    }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'translateX(4px)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'translateX(0)';
                      }}
                    >
                      <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>
                        {plan.name}
                      </div>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        marginBottom: '4px'
                      }}>
                        <span style={{
                          display: 'inline-block',
                          padding: '2px 8px',
                          backgroundColor: typeBadge.color,
                          color: 'white',
                          borderRadius: '10px',
                          fontSize: '11px',
                          fontWeight: 'bold'
                        }}>
                          {typeBadge.label}
                        </span>
                      </div>
                      <div style={{ fontSize: '13px', color: '#666' }}>
                        {formatPlanPeriod(plan.startDate, plan.endDate)}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '20px', color: '#666' }}>
              <div style={{ fontSize: '48px', marginBottom: '10px' }}>&#128197;</div>
              <div>Keine aktiven Pläne</div>
              {hasRole(['admin', 'maintenance']) && (
                <Link to="/plans/new">
                  <button style={{
                    marginTop: '10px',
                    padding: '8px 16px',
                    backgroundColor: '#3498db',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}>
                    Ersten Plan erstellen
                  </button>
                </Link>
              )}
            </div>
          )}
        </div>

        {/* Team-Statistiken */}
        {hasRole(['admin', 'maintenance']) && (
          <div style={{
            backgroundColor: 'white',
            padding: '20px',
            borderRadius: '8px',
            border: '1px solid #e0e0e0',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
          }}>
            <h3 style={{ margin: '0 0 15px 0', color: '#2c3e50' }}>&#128101; Team-Übersicht</h3>
            <div style={{ display: 'grid', gap: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Gesamte Belegschaft:</span>
                <span style={{ fontWeight: 'bold', fontSize: '18px' }}>
                  {data.teamStats.totalEmployees}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Chef:</span>
                <span style={{ fontWeight: 'bold', color: '#2ecc71' }}>
                  {data.teamStats.manager}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Personal:</span>
                <span style={{ fontWeight: 'bold', color: '#f39c12' }}>
                  {data.teamStats.personell}
                </span>
              </div>
              <div style={{
                borderTop: '1px solid #eee',
                paddingTop: '12px',
                marginTop: '4px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <span>Erfahrene:</span>
                <span style={{ fontWeight: 'bold', color: '#f39c12' }}>
                  {data.teamStats.experienced}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Neulinge:</span>
                <span style={{ fontWeight: 'bold', color: '#f39c12' }}>
                  {data.teamStats.trainee}
                </span>
              </div>
              <div style={{
                borderTop: '1px solid #eee',
                paddingTop: '12px',
                marginTop: '4px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <span>Kleinvertrag:</span>
                <span style={{ fontWeight: 'bold', color: '#f39c12' }}>
                  {data.teamStats.contractSmall}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Großvertrag:</span>
                <span style={{ fontWeight: 'bold', color: '#f39c12' }}>
                  {data.teamStats.contractLarge}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Flexibel:</span>
                <span style={{ fontWeight: 'bold', color: '#27ae60' }}>
                  {data.teamStats.contractFlexible}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>


      {/* Lower Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
        gap: '25px'
      }}>
        {/* Meine nächsten Schichten (for regular users) */}
        {user?.employeeType === 'personell' && (
          <div style={{
            backgroundColor: 'white',
            padding: '20px',
            borderRadius: '8px',
            border: '1px solid #e0e0e0',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
          }}>
            <h3 style={{ margin: '0 0 15px 0', color: '#2c3e50' }}>&#9200; Meine nächsten Schichten</h3>
            {data.upcomingAssignments.length > 0 ? (
              <div style={{ display: 'grid', gap: '10px' }}>
                {data.upcomingAssignments.map(assignment => {
                  const typeBadge = getPlanTypeBadge(assignment.planType);
                  return (
                    <div key={assignment.id} style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '12px',
                      backgroundColor: assignment.holidayName ? '#fff3cd' : '#f8f9fa',
                      borderRadius: '6px',
                      borderLeft: `3px solid ${assignment.holidayName ? '#ffc107' : typeBadge.color}`
                    }}>
                      <div>
                        <div style={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
                          {assignment.date}
                          {assignment.holidayName && (
                            <span style={{
                              padding: '2px 6px',
                              backgroundColor: '#ffc107',
                              color: '#856404',
                              borderRadius: '8px',
                              fontSize: '10px',
                              fontWeight: 'bold'
                            }}>
                              {assignment.holidayName}
                            </span>
                          )}
                        </div>
                        {assignment.time && (
                          <div style={{ fontSize: '14px', color: '#666' }}>{assignment.time}</div>
                        )}
                        <div style={{ fontSize: '12px', color: '#999' }}>{assignment.details}</div>
                        <div style={{
                          fontSize: '11px',
                          color: '#666',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          marginTop: '4px'
                        }}>
                          {assignment.planName}
                          <span style={{
                            padding: '1px 6px',
                            backgroundColor: typeBadge.color,
                            color: 'white',
                            borderRadius: '8px',
                            fontSize: '10px'
                          }}>
                            {typeBadge.label}
                          </span>
                        </div>
                      </div>
                      <div style={{
                        padding: '4px 8px',
                        backgroundColor: '#d4edda',
                        color: '#155724',
                        borderRadius: '4px',
                        fontSize: '12px',
                        fontWeight: 'bold'
                      }}>
                        Zugewiesen
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '20px', color: '#666' }}>
                <div style={{ fontSize: '48px', marginBottom: '10px' }}>&#9200;</div>
                <div>Keine anstehenden Schichten</div>
              </div>
            )}
          </div>
        )}

        {/* Alle Pläne (for Admins/Maintenance) */}
        {hasRole(['admin', 'maintenance']) && (
          <div style={{
            backgroundColor: 'white',
            padding: '20px',
            borderRadius: '8px',
            border: '1px solid #e0e0e0',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
          }}>
            <h3 style={{ margin: '0 0 15px 0', color: '#2c3e50' }}>&#128221; Alle Pläne</h3>
            {data.allPlans.length > 0 ? (
              <div style={{ display: 'grid', gap: '12px' }}>
                {data.allPlans.slice(0, 5).map(plan => {
                  const typeBadge = getPlanTypeBadge(plan.type);
                  const statusBadge = getStatusBadge(plan.status);
                  return (
                    <div key={plan.id} style={{
                      padding: '12px',
                      backgroundColor: '#f8f9fa',
                      borderRadius: '6px',
                      borderLeft: `4px solid ${statusBadge.color}`
                    }}>
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start'
                      }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>
                            {plan.name}
                          </div>
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            marginBottom: '4px',
                            flexWrap: 'wrap'
                          }}>
                            <span style={{
                              display: 'inline-block',
                              padding: '2px 8px',
                              backgroundColor: typeBadge.color,
                              color: 'white',
                              borderRadius: '10px',
                              fontSize: '10px',
                              fontWeight: 'bold'
                            }}>
                              {typeBadge.label}
                            </span>
                            <span style={{
                              display: 'inline-block',
                              padding: '2px 8px',
                              backgroundColor: statusBadge.color,
                              color: 'white',
                              borderRadius: '10px',
                              fontSize: '10px',
                              fontWeight: 'bold'
                            }}>
                              {statusBadge.label}
                            </span>
                          </div>
                          <div style={{ fontSize: '13px', color: '#666' }}>
                            {formatPlanPeriod(plan.startDate, plan.endDate)}
                          </div>
                        </div>
                        <Link
                          to={getPlanLink(plan)}
                          style={{
                            color: '#3498db',
                            textDecoration: 'none',
                            fontSize: '13px',
                            whiteSpace: 'nowrap'
                          }}
                        >
                          Anzeigen &#8594;
                        </Link>
                      </div>
                    </div>
                  );
                })}
                {data.allPlans.length > 5 && (
                  <Link
                    to="/plans"
                    style={{
                      textAlign: 'center',
                      color: '#3498db',
                      textDecoration: 'none',
                      padding: '8px',
                      fontSize: '13px'
                    }}
                  >
                    Alle {data.allPlans.length} Pläne anzeigen &#8594;
                  </Link>
                )}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '20px', color: '#666' }}>
                <div style={{ fontSize: '48px', marginBottom: '10px' }}>&#128203;</div>
                <div>Noch keine Pläne erstellt</div>
                <Link to="/plans/new">
                  <button style={{
                    marginTop: '10px',
                    padding: '8px 16px',
                    backgroundColor: '#3498db',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}>
                    Ersten Plan erstellen
                  </button>
                </Link>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Calendar Modal */}
      {showCalendarModal && (
        <UnifiedCalendarModal
          shiftPlans={shiftPlansData.filter(p => p.status === 'published' && !p.isTemplate)}
          weeklyPlans={weeklyPlansData.filter(p => p.status === 'published')}
          onClose={() => setShowCalendarModal(false)}
        />
      )}
    </div>
  );
};

export default Dashboard;
