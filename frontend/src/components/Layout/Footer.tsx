// frontend/src/components/Layout/Footer.tsx
import React from 'react';
import { Link } from 'react-router-dom';

const Footer: React.FC = () => {
  return (
    <footer style={{
      backgroundColor: '#34495e',
      color: 'white',
      padding: '30px 20px',
      marginTop: 'auto'
    }}>
      <div style={{
        maxWidth: '1200px',
        margin: '0 auto',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '30px'
      }}>
        {/* App Info */}
        <div>
          <h4 style={{ marginBottom: '15px' }}>🗓️ SchichtPlaner</h4>
          <p style={{ fontSize: '14px', lineHeight: '1.5' }}>
            Einfache Schichtplanung für Ihr Team. 
            Optimierte Arbeitszeiten, transparente Planung.
          </p>
        </div>

        {/* Quick Links */}
        <div>
          <h4 style={{ marginBottom: '15px' }}>Schnellzugriff</h4>
          <ul style={{ listStyle: 'none', padding: 0, fontSize: '14px' }}>
            <li style={{ marginBottom: '8px' }}>
              <Link to="/help" style={{ color: '#bdc3c7', textDecoration: 'none' }}>
                📖 Anleitung
              </Link>
            </li>
            <li style={{ marginBottom: '8px' }}>
              <Link to="/help/faq" style={{ color: '#bdc3c7', textDecoration: 'none' }}>
                ❓ Häufige Fragen
              </Link>
            </li>
            <li style={{ marginBottom: '8px' }}>
              <Link to="/help/support" style={{ color: '#bdc3c7', textDecoration: 'none' }}>
                💬 Support
              </Link>
            </li>
          </ul>
        </div>

        {/* Legal Links */}
        <div>
          <h4 style={{ marginBottom: '15px' }}>Rechtliches</h4>
          <ul style={{ listStyle: 'none', padding: 0, fontSize: '14px' }}>
            <li style={{ marginBottom: '8px' }}>
              <Link to="/impressum" style={{ color: '#bdc3c7', textDecoration: 'none' }}>
                📄 Impressum
              </Link>
            </li>
            <li style={{ marginBottom: '8px' }}>
              <Link to="/datenschutz" style={{ color: '#bdc3c7', textDecoration: 'none' }}>
                🔒 Datenschutz
              </Link>
            </li>
            <li style={{ marginBottom: '8px' }}>
              <Link to="/agb" style={{ color: '#bdc3c7', textDecoration: 'none' }}>
                📝 AGB
              </Link>
            </li>
          </ul>
        </div>

        {/* Contact */}
        <div>
          <h4 style={{ marginBottom: '15px' }}>Kontakt</h4>
          <div style={{ fontSize: '14px', color: '#bdc3c7' }}>
            <p>📧 support@schichtplaner.de</p>
            <p>📞 +49 123 456 789</p>
            <p>🕘 Mo-Fr: 9:00-17:00</p>
          </div>
        </div>
      </div>
      
      <div style={{
        borderTop: '1px solid #2c3e50',
        marginTop: '30px',
        paddingTop: '20px',
        textAlign: 'center',
        fontSize: '12px',
        color: '#95a5a6'
      }}>
        <p>© 2024 SchichtPlaner. Alle Rechte vorbehalten.</p>
      </div>
    </footer>
  );
};

export default Footer;