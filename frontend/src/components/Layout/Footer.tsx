// frontend/src/components/Layout/Footer.tsx - ELEGANT WHITE DESIGN
import React from 'react';

const Footer: React.FC = () => {
  const styles = {
    footer: {
      background: 'linear-gradient(0deg, #161718 0%, #24163a 100%)',
      color: 'white',
      marginTop: 'auto',
      borderTop: '1px solid rgba(251, 250, 246, 0.1)',
    },
    footerContent: {
      maxWidth: '1200px',
      margin: '0 auto',
      padding: '3rem 2rem 2rem',
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
      gap: '3rem',
    },
    footerSection: {
      display: 'flex',
      flexDirection: 'column' as const,
    },
    footerSectionH3: {
      marginBottom: '1.5rem',
      color: '#FBFAF6',
      fontSize: '1.1rem',
      fontWeight: 600,
    },
    footerSectionH4: {
      marginBottom: '1rem',
      color: '#FBFAF6',
      fontSize: '1rem',
      fontWeight: 600,
    },
    footerLink: {
      color: 'rgba(251, 250, 246, 0.7)',
      textDecoration: 'none',
      marginBottom: '0.75rem',
      transition: 'all 0.2s ease',
      fontSize: '0.9rem',
    },
    footerBottom: {
      borderTop: '1px solid rgba(251, 250, 246, 0.1)',
      padding: '1.5rem 2rem',
      textAlign: 'center' as const,
      color: '#FBFAF6',
      fontSize: '0.9rem',
    },
  };

  return (
    <footer style={styles.footer}>
      <div style={styles.footerContent}>
        <div style={styles.footerSection}>
          <h3 style={styles.footerSectionH3}>Schichtenplaner</h3>
          <p style={{color: 'rgba(251, 250, 246, 0.7)', margin: 0, lineHeight: 1.6}}>
            Professionelle Schichtplanung für Ihr Team. 
            Effiziente Personalplanung für optimale Abläube.
          </p>
        </div>
        
        <div style={styles.footerSection}>
          <h4 style={styles.footerSectionH4}>Support & Hilfe</h4>
          <a 
            href="/help" 
            style={styles.footerLink}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = '#FBFAF6';
              e.currentTarget.style.transform = 'translateX(4px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'rgba(251, 250, 246, 0.7)';
              e.currentTarget.style.transform = 'translateX(0)';
            }}
          >
            Hilfe & Anleitungen
          </a>
          <a 
            href="/contact" 
            style={styles.footerLink}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = '#FBFAF6';
              e.currentTarget.style.transform = 'translateX(4px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'rgba(251, 250, 246, 0.7)';
              e.currentTarget.style.transform = 'translateX(0)';
            }}
          >
            Kontakt & Support
          </a>
          <a 
            href="/faq" 
            style={styles.footerLink}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = '#FBFAF6';
              e.currentTarget.style.transform = 'translateX(4px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'rgba(251, 250, 246, 0.7)';
              e.currentTarget.style.transform = 'translateX(0)';
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
              e.currentTarget.style.color = '#FBFAF6';
              e.currentTarget.style.transform = 'translateX(4px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'rgba(251, 250, 246, 0.7)';
              e.currentTarget.style.transform = 'translateX(0)';
            }}
          >
            Datenschutzerklärung
          </a>
          <a 
            href="/imprint" 
            style={styles.footerLink}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = '#FBFAF6';
              e.currentTarget.style.transform = 'translateX(4px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'rgba(251, 250, 246, 0.7)';
              e.currentTarget.style.transform = 'translateX(0)';
            }}
          >
            Impressum
          </a>
          <a 
            href="/terms" 
            style={styles.footerLink}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = '#FBFAF6';
              e.currentTarget.style.transform = 'translateX(4px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'rgba(251, 250, 246, 0.7)';
              e.currentTarget.style.transform = 'translateX(0)';
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
              e.currentTarget.style.color = '#FBFAF6';
              e.currentTarget.style.transform = 'translateX(4px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'rgba(251, 250, 246, 0.7)';
              e.currentTarget.style.transform = 'translateX(0)';
            }}
          >
            Über uns
          </a>
          <a 
            href="/features" 
            style={styles.footerLink}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = '#FBFAF6';
              e.currentTarget.style.transform = 'translateX(4px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'rgba(251, 250, 246, 0.7)';
              e.currentTarget.style.transform = 'translateX(0)';
            }}
          >
            Funktionen
          </a>
          <a 
            href="/pricing" 
            style={styles.footerLink}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = '#FBFAF6';
              e.currentTarget.style.transform = 'translateX(4px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'rgba(251, 250, 246, 0.7)';
              e.currentTarget.style.transform = 'translateX(0)';
            }}
          >
            Preise
          </a>
        </div>
      </div>
      
      <div style={styles.footerBottom}>
        <p style={{margin: 0}}>
          &copy; 2025 Schichtenplaner | 
          Made with <span style={{ color: '#854eca' }}>♥</span> for efficient team management
        </p>
      </div>
    </footer>
  );
};

export default Footer;