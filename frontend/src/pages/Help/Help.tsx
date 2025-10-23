// frontend/src/pages/Help/Help.tsx
import React from 'react';

const Help: React.FC = () => {
  const businessRules = [
    { rule: "Mitarbeiter werden nur Schichten zugewiesen, für die sie sich eingetragen haben", critical: true },
    { rule: "Maximal 1 Schicht pro Tag pro Mitarbeiter", critical: true },
    { rule: "Schichten haben Mindest- und Maximalkapazitäten", critical: true },
    { rule: "Trainees benötigen erfahrene Begleitung in jeder Schicht", critical: true },
    { rule: "Mitarbeiter, die nicht alleine arbeiten können, müssen Begleitung haben", critical: true },
    { rule: "Vertragslimits: Klein=1 Schicht/Woche, Groß=2 Schichten/Woche", critical: true },
    { rule: "Manager werden automatisch ihren bevorzugten Schichten zugewiesen", critical: false }
  ];

  const schedulingStages = [
    {
      title: "1. Verfügbarkeitsprüfung",
      description: "Nur Mitarbeiter, die sich für Schichten eingetragen haben (Verfügbarkeit 1 oder 2), werden berücksichtigt."
    },
    {
      title: "2. Modellaufbau",
      description: "Das System erstellt ein mathematisches Modell mit allen Variablen und Constraints."
    },
    {
      title: "3. CP-SAT Optimierung", 
      description: "Google's Constraint Programming Solver findet die beste Zuordnung unter allen Regeln."
    },
    {
      title: "4. Manager-Zuweisung",
      description: "Manager werden automatisch ihren Wunschschichten (Verfügbarkeit 1) zugeordnet."
    },
    {
      title: "5. Validierung",
      description: "Die Lösung wird auf Regelverletzungen geprüft und ein Bericht generiert."
    }
  ];

  const preferenceLevels = [
    { level: 1, label: "Bevorzugt", description: "Mitarbeiter möchte diese Schicht unbedingt arbeiten", color: "#27ae60" },
    { level: 2, label: "Verfügbar", description: "Mitarbeiter ist verfügbar für diese Schicht", color: "#f39c12" },
    { level: 3, label: "Nicht verfügbar", description: "Mitarbeiter kann diese Schicht nicht arbeiten", color: "#e74c3c" }
  ];

  return (
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      <h1>❓ Hilfe & Support - Scheduling Algorithmus</h1>
      
      {/* Business Rules */}
      <div style={{ 
        backgroundColor: 'white', 
        borderRadius: '12px', 
        padding: '30px', 
        marginTop: '20px',
        boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
        border: '1px solid #e0e0e0'
      }}>
        <h2 style={{ color: '#2c3e50', marginBottom: '20px' }}>📋 Geschäftsregeln</h2>
        <div style={{ display: 'grid', gap: '10px' }}>
          {businessRules.map((rule, index) => (
            <div
              key={index}
              style={{
                padding: '12px 16px',
                backgroundColor: rule.critical ? '#f8d7da' : '#fff3cd',
                border: `1px solid ${rule.critical ? '#f5c6cb' : '#ffeaa7'}`,
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center'
              }}
            >
              <span style={{ 
                marginRight: '12px',
                color: rule.critical ? '#e74c3c' : '#f39c12',
                fontWeight: 'bold',
                fontSize: '16px'
              }}>
                {rule.critical ? '❌' : '⚠️'}
              </span>
              <span style={{ color: rule.critical ? '#721c24' : '#856404' }}>
                {rule.rule}
              </span>
              <span style={{ 
                marginLeft: 'auto',
                fontSize: '12px',
                color: rule.critical ? '#e74c3c' : '#f39c12',
                fontWeight: 'bold'
              }}>
                {rule.critical ? 'HART' : 'WEICH'}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Scheduling Process */}
      <div style={{ 
        backgroundColor: 'white', 
        borderRadius: '12px', 
        padding: '30px', 
        marginTop: '20px',
        boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
        border: '1px solid #e0e0e0'
      }}>
        <h2 style={{ color: '#2c3e50', marginBottom: '20px' }}>⚙️ Scheduling-Prozess</h2>
        
        <div style={{ display: 'grid', gap: '15px' }}>
          {schedulingStages.map((stage, index) => (
            <div key={index} style={{
              padding: '20px',
              backgroundColor: '#f8f9fa',
              borderRadius: '8px',
              border: '2px solid #e9ecef',
              display: 'flex',
              alignItems: 'flex-start'
            }}>
              <div style={{
                backgroundColor: '#3498db',
                color: 'white',
                borderRadius: '50%',
                width: '30px',
                height: '30px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 'bold',
                marginRight: '15px',
                flexShrink: 0
              }}>
                {index + 1}
              </div>
              <div>
                <h4 style={{ color: '#2c3e50', margin: '0 0 8px 0' }}>{stage.title}</h4>
                <p style={{ color: '#6c757d', margin: 0 }}>{stage.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Preference Levels */}
      <div style={{ 
        backgroundColor: 'white', 
        borderRadius: '12px', 
        padding: '30px', 
        marginTop: '20px',
        boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
        border: '1px solid #e0e0e0'
      }}>
        <h2 style={{ color: '#2c3e50', marginBottom: '20px' }}>🎯 Verfügbarkeits-Level</h2>
        
        <div style={{ display: 'grid', gap: '12px' }}>
          {preferenceLevels.map((pref) => (
            <div key={pref.level} style={{
              padding: '15px',
              backgroundColor: `${pref.color}15`,
              border: `2px solid ${pref.color}`,
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center'
            }}>
              <div style={{
                backgroundColor: pref.color,
                color: 'white',
                borderRadius: '6px',
                padding: '8px 12px',
                fontWeight: 'bold',
                marginRight: '15px',
                minWidth: '120px',
                textAlign: 'center'
              }}>
                Level {pref.level}: {pref.label}
              </div>
              <span style={{ color: '#2c3e50' }}>{pref.description}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Tips */}
      <div style={{ 
        marginTop: '25px',
        padding: '25px',
        backgroundColor: '#e8f4fd',
        borderRadius: '12px',
        border: '2px solid #b8d4f0'
      }}>
        <h3 style={{ color: '#2980b9', marginTop: 0 }}>💡 Best Practices für erfolgreiches Scheduling</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '15px', marginTop: '15px' }}>
          <div>
            <h4 style={{ color: '#2980b9' }}>Vor dem Scheduling</h4>
            <ul style={{ margin: 0, paddingLeft: '20px', color: '#2c3e50' }}>
              <li>Stellen Sie sicher, dass alle Mitarbeiter ihre Verfügbarkeit eingetragen haben</li>
              <li>Überprüfen Sie die Mitarbeiterprofile (Trainee/Erfahren, Alleinarbeit möglich)</li>
              <li>Bestätigen Sie die Vertragstypen und Schichtanforderungen</li>
            </ul>
          </div>
          <div>
            <h4 style={{ color: '#2980b9' }}>Nach dem Scheduling</h4>
            <ul style={{ margin: 0, paddingLeft: '20px', color: '#2c3e50' }}>
              <li>Prüfen Sie den Lösungsbericht auf Verletzungen</li>
              <li>Kontrollieren Sie unterbesetzte Schichten</li>
              <li>Validieren Sie Trainee-Betreuung und Alleinarbeits-Regeln</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Technical Info */}
      <div style={{ 
        marginTop: '25px',
        padding: '20px',
        backgroundColor: '#fff3cd',
        borderRadius: '8px',
        border: '1px solid #ffeaa7'
      }}>
        <h4 style={{ color: '#856404', marginTop: 0 }}>🔧 Technische Informationen</h4>
        <p style={{ color: '#856404', margin: 0 }}>
          <strong>Lösungsalgorithmus:</strong> Google OR-Tools CP-SAT Solver • 
          <strong> Fallback:</strong> TypeScript-basierter Solver • 
          <strong> Maximale Laufzeit:</strong> 105 Sekunden
        </p>
      </div>
    </div>
  );
};

export default Help;