// frontend/src/pages/ShiftPlans/ShiftPlanList.tsx
import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

const ShiftPlanList: React.FC = () => {
  const { hasRole } = useAuth();

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
        <h1>📅 Schichtpläne</h1>
        {hasRole(['admin', 'instandhalter']) && (
          <Link to="/shift-plans/new">
            <button style={{ 
              padding: '10px 20px', 
              backgroundColor: '#3498db', 
              color: 'white', 
              border: 'none', 
              borderRadius: '4px' 
            }}>
              + Neuen Plan
            </button>
          </Link>
        )}
      </div>
      
      <div style={{ 
        padding: '40px', 
        textAlign: 'center', 
        backgroundColor: '#f8f9fa', 
        borderRadius: '8px',
        border: '2px dashed #dee2e6'
      }}>
        <div style={{ fontSize: '48px', marginBottom: '20px' }}>📋</div>
        <h3>Schichtpläne Übersicht</h3>
        <p>Hier werden alle Schichtpläne angezeigt.</p>
        <p style={{ fontSize: '14px', color: '#6c757d' }}>
          Diese Seite wird demnächst mit Funktionen gefüllt.
        </p>
      </div>
    </div>
  );
};

export default ShiftPlanList;