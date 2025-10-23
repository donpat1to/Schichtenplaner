// frontend/src/pages/About/About.tsx
import React from 'react';

const About: React.FC = () => {
  return (
    <div style={{ padding: '40px 20px', maxWidth: '800px', margin: '0 auto' }}>
      <h1>👨‍💻 Über uns</h1>
      
      <div style={{ 
        backgroundColor: 'white', 
        borderRadius: '12px', 
        padding: '30px', 
        marginTop: '20px',
        boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
        border: '1px solid #e0e0e0',
        lineHeight: 1.6
      }}>
        <h2 style={{ color: '#2c3e50' }}>Unser Team</h2>
        
        <div style={{ display: 'flex', alignItems: 'center', marginTop: '20px', padding: '20px', backgroundColor: '#f8f9fa', borderRadius: '8px' }}>
          <div style={{ marginRight: '20px' }}>
            <div style={{ 
              width: '80px', 
              height: '80px', 
              backgroundColor: '#3498db', 
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontSize: '2rem',
              fontWeight: 'bold'
            }}>
              P
            </div>
          </div>
          <div>
            <h3 style={{ color: '#2c3e50', margin: '0 0 5px 0' }}>Patrick</h3>
            <p style={{ color: '#6c757d', margin: '0 0 10px 0' }}>
              Full-Stack Developer & Projektleiter
            </p>
            <p style={{ margin: 0, fontSize: '0.9rem' }}>
              GitHub: <a href="https://github.com/donpat1to" style={{ color: '#3498db' }}>donpat1to</a><br/>
              E-Mail: <a href="mailto:dev.patrick@inca-vikingo.de" style={{ color: '#3498db' }}>dev.patrick@inca-vikingo.de</a>
            </p>
          </div>
        </div>
        
        <h3 style={{ color: '#3498db', marginTop: '30px' }}>🚀 Unsere Mission</h3>
        <p>
          Wir entwickeln intelligente Lösungen für die Personalplanung, 
          die Zeit sparen und faire Schichtverteilung gewährleisten.
        </p>
        
        <h3 style={{ color: '#3498db', marginTop: '25px' }}>💻 Technologie</h3>
        <p>
          Unser Stack umfasst moderne Technologien:
        </p>
        <ul>
          <li>Frontend: React, TypeScript</li>
          <li>Backend: Node.js, Express</li>
          <li>Optimierung: Google OR-Tools CP-SAT</li>
          <li>Datenbank: SQLite/PostgreSQL</li>
        </ul>
        
        <h3 style={{ color: '#3498db', marginTop: '25px' }}>📈 Entwicklung</h3>
        <p>
          Schichtenplaner wird kontinuierlich weiterentwickelt und 
          basiert auf Feedback unserer Nutzer.
        </p>
      </div>
    </div>
  );
};

export default About;