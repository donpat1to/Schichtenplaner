// frontend/src/components/Layout/Layout.tsx
import React from 'react';
import Navigation from './Navigation';
import Footer from './Footer';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const styles = {
    layout: {
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column' as const,
      background: '#FBFAF6',
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      lineHeight: 1.6,
      color: '#161718',
    },
    mainContent: {
      flex: 1,
      minHeight: 'calc(100vh - 140px)',
      paddingTop: '80px',
    },
    contentContainer: {
      maxWidth: '1200px',
      margin: '0 auto',
      padding: '3rem 2rem',
    },
  };

  return (
    <div style={styles.layout}>
      <Navigation />
      
      <main style={styles.mainContent}>
        <div style={styles.contentContainer}>
          {children}
        </div>
      </main>
      
      <Footer />
    </div>
  );
};

export default Layout;