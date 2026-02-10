// frontend/src/pages/Dashboard/components/DayAssignmentsPopup.tsx
import React, { useState, useEffect } from 'react';
import { employeeService } from '../../../services/employeeService';
import { Employee } from '../../../models/Employee';
import { CalendarDayAssignment } from '../Dashboard';
import { ResolvedHoliday } from '../../../models/Holiday';

interface DayAssignmentsPopupProps {
  date: string;
  assignments: CalendarDayAssignment[];
  holiday?: ResolvedHoliday;
  onClose: () => void;
}

const DayAssignmentsPopup: React.FC<DayAssignmentsPopupProps> = ({
  date,
  assignments,
  holiday,
  onClose
}) => {
  const isFullHoliday = holiday && !holiday.halfDay;
  const [employees, setEmployees] = useState<Map<string, Employee>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadEmployees();
  }, [assignments]);

  const loadEmployees = async () => {
    try {
      setLoading(true);
      const allEmployees = await employeeService.getEmployees();
      const employeeMap = new Map<string, Employee>();
      allEmployees.forEach(emp => employeeMap.set(emp.id, emp));
      setEmployees(employeeMap);
    } catch (error) {
      console.error('Error loading employees:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('de-DE', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    });
  };

  const getEmployeeName = (assignment: CalendarDayAssignment): string => {
    if (assignment.employeeName) {
      return assignment.employeeName;
    }
    const employee = employees.get(assignment.employeeId);
    return employee ? `${employee.firstname} ${employee.lastname}` : 'Unbekannt';
  };

  const getPlanTypeBadge = (type: 'shift' | 'weekly') => ({
    label: type === 'shift' ? 'Schichtplan' : 'Wochenplan',
    color: type === 'shift' ? '#3498db' : '#9b59b6'
  });

  // Group assignments by plan
  const groupedAssignments = assignments.reduce((acc, assignment) => {
    const key = `${assignment.planType}-${assignment.planName}`;
    if (!acc[key]) {
      acc[key] = {
        planName: assignment.planName,
        planType: assignment.planType,
        assignments: []
      };
    }
    acc[key].assignments.push(assignment);
    return acc;
  }, {} as Record<string, { planName: string; planType: 'shift' | 'weekly'; assignments: CalendarDayAssignment[] }>);

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.3)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1100
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          padding: '20px',
          width: '90%',
          maxWidth: '450px',
          maxHeight: '80vh',
          overflow: 'auto',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.2)'
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: '16px'
        }}>
          <div>
            <h3 style={{ margin: '0 0 4px 0', color: isFullHoliday ? '#856404' : '#2c3e50' }}>
              {isFullHoliday ? 'Feiertag' : 'Zuweisungen'}
            </h3>
            <div style={{ fontSize: '14px', color: '#666' }}>
              {formatDate(date)}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '20px',
              cursor: 'pointer',
              color: '#666',
              padding: '0',
              lineHeight: '1'
            }}
          >
            &#10005;
          </button>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '20px', color: '#666' }}>
            Lade Daten...
          </div>
        ) : isFullHoliday ? (
          // Full-day holiday: Show holiday info + affected employees
          <div>
            {/* Holiday Info */}
            <div style={{
              padding: '16px',
              backgroundColor: '#fff3cd',
              borderRadius: '8px',
              borderLeft: '4px solid #ffc107',
              marginBottom: '16px'
            }}>
              <div style={{
                fontSize: '18px',
                fontWeight: 'bold',
                color: '#856404',
                marginBottom: holiday.description ? '8px' : '0'
              }}>
                {holiday.name}
              </div>
              {holiday.description && (
                <div style={{ fontSize: '14px', color: '#856404', fontStyle: 'italic' }}>
                  {holiday.description}
                </div>
              )}
            </div>

            {/* Affected Employees Section */}
            {assignments.length > 0 && (
              <div>
                <div style={{
                  fontSize: '14px',
                  fontWeight: 'bold',
                  color: '#666',
                  marginBottom: '12px'
                }}>
                  Betroffene Mitarbeiter
                </div>
                <div style={{ display: 'grid', gap: '12px' }}>
                  {Object.values(groupedAssignments).map((group, groupIndex) => {
                    const typeBadge = getPlanTypeBadge(group.planType);

                    return (
                      <div key={groupIndex}>
                        <details open>
                          <summary style={{
                            fontSize: '1rem',
                            fontWeight: 600,
                            color: '#161718',
                            margin: '0 0 0.5rem 0',
                            cursor: 'pointer'
                          }}>
                            <span style={{ fontWeight: 'bold', color: '#2c3e50' }}>
                              {group.planName}
                            </span>
                            <span style={{
                              padding: '2px 8px',
                              backgroundColor: typeBadge.color,
                              color: 'white',
                              borderRadius: '10px',
                              fontSize: '10px',
                              fontWeight: 'bold',
                              marginLeft: '10px',
                            }}>
                              {typeBadge.label}
                            </span>
                          </summary>

                          <div style={{
                            padding: '8px 12px',
                            backgroundColor: '#f8f9fa',
                            borderRadius: '6px',
                            fontSize: '14px',
                            color: '#666'
                          }}>
                            {group.assignments.map(a => getEmployeeName(a)).join(', ')}
                          </div>
                        </details>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {assignments.length === 0 && (
              <div style={{ textAlign: 'center', padding: '12px', color: '#666' }}>
                Keine betroffenen Mitarbeiter
              </div>
            )}
          </div>
        ) : (
          // Normal day or half-day holiday: Show assignments (with holiday banner for half-day)
          <div>
            {/* Half-day holiday banner */}
            {holiday && holiday.halfDay && (
              <div style={{
                padding: '12px',
                backgroundColor: '#fff3cd',
                borderRadius: '8px',
                borderLeft: '4px solid #ffc107',
                marginBottom: '16px'
              }}>
                <div style={{
                  fontSize: '15px',
                  fontWeight: 'bold',
                  color: '#856404',
                  marginBottom: '4px'
                }}>
                  {holiday.name}
                </div>
                <div style={{ fontSize: '12px', color: '#856404' }}>
                  {holiday.halfDay === 'morning' ? 'Vormittag frei' : 'Nachmittag frei'}
                </div>
                {holiday.description && (
                  <div style={{ fontSize: '12px', color: '#856404', fontStyle: 'italic', marginTop: '4px' }}>
                    {holiday.description}
                  </div>
                )}
              </div>
            )}

            {assignments.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '20px', color: '#666' }}>
                Keine Zuweisungen an diesem Tag.
              </div>
            ) : (
              <div style={{ display: 'grid', gap: '16px' }}>
                {Object.values(groupedAssignments).map((group, groupIndex) => {
                  const typeBadge = getPlanTypeBadge(group.planType);

                  return (
                    <div key={groupIndex}>
                      <details>
                        <summary style={{
                          fontSize: '1rem',
                          fontWeight: 600,
                          color: '#161718',
                          margin: '0 0 1rem 0'
                        }}>
                          <span style={{ fontWeight: 'bold', color: '#2c3e50' }}>
                            {group.planName}
                          </span>
                          <span style={{
                            padding: '2px 8px',
                            backgroundColor: typeBadge.color,
                            color: 'white',
                            borderRadius: '10px',
                            fontSize: '10px',
                            fontWeight: 'bold',
                            marginLeft: '10px',
                          }}>
                            {typeBadge.label}
                          </span>
                        </summary>

                        {/* Assignments List */}
                        <div style={{ display: 'grid', gap: '8px' }}>
                          {group.assignments.map((assignment, index) => (
                            <div
                              key={index}
                              style={{
                                padding: '12px',
                                backgroundColor: '#f8f9fa',
                                borderRadius: '6px',
                                borderLeft: `3px solid ${typeBadge.color}`
                              }}
                            >
                              <div style={{
                                fontWeight: '500',
                                color: '#333',
                                marginBottom: assignment.planType === 'shift' ? '4px' : '0'
                              }}>
                                {getEmployeeName(assignment)}
                              </div>

                              {assignment.planType === 'shift' && (
                                <div style={{
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: '2px'
                                }}>
                                  {assignment.timeSlotName && (
                                    <div style={{ fontSize: '13px', color: '#666' }}>
                                      {assignment.timeSlotName}
                                    </div>
                                  )}
                                  {assignment.startTime && assignment.endTime && (
                                    <div style={{ fontSize: '12px', color: '#999' }}>
                                      {assignment.startTime} - {assignment.endTime}
                                    </div>
                                  )}
                                </div>
                              )}

                              {assignment.planType === 'weekly' && (
                                <div style={{ fontSize: '12px', color: '#999' }}>
                                  Wochenzuweisung
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </details>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Summary */}
        {!loading && assignments.length > 0 && !isFullHoliday && (
          <div style={{
            marginTop: '16px',
            paddingTop: '12px',
            borderTop: '1px solid #eee',
            fontSize: '13px',
            color: '#666',
            textAlign: 'center'
          }}>
            {assignments.length} Zuweisung{assignments.length !== 1 ? 'en' : ''} an diesem Tag
          </div>
        )}
      </div>
    </div>
  );
};

export default DayAssignmentsPopup;
