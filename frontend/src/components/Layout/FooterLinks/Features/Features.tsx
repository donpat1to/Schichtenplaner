// frontend/src/pages/Features/Features.tsx
import React from 'react';

const Features: React.FC = () => {
  const features = [
    {
      icon: "🤖",
      title: "Automatisches Scheduling",
      description: "Intelligenter Algorithmus erstellt optimale Schichtpläne basierend auf Verfügbarkeiten und Regeln"
    },
    {
      icon: "⚡",
      title: "Schnelle Berechnung",
      description: "Google OR-Tools CP-SAT Solver findet Lösungen in 30-105 Sekunden"
    },
    {
      icon: "👥",
      title: "Flexible Regelkonfiguration",
      description: "Anpassbare Geschäftsregeln für Trainee-Betreuung, Alleinarbeit, Vertragstypen"
    },
    {
      icon: "📊",
      title: "Echtzeit-Validierung",
      description: "Automatische Erkennung von Regelverletzungen und Konflikten"
    },
    {
      icon: "🔒",
      title: "Lokale Datenspeicherung",
      description: "Alle Daten bleiben in Ihrer Infrastruktur - volle Kontrolle und Datenschutz"
    },
    {
      icon: "🎯",
      title: "Präferenz-basiert",
      description: "Berücksichtigt Mitarbeiterwünsche für höhere Zufriedenheit"
    }
  ];

  return (
    <div style={{ padding: '40px 20px', maxWidth: '1000px', margin: '0 auto' }}>
      <h1>✨ Funktionen</h1>
      
      <div style={{ 
        backgroundColor: 'white', 
        borderRadius: '12px', 
        padding: '30px', 
        marginTop: '20px',
        boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
        border: '1px solid #e0e0e0'
      }}>
        <h2 style={{ color: '#2c3e50', textAlign: 'center', marginBottom: '40px' }}>
          Alles, was Sie für die perfekte Schichtplanung benötigen
        </h2>
        
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', 
          gap: '30px' 
        }}>
          {features.map((feature, index) => (
            <div key={index} style={{
              padding: '25px',
              backgroundColor: '#f8f9fa',
              borderRadius: '12px',
              border: '2px solid #e9ecef',
              textAlign: 'center',
              transition: 'transform 0.2s ease, box-shadow 0.2s ease'
            }}>
              <div style={{ 
                fontSize: '3rem',
                marginBottom: '15px'
              }}>
                {feature.icon}
              </div>
              <h3 style={{ 
                color: '#2c3e50',
                margin: '0 0 15px 0'
              }}>
                {feature.title}
              </h3>
              <p style={{ 
                color: '#6c757d',
                margin: 0,
                lineHeight: 1.5
              }}>
                {feature.description}
              </p>
            </div>
          ))}
        </div>
        
        <div style={{ 
          marginTop: '40px',
          padding: '25px',
          backgroundColor: '#e8f4fd',
          borderRadius: '12px',
          border: '2px solid #b8d4f0',
          textAlign: 'center'
        }}>
          <h3 style={{ color: '#2980b9', margin: '0 0 15px 0' }}>
            🚀 Starter Sie durch
          </h3>
          <p style={{ color: '#2c3e50', margin: 0 }}>
            Erstellen Sie Ihren ersten optimierten Schichtplan in wenigen Minuten.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Features;