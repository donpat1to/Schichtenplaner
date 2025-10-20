// frontend/src/pages/Dashboard/Dashboard.tsx - Updated calculations
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { shiftPlanService } from '../../services/shiftPlanService';
import { employeeService } from '../../services/employeeService';
import { ShiftPlan, ScheduledShift } from '../../models/ShiftPlan';
import { Employee } from '../../models/Employee';
import { shiftAssignmentService } from '../../services/shiftAssignmentService';

interface DashboardData {
  currentShiftPlan: ShiftPlan | null;
  upcomingShifts: Array<{
    id: string;
    date: string;
    time: string;
    type: string;
    assigned: boolean;
    planName: string;
  }>;
  teamStats: {
    totalEmployees: number;
    manager: number;
    trainee: number;
    experienced: number;
  };
  recentPlans: ShiftPlan[];
}

const Dashboard: React.FC = () => {
  const { user, hasRole } = useAuth();
  const [loading, setLoading] = useState(true);
  const [currentPlanShifts, setCurrentPlanShifts] = useState<ScheduledShift[]>([]);
  const [data, setData] = useState<DashboardData>({
    currentShiftPlan: null,
    upcomingShifts: [],
    teamStats: {
      totalEmployees: 0,
      manager: 0,
      trainee: 0,
      experienced: 0
    },
    recentPlans: []
  });

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      
      console.log('🔄 Loading dashboard data...');
      
      const [shiftPlans, employees] = await Promise.all([
        shiftPlanService.getShiftPlans(),
        employeeService.getEmployees(),
      ]);

      // Find current shift plan
      const today = new Date().toISOString().split('T')[0];
      const currentPlan = findCurrentShiftPlan(shiftPlans, today);

      // Load shifts for current plan
      if (currentPlan) {
        const shifts = await shiftAssignmentService.getScheduledShiftsForPlan(currentPlan.id);
        setCurrentPlanShifts(shifts);
      } else {
        setCurrentPlanShifts([]);
      }

      console.log('📊 Loaded data:', {
        plans: shiftPlans.length,
        employees: employees.length,
        currentPlanShifts
      });

      // Debug: Log plan details
      shiftPlans.forEach(plan => {
        console.log(`Plan: ${plan.name}`, {
          status: plan.status,
          startDate: plan.startDate,
          endDate: plan.endDate,
          //scheduledShifts: plan.scheduledShifts?.length || 0,
          isTemplate: plan.isTemplate
        });
      });

      // Find current shift plan (published and current date within range)
      //const today = new Date().toISOString().split('T')[0];
      //const currentPlan = findCurrentShiftPlan(shiftPlans, today);

      // Get user's upcoming shifts
      const userShifts = await loadUserUpcomingShifts(shiftPlans, today);

      // Calculate team stats
      const activeEmployees = employees.filter(emp => emp.isActive);
      const teamStats = calculateTeamStats(activeEmployees);

      // Get recent plans (non-templates, sorted by creation date)
      const recentPlans = getRecentPlans(shiftPlans);

      setData({
        currentShiftPlan: currentPlan,
        upcomingShifts: userShifts,
        teamStats,
        recentPlans
      });

      console.log('✅ Dashboard data loaded:', {
        currentPlan: currentPlan?.name,
        //userShifts: userShifts.length,
        teamStats,
        recentPlans: recentPlans.length
      });

    } catch (error) {
      console.error('❌ Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const findCurrentShiftPlan = (plans: ShiftPlan[], today: string): ShiftPlan | null => {
    // First, try to find a published plan where today is within the date range
    const activePlan = plans.find(plan => 
      plan.status === 'published' && 
      !plan.isTemplate &&
      plan.startDate && 
      plan.endDate &&
      plan.startDate <= today && 
      plan.endDate >= today
    );

    if (activePlan) {
      console.log('✅ Found active plan:', activePlan.name);
      return activePlan;
    }

    // If no active plan found, try to find the most recent published plan
    const publishedPlans = plans
      .filter(plan => plan.status === 'published' && !plan.isTemplate)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    console.log('📅 Published plans available:', publishedPlans.map(p => p.name));

    return publishedPlans[0] || null;
  };

  const loadUserUpcomingShifts = async (shiftPlans: ShiftPlan[], today: string): Promise<DashboardData['upcomingShifts']> => {
    if (!user) return [];

    try {
      const userShifts: DashboardData['upcomingShifts'] = [];

      // Check each plan for user assignments
      for (const plan of shiftPlans) {
        const scheduledShifts = (await shiftAssignmentService.getScheduledShiftsForPlan(plan.id));
        if (plan.status !== 'published' || scheduledShifts.length === 0) {
          continue;
        }

        console.log(`🔍 Checking plan ${plan.name} for user shifts:`, scheduledShifts.length);

        for (const scheduledShift of scheduledShifts) {
          // Ensure assignedEmployees is an array
          const assignedEmployees = Array.isArray(scheduledShift.assignedEmployees) 
            ? scheduledShift.assignedEmployees 
            : [];
          
          if (scheduledShift.date >= today && assignedEmployees.includes(user.id)) {
            const timeSlot = plan.timeSlots.find(ts => ts.id === scheduledShift.timeSlotId);
            
            userShifts.push({
              id: scheduledShift.id,
              date: formatShiftDate(scheduledShift.date),
              time: timeSlot ? `${timeSlot.startTime} - ${timeSlot.endTime}` : 'Unbekannt',
              type: timeSlot?.name || 'Unbekannt',
              assigned: true,
              planName: plan.name
            });
          }
        }
      }

      // Sort by date and limit to 5 upcoming shifts
      return userShifts
        .sort((a, b) => {
          // Convert formatted dates back to Date objects for sorting
          const dateA = a.date === 'Heute' ? today : a.date === 'Morgen' ? 
            new Date(new Date().setDate(new Date().getDate() + 1)).toISOString().split('T')[0] : a.date;
          const dateB = b.date === 'Heute' ? today : b.date === 'Morgen' ? 
            new Date(new Date().setDate(new Date().getDate() + 1)).toISOString().split('T')[0] : b.date;
          
          return new Date(dateA).getTime() - new Date(dateB).getTime();
        })
        .slice(0, 5);

    } catch (error) {
      console.error('Error loading user shifts:', error);
      return [];
    }
  };

  const calculateTeamStats = (employees: Employee[]) => {
    const totalEmployees = employees.length;

    // Count by type
    const managerCount = employees.filter(e => e.employeeType === 'manager').length;
    const traineeCount = employees.filter(e => e.employeeType === 'trainee').length;
    const experiencedCount = employees.filter(e => e.employeeType === 'experienced').length;

    return {
      totalEmployees,
      manager: managerCount,
      trainee: traineeCount,
      experienced: experiencedCount,
    };
  };

  const getRecentPlans = (plans: ShiftPlan[]): ShiftPlan[] => {
    return plans
      .filter(plan => !plan.isTemplate)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 3);
  };

  const formatShiftDate = (dateString: string): string => {
    const today = new Date().toISOString().split('T')[0];
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowString = tomorrow.toISOString().split('T')[0];

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

  const formatPlanPeriod = (plan: ShiftPlan): string => {
    if (!plan.startDate || !plan.endDate) return 'Kein Zeitraum definiert';
    
    const start = new Date(plan.startDate).toLocaleDateString('de-DE');
    const end = new Date(plan.endDate).toLocaleDateString('de-DE');
    return `${start} - ${end}`;
  };

  const calculatePlanProgress = (plan: ShiftPlan, shifts: ScheduledShift[]): { 
    covered: number; total: number; percentage: number 
  } => {
    if (!plan.id || shifts.length === 0) {
      console.log(`📊 Plan ${plan.name} has no scheduled shifts`);
      return { covered: 0, total: 0, percentage: 0 };
    }

    const currentDate = new Date();
    const totalShifts = shifts.length;
    const coveredShifts = shifts.filter(shift => {
      const shiftDate = new Date(shift.date);
      return currentDate > shiftDate;
    }).length;

    const percentage = totalShifts > 0 ? Math.round((coveredShifts / totalShifts) * 100) : 0;

    console.log(`📊 Plan ${plan.name} progress:`, {
      totalShifts,
      coveredShifts,
      percentage
    });

    return {
      covered: coveredShifts,
      total: totalShifts,
      percentage
    };
  };
  
  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '40px' }}>
        <div>⏳ Lade Dashboard...</div>
      </div>
    );
  }

  const regenerateScheduledShifts = async (planId: string) => {
    await shiftPlanService.regenerateScheduledShifts(planId);
    loadDashboardData();
  };

  const PlanDebugInfo = () => {
    if (!data.currentShiftPlan) return null;
    
    return (
      <div style={{ 
        backgroundColor: '#fff3cd', 
        padding: '15px', 
        borderRadius: '8px', 
        marginBottom: '20px',
        border: '1px solid #ffeaa7',
        fontSize: '14px'
      }}>
        <h4>🔍 Plan Debug Information:</h4>
        <div><strong>Plan ID:</strong> {data.currentShiftPlan.id}</div>
        <div><strong>Status:</strong> {data.currentShiftPlan.status}</div>
        <div><strong>Is Template:</strong> {data.currentShiftPlan.isTemplate ? 'Yes' : 'No'}</div>
        <div><strong>Start Date:</strong> {data.currentShiftPlan.startDate}</div>
        <div><strong>End Date:</strong> {data.currentShiftPlan.endDate}</div>
        <div><strong>Shifts Defined:</strong> {data.currentShiftPlan.shifts?.length || 0}</div>
        <div><strong>Time Slots:</strong> {data.currentShiftPlan.timeSlots?.length || 0}</div>
        <div><strong>Scheduled Shifts:</strong> {data.currentShiftPlan.shifts.length || 0}</div>
        
        {data.currentShiftPlan.shifts && data.currentShiftPlan.shifts.length > 0 && (
          <div style={{ marginTop: '10px' }}>
            <strong>Defined Shifts:</strong>
            {data.currentShiftPlan.shifts.slice(0, 3).map(shift => (
              <div key={shift.id} style={{ marginLeft: '10px', fontSize: '12px' }}>
                Day {shift.dayOfWeek} - TimeSlot: {shift.timeSlotId} - Required: {shift.requiredEmployees}
              </div>
            ))}
            {data.currentShiftPlan.shifts.length > 3 && <div>... and {data.currentShiftPlan.shifts.length - 3} more</div>}
          </div>
        )}
      </div>
    );
  };

  const progress = data.currentShiftPlan 
    ? calculatePlanProgress(data.currentShiftPlan, currentPlanShifts) 
    : { covered: 0, total: 0, percentage: 0 };

  return (
    <div>
      {/* Willkommens-Bereich */}
      <div style={{ 
        backgroundColor: '#e8f4fd', 
        padding: '25px', 
        borderRadius: '8px',
        marginBottom: '30px',
        border: '1px solid #b6d7e8',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div>
          <h1 style={{ margin: '0 0 10px 0', color: '#2c3e50' }}>
            Willkommen zurück, {user?.firstname} {user?.lastname} ! 👋
          </h1>
          <p style={{ margin: 0, color: '#546e7a', fontSize: '16px' }}>
            {new Date().toLocaleDateString('de-DE', { 
              weekday: 'long', 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            })}
          </p>
        </div>
      </div>

      {/* Quick Actions - Nur für Admins/Instandhalter */}
      {hasRole(['admin', 'instandhalter']) && (
        <div style={{ marginBottom: '30px' }}>
          <h2 style={{ marginBottom: '15px', color: '#2c3e50' }}>Schnellaktionen</h2>
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '15px'
          }}>
            <Link to="/shift-plans/new" style={{ textDecoration: 'none' }}>
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
                <div style={{ fontSize: '24px', marginBottom: '8px' }}>📅</div>
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
                <div style={{ fontSize: '24px', marginBottom: '8px' }}>👥</div>
                <div style={{ fontWeight: 'bold' }}>Mitarbeiter</div>
                <div style={{ fontSize: '14px', opacity: 0.9 }}>Verwalten</div>
              </div>
            </Link>

            <Link to="/shift-plans" style={{ textDecoration: 'none' }}>
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
                <div style={{ fontSize: '24px', marginBottom: '8px' }}>📋</div>
                <div style={{ fontWeight: 'bold' }}>Alle Pläne</div>
                <div style={{ fontSize: '14px', opacity: 0.9 }}>Anzeigen</div>
              </div>
            </Link>
          </div>
        </div>
      )}

      {/* Haupt-Grid mit Informationen */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
        gap: '25px',
        marginBottom: '30px'
      }}>
        {/* Aktueller Schichtplan */}
        <div style={{
          backgroundColor: 'white',
          padding: '20px',
          borderRadius: '8px',
          border: '1px solid #e0e0e0',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
        }}>
          <h3 style={{ margin: '0 0 15px 0', color: '#2c3e50' }}>📊 Aktueller Schichtplan</h3>
          {data.currentShiftPlan ? (
            <>
              <div style={{ marginBottom: '15px' }}>
                <div style={{ fontWeight: 'bold', fontSize: '18px' }}>
                  {data.currentShiftPlan.name}
                </div>
                <div style={{ color: '#666', fontSize: '14px' }}>
                  {formatPlanPeriod(data.currentShiftPlan)}
                </div>
              </div>
              
              <div style={{ marginBottom: '15px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                  <span>Fortschritt:</span>
                  <span>
                    {progress.covered}/{progress.total} Schichten ({progress.percentage}%)
                  </span>
                </div>
                <div style={{
                  width: '100%',
                  backgroundColor: '#ecf0f1',
                  borderRadius: '10px',
                  overflow: 'hidden'
                }}>
                  <div style={{
                    width: `${progress.percentage}%`,
                    backgroundColor: progress.percentage > 0 ? '#3498db' : '#95a5a6',
                    height: '8px',
                    borderRadius: '10px',
                    transition: 'width 0.3s ease'
                  }} />
                </div>
                {progress.total === 0 && (
                  <div style={{ fontSize: '12px', color: '#e74c3c', marginTop: '5px' }}>
                    Keine Schichten im Plan definiert
                  </div>
                )}
              </div>
              
              <div style={{
                display: 'inline-block',
                backgroundColor: data.currentShiftPlan.status === 'published' ? '#2ecc71' : '#f39c12',
                color: 'white',
                padding: '4px 12px',
                borderRadius: '20px',
                fontSize: '12px',
                fontWeight: 'bold'
              }}>
                {data.currentShiftPlan.status === 'published' ? 'Aktiv' : 'Entwurf'}
              </div>
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: '20px', color: '#666' }}>
              <div style={{ fontSize: '48px', marginBottom: '10px' }}>📅</div>
              <div>Kein aktiver Schichtplan</div>
              {hasRole(['admin', 'instandhalter']) && (
                <Link to="/shift-plans/new">
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
        <div style={{
          backgroundColor: 'white',
          padding: '20px',
          borderRadius: '8px',
          border: '1px solid #e0e0e0',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
        }}>
          <h3 style={{ margin: '0 0 15px 0', color: '#2c3e50' }}>👥 Team-Übersicht</h3>
          <div style={{ display: 'grid', gap: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Mitarbeiter:</span>
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
              <span>Erfahrene:</span>
              <span style={{ fontWeight: 'bold', color: '#f39c12' }}>
                {data.teamStats.experienced}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Neue:</span>
              <span style={{ fontWeight: 'bold', color: '#e74c3c' }}>
                {data.teamStats.trainee}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Unteres Grid */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
        gap: '25px'
      }}>
        {/* Meine nächsten Schichten (für normale User) */}
        {hasRole(['user']) && (
          <div style={{
            backgroundColor: 'white',
            padding: '20px',
            borderRadius: '8px',
            border: '1px solid #e0e0e0',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
          }}>
            <h3 style={{ margin: '0 0 15px 0', color: '#2c3e50' }}>⏰ Meine nächsten Schichten</h3>
            {data.upcomingShifts.length > 0 ? (
              <div style={{ display: 'grid', gap: '10px' }}>
                {data.upcomingShifts.map(shift => (
                  <div key={shift.id} style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '12px',
                    backgroundColor: '#f8f9fa',
                    borderRadius: '6px',
                    border: '1px solid #d4edda'
                  }}>
                    <div>
                      <div style={{ fontWeight: 'bold' }}>{shift.date}</div>
                      <div style={{ fontSize: '14px', color: '#666' }}>{shift.time}</div>
                      <div style={{ fontSize: '12px', color: '#999' }}>{shift.type}</div>
                      <div style={{ fontSize: '11px', color: '#666' }}>{shift.planName}</div>
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
                ))}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '20px', color: '#666' }}>
                <div style={{ fontSize: '48px', marginBottom: '10px' }}>⏰</div>
                <div>Keine anstehenden Schichten</div>
              </div>
            )}
          </div>
        )}

        {/* Letzte Schichtpläne (für Admins/Instandhalter) */}
        {hasRole(['admin', 'instandhalter']) && (
          <div style={{
            backgroundColor: 'white',
            padding: '20px',
            borderRadius: '8px',
            border: '1px solid #e0e0e0',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
          }}>
            <h3 style={{ margin: '0 0 15px 0', color: '#2c3e50' }}>📝 Schichtpläne</h3>
            {data.recentPlans.length > 0 ? (
              <div style={{ display: 'grid', gap: '12px' }}>
                {data.recentPlans.map(plan => (
                  <div key={plan.id} style={{
                    padding: '12px',
                    backgroundColor: '#f8f9fa',
                    borderRadius: '6px',
                    borderLeft: `4px solid ${
                      plan.status === 'published' ? '#2ecc71' : 
                      plan.status === 'draft' ? '#f39c12' : '#95a5a6'
                    }`
                  }}>
                    <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>
                      {plan.name}
                    </div>
                    <div style={{ fontSize: '14px', color: '#666' }}>
                      {formatPlanPeriod(plan)}
                    </div>
                    <div style={{ 
                      fontSize: '12px', 
                      color: '#999',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginTop: '4px'
                    }}>
                      <span>
                        Status: {plan.status === 'published' ? 'Veröffentlicht' : 
                                plan.status === 'draft' ? 'Entwurf' : 'Archiviert'}
                      </span>
                      <Link to={`/shift-plans/${plan.id}`} style={{ color: '#3498db', textDecoration: 'none' }}>
                        Anzeigen →
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '20px', color: '#666' }}>
                <div style={{ fontSize: '48px', marginBottom: '10px' }}>📋</div>
                <div>Noch keine Schichtpläne erstellt</div>
                <Link to="/shift-plans/new">
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

        {/* Schnelllinks */}
        <div style={{
          backgroundColor: 'white',
          padding: '20px',
          borderRadius: '8px',
          border: '1px solid #e0e0e0',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
        }}>
          <h3 style={{ margin: '0 0 15px 0', color: '#2c3e50' }}>🔗 Schnellzugriff</h3>
          <div style={{ display: 'grid', gap: '10px' }}>
            <Link to="/shift-plans" style={{ textDecoration: 'none' }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                padding: '12px',
                backgroundColor: '#f8f9fa',
                borderRadius: '6px',
                transition: 'background-color 0.2s',
                cursor: 'pointer'
              }} onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#e9ecef';
              }} onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#f8f9fa';
              }}>
                <span style={{ marginRight: '10px', fontSize: '18px' }}>📅</span>
                <span>Alle Schichtpläne anzeigen</span>
              </div>
            </Link>

            <Link to="/help" style={{ textDecoration: 'none' }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                padding: '12px',
                backgroundColor: '#f8f9fa',
                borderRadius: '6px',
                transition: 'background-color 0.2s',
                cursor: 'pointer'
              }} onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#e9ecef';
              }} onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#f8f9fa';
              }}>
                <span style={{ marginRight: '10px', fontSize: '18px' }}>❓</span>
                <span>Hilfe & Anleitung</span>
              </div>
            </Link>

            {hasRole(['user']) && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                padding: '12px',
                backgroundColor: '#f8f9fa',
                borderRadius: '6px',
                transition: 'background-color 0.2s',
                cursor: 'pointer'
              }} onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#e9ecef';
              }} onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#f8f9fa';
              }}>
                <span style={{ marginRight: '10px', fontSize: '18px' }}>📝</span>
                <span>Meine Verfügbarkeit bearbeiten</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;