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
      
      {/* Algorithm Visualization */}
      <div style={{ 
        backgroundColor: 'white', 
        borderRadius: '12px', 
        padding: '30px', 
        marginTop: '20px',
        boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
        border: '1px solid #e0e0e0'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ margin: 0, color: '#2c3e50' }}>🧠 Algorithmus Visualisierung</h2>
          <button
            onClick={toggleAnimation}
            style={{
              padding: '8px 16px',
              backgroundColor: isAnimating ? '#e74c3c' : '#2ecc71',
              color: 'white',
              border: 'none',
              borderRadius: '20px',
              cursor: 'pointer',
              fontWeight: 'bold'
            }}
          >
            {isAnimating ? '⏸️ Animation pausieren' : '▶️ Animation starten'}
          </button>
        </div>

        {/* Stage Indicators */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          marginBottom: '30px',
          position: 'relative'
        }}>
          {algorithmStages.map((stage, index) => (
            <React.Fragment key={index}>
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  flex: 1
                }}
              >
                <div
                  style={{
                    width: '60px',
                    height: '60px',
                    borderRadius: '50%',
                    backgroundColor: currentStage === index ? stage.color : '#ecf0f1',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: currentStage === index ? 'white' : '#7f8c8d',
                    fontWeight: 'bold',
                    fontSize: '18px',
                    transition: 'all 0.5s ease',
                    boxShadow: currentStage === index ? `0 0 20px ${stage.color}80` : 'none',
                    border: `3px solid ${stage.color}`
                  }}
                >
                  {index + 1}
                </div>
                <div style={{ 
                  textAlign: 'center', 
                  marginTop: '10px',
                  fontWeight: currentStage === index ? 'bold' : 'normal',
                  color: currentStage === index ? stage.color : '#7f8c8d'
                }}>
                  {stage.title.split(':')[0]}
                </div>
              </div>
              
              {index < algorithmStages.length - 1 && (
                <div style={{
                  flex: 1,
                  height: '3px',
                  backgroundColor: currentStage > index ? stage.color : '#ecf0f1',
                  alignSelf: 'center',
                  margin: '0 10px',
                  transition: 'all 0.5s ease'
                }} />
              )}
            </React.Fragment>
          ))}
        </div>

        {/* Current Stage Details */}
          <div style={{
            backgroundColor: algorithmStages[currentStage].color + '15',
            border: `2px solid ${algorithmStages[currentStage].color}30`,
            borderRadius: '8px',
            padding: '20px',
            marginBottom: '20px',
            transition: 'all 0.5s ease'
          }}>
            <h3 style={{ color: algorithmStages[currentStage].color, marginTop: 0 }}>
              {algorithmStages[currentStage].title}
            </h3>
            <p style={{ color: '#2c3e50', fontSize: '16px', marginBottom: '15px' }}>
              {algorithmStages[currentStage].description}
            </p>
            <div style={{ display: 'grid', gap: '8px' }}>
              {algorithmStages[currentStage].steps.map((step, stepIndex) => (
                <div
                  key={stepIndex}
                  style={{
                    padding: '10px 15px',
                    backgroundColor: 'white',
                    borderRadius: '6px',
                    borderLeft: `4px solid ${algorithmStages[currentStage].color}`,
                    display: 'flex',
                    alignItems: 'center',
                    animation: isAnimating ? 'pulse 2s infinite' : 'none'
                  }}
                >
                  <span style={{ 
                    marginRight: '10px', 
                    color: algorithmStages[currentStage].color,
                    fontWeight: 'bold'
                  }}>•</span>
                  {step}
                </div>
              ))}
            </div>
          </div>

        {/* Network Visualization */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '15px',
          marginTop: '30px'
        }}>
          {/* Employees */}
          <div style={{
            backgroundColor: '#e8f4fd',
            padding: '15px',
            borderRadius: '8px',
            border: '1px solid #b8d4f0'
          }}>
            <h4 style={{ margin: '0 0 10px 0', color: '#3498db' }}>👥 Mitarbeiter</h4>
            <div style={{ fontSize: '14px', lineHeight: '1.4' }}>
              <div>• Manager (1)</div>
              <div>• Erfahrene ({currentStage >= 1 ? '3' : '0'})</div>
              <div>• Neue ({currentStage >= 1 ? '2' : '0'})</div>
            </div>
          </div>

          {/* Shifts */}
          <div style={{
            backgroundColor: '#fff3cd',
            padding: '15px',
            borderRadius: '8px',
            border: '1px solid #ffeaa7'
          }}>
            <h4 style={{ margin: '0 0 10px 0', color: '#f39c12' }}>📅 Schichten</h4>
            <div style={{ fontSize: '14px', lineHeight: '1.4' }}>
              <div>• Vormittag (5)</div>
              <div>• Nachmittag (4)</div>
              <div>• Manager-Schichten (3)</div>
            </div>
          </div>

          {/* Current Actions */}
          <div style={{
            backgroundColor: '#d4edda',
            padding: '15px',
            borderRadius: '8px',
            border: '1px solid #c3e6cb'
          }}>
            <h4 style={{ margin: '0 0 10px 0', color: '#27ae60' }}>⚡ Aktive Aktionen</h4>
            <div style={{ fontSize: '14px', lineHeight: '1.4' }}>
              {currentStage === 0 && (
                <>
                  <div>• Grundzuweisung läuft</div>
                  <div>• Erfahrene priorisieren</div>
                </>
              )}
              {currentStage === 1 && (
                <>
                  <div>• Manager wird zugewiesen</div>
                  <div>• Erfahrene suchen</div>
                </>
              )}
              {currentStage === 2 && (
                <>
                  <div>• Überbesetzung prüfen</div>
                  <div>• Pool-Verwaltung aktiv</div>
                </>
              )}
              {currentStage === 3 && (
                <>
                  <div>• Finale Validierung</div>
                  <div>• Bericht generieren</div>
                </>
              )}
            </div>
          </div>

          {/* Problems & Solutions */}
          <div style={{
            backgroundColor: '#f8d7da',
            padding: '15px',
            borderRadius: '8px',
            border: '1px solid #f5c6cb'
          }}>
            <h4 style={{ margin: '0 0 10px 0', color: '#e74c3c' }}>🔍 Probleme & Lösungen</h4>
            <div style={{ fontSize: '14px', lineHeight: '1.4' }}>
              {currentStage >= 2 ? (
                <>
                  <div style={{ color: '#27ae60' }}>✅ 2 Probleme behoben</div>
                  <div style={{ color: '#e74c3c' }}>❌ 0 kritische Probleme</div>
                  <div style={{ color: '#f39c12' }}>⚠️ 1 Warnung</div>
                </>
              ) : (
                <div>Noch keine Probleme analysiert</div>
              )}
            </div>
          </div>
        </div>
      </div>

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
          
          <div>
            <h4 style={{ color: '#e74c3c' }}>⚖️ Wert-basierte Entscheidungen</h4>
            <p>Jede Zuweisung wird anhand eines Wertesystems bewertet, das Verfügbarkeit, Erfahrung und aktuelle Auslastung berücksichtigt.</p>
          </div>
          
          <div>
            <h4 style={{ color: '#2ecc71' }}>🔧 Automatische Reparatur</h4>
            <p>Probleme werden automatisch erkannt und durch intelligente Tausch- und Bewegungsoperationen behoben.</p>
          </div>
          
          <div>
            <h4 style={{ color: '#f39c12' }}>📊 Transparente Berichterstattung</h4>
            <p>Detaillierte Berichte zeigen genau, welche Probleme behoben wurden und welche verbleiben.</p>
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