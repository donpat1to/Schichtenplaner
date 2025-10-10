// frontend/src/components/Layout/Footer.tsx
import React from 'react';

const Footer: React.FC = () => {
  const styles = {
    footer: {
      background: '#2c3e50',
      color: 'white',
      marginTop: 'auto',
    },
    footerContent: {
      maxWidth: '1200px',
      margin: '0 auto',
      padding: '2rem 20px',
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
      gap: '2rem',
    },
    footerSection: {
      display: 'flex',
      flexDirection: 'column' as const,
    },
    footerSectionH3: {
      marginBottom: '1rem',
      color: '#ecf0f1',
      fontSize: '1.2rem',
    },
    footerSectionH4: {
      marginBottom: '1rem',
      color: '#ecf0f1',
      fontSize: '1.1rem',
    },
    footerLink: {
      color: '#bdc3c7',
      textDecoration: 'none',
      marginBottom: '0.5rem',
      transition: 'color 0.3s ease',
    },
    footerBottom: {
      borderTop: '1px solid #34495e',
      padding: '1rem 20px',
      textAlign: 'center' as const,
      color: '#95a5a6',
    },
  };

  return (
    <footer style={styles.footer}>
      <div style={styles.footerContent}>
        <div style={styles.footerSection}>
          <h3 style={styles.footerSectionH3}>Schichtenplaner</h3>
          <p style={{color: '#bdc3c7', margin: 0}}>
            Professionelle Schichtplanung für Ihr Team. 
            Effiziente Personalplanung für optimale Abläufe.
          </p>
        </div>
        
        <div style={styles.footerSection}>
          <h4 style={styles.footerSectionH4}>Support & Hilfe</h4>
          <a 
            href="/help" 
            style={styles.footerLink}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = '#3498db';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = '#bdc3c7';
            }}
          >
            Hilfe & Anleitungen
          </a>
          <a 
            href="/contact" 
            style={styles.footerLink}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = '#3498db';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = '#bdc3c7';
            }}
          >
            Kontakt & Support
          </a>
          <a 
            href="/faq" 
            style={styles.footerLink}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = '#3498db';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = '#bdc3c7';
            }}
          >
            Häufige Fragen
          </a>
        </div>
        
        <div style={styles.footerSection}>
          <h4 style={styles.footerSectionH4}>Rechtliches</h4>
          <a 
            href="/privacy" 
            style={styles.footerLink}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = '#3498db';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = '#bdc3c7';
            }}
          >
            Datenschutzerklärung
          </a>
          <a 
            href="/imprint" 
            style={styles.footerLink}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = '#3498db';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = '#bdc3c7';
            }}
          >
            Impressum
          </a>
          <a 
            href="/terms" 
            style={styles.footerLink}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = '#3498db';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = '#bdc3c7';
            }}
          >
            Allgemeine Geschäftsbedingungen
          </a>
        </div>
        
        <div style={styles.footerSection}>
          <h4 style={styles.footerSectionH4}>Unternehmen</h4>
          <a 
            href="/about" 
            style={styles.footerLink}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = '#3498db';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = '#bdc3c7';
            }}
          >
            Über uns
          </a>
          <a 
            href="/features" 
            style={styles.footerLink}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = '#3498db';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = '#bdc3c7';
            }}
          >
            Funktionen
          </a>
          <a 
            href="/pricing" 
            style={styles.footerLink}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = '#3498db';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = '#bdc3c7';
            }}
          >
            Preise
          </a>
        </div>
      </div>
      
      <div style={styles.footerBottom}>
        <p style={{margin: 0}}>
          &copy; 2025 Schichtenplaner. Alle Rechte vorbehalten. | 
          Made with ❤️ for efficient team management
        </p>
      </div>
    </footer>
  );
};

export default Footer;