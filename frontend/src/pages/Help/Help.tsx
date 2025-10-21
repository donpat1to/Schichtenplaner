// frontend/src/pages/Help/Help.tsx
import React, { useState, useEffect } from 'react';

const Help: React.FC = () => {
  const [currentStage, setCurrentStage] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);

  const algorithmStages = [
    {
      title: "📊 Phase A: Reguläre Mitarbeiterplanung",
      description: "Zuweisung aller Mitarbeiter außer Manager",
      steps: [
        "Grundabdeckung: Mindestens 1 Mitarbeiter pro Schicht",
        "Erfahrene Mitarbeiter werden bevorzugt",
        "Verhindere 'Neu allein' Situationen",
        "Fülle Schichten bis zur Zielbesetzung"
      ],
      color: "#3498db"
    },
    {
      title: "👑 Phase B: Manager-Einfügung",
      description: "Manager wird seinen bevorzugten Schichten zugewiesen",
      steps: [
        "Manager wird festen Schichten zugewiesen",
        "Erfahrene Mitarbeiter werden zu Manager-Schichten hinzugefügt",
        "Bei Problemen: Austausch oder Bewegung von Mitarbeitern",
        "Fallback: Nicht-erfahrene als Backup"
      ],
      color: "#e74c3c"
    },
    {
      title: "🔧 Phase C: Reparatur & Validierung",
      description: "Probleme erkennen und automatisch beheben",
      steps: [
        "Überbesetzte erfahrene Mitarbeiter identifizieren",
        "Mitarbeiter-Pool für Neuverteilung erstellen",
        "Priorisierte Zuweisung zu Problem-Schichten",
        "Finale Validierung aller Geschäftsregeln"
      ],
      color: "#2ecc71"
    },
    {
      title: "✅ Finale Prüfung",
      description: "Zusammenfassung und Freigabe",
      steps: [
        "Reparatur-Bericht generieren",
        "Kritische vs. nicht-kritische Probleme klassifizieren",
        "Veröffentlichungsstatus bestimmen",
        "Benutzerfreundliche Zusammenfassung anzeigen"
      ],
      color: "#f39c12"
    }
  ];

  const businessRules = [
    { rule: "Manager darf nicht allein arbeiten", critical: true },
    { rule: "Erfahrene mit canWorkAlone: false dürfen nicht allein arbeiten", critical: true },
    { rule: "Keine leeren Schichten", critical: true },
    { rule: "Keine 'Neu allein' Situationen", critical: true },
    { rule: "Manager sollte mit erfahrenem Mitarbeiter arbeiten", critical: false },
    { rule: "Vertragslimits einhalten", critical: true },
    { rule: "Nicht zu viele erfahrene Mitarbeiter in einer Schicht", critical: false }
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      if (isAnimating) {
        setCurrentStage((prev) => (prev + 1) % algorithmStages.length);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [isAnimating]);

  const toggleAnimation = () => {
    setIsAnimating(!isAnimating);
  };

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
        <h2 style={{ color: '#2c3e50', marginBottom: '20px' }}>📋 Validierungs Regeln</h2>
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
                {rule.critical ? 'KRITISCH' : 'WARNUNG'}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Algorithm Explanation */}
      <div style={{ 
        backgroundColor: 'white', 
        borderRadius: '12px', 
        padding: '30px', 
        marginTop: '20px',
        boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
        border: '1px solid #e0e0e0'
      }}>
        <h2 style={{ color: '#2c3e50', marginBottom: '20px' }}>🎯 Wie der Algorithmus funktioniert</h2>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
          <div>
            <h4 style={{ color: '#3498db' }}>🏗️ Phasen-basierter Ansatz</h4>
            <p>Der Algorithmus arbeitet in klar definierten Phasen, um komplexe Probleme schrittweise zu lösen und Stabilität zu gewährleisten.</p>
          </div>
        </div>        
      </div>

      <div style={{ 
          marginTop: '25px',
          padding: '20px',
          backgroundColor: '#e8f4fd',
          borderRadius: '8px',
          border: '1px solid #b8d4f0'
        }}>
          <h4 style={{ color: '#2980b9', marginTop: 0 }}>💡 Tipps für beste Ergebnisse</h4>
          <ul style={{ margin: 0, paddingLeft: '20px' }}>
            <li>Stellen Sie sicher, dass alle Mitarbeiter ihre Verfügbarkeit eingetragen haben</li>
            <li>Überprüfen Sie die Vertragstypen (klein = 1 Schicht/Woche, groß = 2 Schichten/Woche)</li>
            <li>Markieren Sie erfahrene Mitarbeiter, die alleine arbeiten können</li>
            <li>Planen Sie Manager-Verfügbarkeit im Voraus</li>
          </ul>
        </div>

      <style>{`
        @keyframes pulse {
          0% { transform: scale(1); }
          50% { transform: scale(1.02); }
          100% { transform: scale(1); }
        }
        
        @keyframes glow {
          0% { box-shadow: 0 0 5px rgba(52, 152, 219, 0.5); }
          50% { box-shadow: 0 0 20px rgba(52, 152, 219, 0.8); }
          100% { box-shadow: 0 0 5px rgba(52, 152, 219, 0.5); }
        }
      `}</style>
    </div>
  );
};

export default Help;