// frontend/src/pages/Dashboard/Dashboard.tsx
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

// Mock Data für die Demo
const mockData = {
  currentShiftPlan: {
    id: '1',
    name: 'November Schichtplan 2024',
    period: '01.11.2024 - 30.11.2024',
    status: 'Aktiv',
    shiftsCovered: 85,
    totalShifts: 120
  },
  upcomingShifts: [
    { id: '1', date: 'Heute', time: '08:00 - 16:00', type: 'Frühschicht', assigned: true },
    { id: '2', date: 'Morgen', time: '14:00 - 22:00', type: 'Spätschicht', assigned: true },
    { id: '3', date: '15.11.2024', time: '08:00 - 16:00', type: 'Frühschicht', assigned: false }
  ],
  teamStats: {
    totalEmployees: 24,
    availableToday: 18,
    onVacation: 3,
    sickLeave: 2
  },
  recentActivities: [
    { id: '1', action: 'Schichtplan veröffentlicht', user: 'Max Mustermann', time: 'vor 2 Stunden' },
    { id: '2', action: 'Mitarbeiter hinzugefügt', user: 'Sarah Admin', time: 'vor 4 Stunden' },
    { id: '3', action: 'Verfügbarkeit geändert', user: 'Tom Bauer', time: 'vor 1 Tag' }
  ]
};

const Dashboard: React.FC = () => {
  const { user, hasRole } = useAuth();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simuliere Daten laden
    setTimeout(() => setLoading(false), 1000);
  }, []);

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '40px' }}>
        <div>⏳ Lade Dashboard...</div>
      </div>
    );
  }

  return (
    <div>
      {/* Willkommens-Bereich */}
      <div style={{ 
        backgroundColor: '#e8f4fd', 
        padding: '25px', 
        borderRadius: '8px',
        marginBottom: '30px',
        border: '1px solid #b6d7e8'
      }}>
        <h1 style={{ margin: '0 0 10px 0', color: '#2c3e50' }}>
          Willkommen zurück, {user?.name}! 👋
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
          <div style={{ marginBottom: '15px' }}>
            <div style={{ fontWeight: 'bold', fontSize: '18px' }}>
              {mockData.currentShiftPlan.name}
            </div>
            <div style={{ color: '#666', fontSize: '14px' }}>
              {mockData.currentShiftPlan.period}
            </div>
          </div>
          
          <div style={{ marginBottom: '15px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
              <span>Fortschritt:</span>
              <span>{mockData.currentShiftPlan.shiftsCovered}/{mockData.currentShiftPlan.totalShifts} Schichten</span>
            </div>
            <div style={{
              width: '100%',
              backgroundColor: '#ecf0f1',
              borderRadius: '10px',
              overflow: 'hidden'
            }}>
              <div style={{
                width: `${(mockData.currentShiftPlan.shiftsCovered / mockData.currentShiftPlan.totalShifts) * 100}%`,
                backgroundColor: '#3498db',
                height: '8px',
                borderRadius: '10px'
              }} />
            </div>
          </div>
          
          <div style={{
            display: 'inline-block',
            backgroundColor: mockData.currentShiftPlan.status === 'Aktiv' ? '#2ecc71' : '#f39c12',
            color: 'white',
            padding: '4px 12px',
            borderRadius: '20px',
            fontSize: '12px',
            fontWeight: 'bold'
          }}>
            {mockData.currentShiftPlan.status}
          </div>
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
              <span>Gesamt Mitarbeiter:</span>
              <span style={{ fontWeight: 'bold', fontSize: '18px' }}>
                {mockData.teamStats.totalEmployees}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Verfügbar heute:</span>
              <span style={{ fontWeight: 'bold', color: '#2ecc71' }}>
                {mockData.teamStats.availableToday}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Im Urlaub:</span>
              <span style={{ fontWeight: 'bold', color: '#f39c12' }}>
                {mockData.teamStats.onVacation}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Krankgeschrieben:</span>
              <span style={{ fontWeight: 'bold', color: '#e74c3c' }}>
                {mockData.teamStats.sickLeave}
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
            <div style={{ display: 'grid', gap: '10px' }}>
              {mockData.upcomingShifts.map(shift => (
                <div key={shift.id} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '12px',
                  backgroundColor: '#f8f9fa',
                  borderRadius: '6px',
                  border: shift.assigned ? '1px solid #d4edda' : '1px solid #fff3cd'
                }}>
                  <div>
                    <div style={{ fontWeight: 'bold' }}>{shift.date}</div>
                    <div style={{ fontSize: '14px', color: '#666' }}>{shift.time}</div>
                    <div style={{ fontSize: '12px', color: '#999' }}>{shift.type}</div>
                  </div>
                  <div style={{
                    padding: '4px 8px',
                    backgroundColor: shift.assigned ? '#d4edda' : '#fff3cd',
                    color: shift.assigned ? '#155724' : '#856404',
                    borderRadius: '4px',
                    fontSize: '12px',
                    fontWeight: 'bold'
                  }}>
                    {shift.assigned ? 'Zugewiesen' : 'Noch offen'}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Letzte Aktivitäten (für Admins/Instandhalter) */}
        {hasRole(['admin', 'instandhalter']) && (
          <div style={{
            backgroundColor: 'white',
            padding: '20px',
            borderRadius: '8px',
            border: '1px solid #e0e0e0',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
          }}>
            <h3 style={{ margin: '0 0 15px 0', color: '#2c3e50' }}>📝 Letzte Aktivitäten</h3>
            <div style={{ display: 'grid', gap: '12px' }}>
              {mockData.recentActivities.map(activity => (
                <div key={activity.id} style={{
                  padding: '12px',
                  backgroundColor: '#f8f9fa',
                  borderRadius: '6px',
                  borderLeft: '4px solid #3498db'
                }}>
                  <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>
                    {activity.action}
                  </div>
                  <div style={{ fontSize: '14px', color: '#666' }}>
                    von {activity.user}
                  </div>
                  <div style={{ fontSize: '12px', color: '#999' }}>
                    {activity.time}
                  </div>
                </div>
              ))}
            </div>
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