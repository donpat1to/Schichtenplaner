// frontend/src/pages/Settings/Settings.tsx
import React from 'react';

const Settings: React.FC = () => {
  return (
    <div>
      <h1>⚙️ Einstellungen</h1>
      
      <div style={{ 
        padding: '40px', 
        textAlign: 'center', 
        backgroundColor: '#f8f9fa', 
        borderRadius: '8px',
        border: '2px dashed #dee2e6',
        marginTop: '20px'
      }}>
        <div style={{ fontSize: '48px', marginBottom: '20px' }}>⚙️</div>
        <h3>System Einstellungen</h3>
        <p>Hier können Sie Systemweite Einstellungen vornehmen.</p>
        <p style={{ fontSize: '14px', color: '#6c757d' }}>
          Diese Seite wird demnächst mit Funktionen gefüllt.
        </p>
      </div>
    </div>
  );
};

export default Settings;