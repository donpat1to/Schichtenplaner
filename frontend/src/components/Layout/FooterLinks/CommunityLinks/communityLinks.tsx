import React from 'react';

export const CommunityContact: React.FC = () => (
  <div style={{ padding: '40px 20px', maxWidth: '800px', margin: '0 auto' }}>
    <h1>📞 Kontakt</h1>
    <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '30px', marginTop: '20px' }}>
      <h2 style={{ color: '#2c3e50' }}>Community Edition</h2>
      <p>Kontaktfunktionen sind in der Premium Edition verfügbar.</p>
      <p>
        <a href="/features" style={{ color: '#3498db' }}>
          ➡️ Zu den Features
        </a>
      </p>
    </div>
  </div>
);

export const CommunityLegalPage: React.FC<{ title: string }> = ({ title }) => (
  <div style={{ padding: '40px 20px', maxWidth: '800px', margin: '0 auto' }}>
    <h1>📄 {title}</h1>
    <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '30px', marginTop: '20px' }}>
      <h2 style={{ color: '#2c3e50' }}>Community Edition</h2>
      <p>Rechtliche Dokumentation ist in der Premium Edition verfügbar.</p>
      <p>
        <a href="/features" style={{ color: '#3498db' }}>
          ➡️ Erfahren Sie mehr über Premium
        </a>
      </p>
    </div>
  </div>
);

// Optional: Barrel export für einfachere Imports
export default {
  CommunityContact,
  CommunityLegalPage
};