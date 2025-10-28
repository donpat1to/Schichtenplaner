// frontend/src/components/Layout/FooterLinks/FAQ/FAQ.tsx
import React, { useState } from 'react';

const FAQ: React.FC = () => {
  const [openItems, setOpenItems] = useState<number[]>([]);

  const toggleItem = (index: number) => {
    setOpenItems(prev => 
      prev.includes(index) 
        ? prev.filter(i => i !== index)
        : [...prev, index]
    );
  };

  const faqItems = [
    {
      question: "Wie funktioniert der Scheduling-Algorithmus?",
      answer: "Unser System verwendet Google's OR-Tools CP-SAT Solver, um optimale Schichtzuweisungen basierend auf Verfügbarkeiten, Vertragstypen und Geschäftsregeln zu berechnen."
    },
    {
      question: "Was bedeuten die Verfügbarkeits-Level 1, 2 und 3?",
      answer: "Level 1: Bevorzugt (Mitarbeiter möchte diese Schicht), Level 2: Verfügbar (kann arbeiten), Level 3: Nicht verfügbar (kann nicht arbeiten)."
    },
    {
      question: "Wie werden Vertragstypen berücksichtigt?",
      answer: "Kleine Verträge: 1 Schicht pro Woche, Große Verträge: 2 Schichten pro Woche. Das System weist genau diese Anzahl zu."
    },
    {
      question: "Kann ich manuelle Anpassungen vornehmen?",
      answer: "Ja, nach dem automatischen Scheduling können Sie Zuordnungen manuell anpassen und optimieren."
    },
    {
      question: "Was passiert bei unterbesetzten Schichten?",
      answer: "Das System zeigt eine Warnung an und versucht, alternative Lösungen zu finden. In kritischen Fällen müssen manuelle Anpassungen vorgenommen werden."
    },
    {
      question: "Wie lange dauert die Planungserstellung?",
      answer: "Typischerweise maximal 105 Sekunden, abhängig von der Anzahl der Mitarbeiter und Schichten."
    }
  ];

  return (
    <div style={{ padding: '40px 20px', maxWidth: '800px', margin: '0 auto' }}>
      <h1>❓ Häufige Fragen (FAQ)</h1>
      
      <div style={{ 
        backgroundColor: 'white', 
        borderRadius: '12px', 
        marginTop: '20px',
        boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
        border: '1px solid #e0e0e0'
      }}>
        {faqItems.map((item, index) => (
          <div key={index} style={{ 
            borderBottom: index < faqItems.length - 1 ? '1px solid #e0e0e0' : 'none',
            padding: '20px 30px'
          }}>
            <div
              onClick={() => toggleItem(index)}
              style={{
                cursor: 'pointer',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}
            >
              <h3 style={{ 
                color: '#2c3e50', 
                margin: 0,
                fontSize: '1.1rem'
              }}>
                {item.question}
              </h3>
              <span style={{ 
                fontSize: '1.5rem',
                color: '#3498db',
                transform: openItems.includes(index) ? 'rotate(45deg)' : 'rotate(0)',
                transition: 'transform 0.2s ease'
              }}>
                +
              </span>
            </div>
            
            {openItems.includes(index) && (
              <div style={{ 
                marginTop: '15px',
                padding: '15px',
                backgroundColor: '#f8f9fa',
                borderRadius: '8px',
                color: '#6c757d',
                lineHeight: 1.6
              }}>
                {item.answer}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default FAQ;