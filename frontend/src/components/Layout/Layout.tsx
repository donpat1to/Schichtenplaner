// frontend/src/components/Layout/Layout.tsx - KORRIGIERT
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
    },
    mainContent: {
      flex: 1,
      backgroundColor: '#f8f9fa',
      minHeight: 'calc(100vh - 140px)',
    },
    contentContainer: {
      maxWidth: '1200px',
      margin: '0 auto',
      padding: '2rem 20px',
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