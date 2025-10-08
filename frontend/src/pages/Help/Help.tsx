// frontend/src/pages/Help/Help.tsx
import React from 'react';

const Help: React.FC = () => {
  return (
    <div>
      <h1>❓ Hilfe & Support</h1>
      
      <div style={{ 
        padding: '40px', 
        textAlign: 'center', 
        backgroundColor: '#f8f9fa', 
        borderRadius: '8px',
        border: '2px dashed #dee2e6',
        marginTop: '20px'
      }}>
        <div style={{ fontSize: '48px', marginBottom: '20px' }}>📖</div>
        <h3>Hilfe Center</h3>
        <p>Hier finden Sie Anleitungen und Support für die Schichtplan-App.</p>
        <p style={{ fontSize: '14px', color: '#6c757d' }}>
          Diese Seite wird demnächst mit Funktionen gefüllt.
        </p>
      </div>
    </div>
  );
};

export default Help;