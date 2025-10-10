// frontend/src/components/Layout/Navigation.tsx
import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';

const Navigation: React.FC = () => {
  const { user, logout, hasRole } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    setIsMobileMenuOpen(false);
  };

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const navigationItems = [
    { path: '/', label: '📊 Dashboard', roles: ['admin', 'instandhalter', 'user'] },
    { path: '/shift-plans', label: '📅 Schichtpläne', roles: ['admin', 'instandhalter', 'user'] },
    { path: '/employees', label: '👥 Mitarbeiter', roles: ['admin', 'instandhalter'] },
    { path: '/help', label: '❓ Hilfe & Support', roles: ['admin', 'instandhalter', 'user'] },
    { path: '/settings', label: '⚙️ Einstellungen', roles: ['admin'] },
  ];

  const filteredNavigation = navigationItems.filter(item => 
    hasRole(item.roles)
  );

  const styles = {
    header: {
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      color: 'white',
      boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
      position: 'sticky' as const,
      top: 0,
      zIndex: 1000,
    },
    headerContent: {
      maxWidth: '1200px',
      margin: '0 auto',
      padding: '0 20px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      height: '70px',
    },
    logo: {
      flex: 1,
    },
    logoH1: {
      margin: 0,
      fontSize: '1.5rem',
      fontWeight: 700,
    },
    desktopNav: {
      display: 'flex',
      gap: '2rem',
      alignItems: 'center',
    },
    navLink: {
      color: 'white',
      textDecoration: 'none',
      padding: '0.5rem 1rem',
      borderRadius: '6px',
      transition: 'all 0.3s ease',
      fontWeight: 500,
    },
    userMenu: {
      display: 'flex',
      alignItems: 'center',
      gap: '1rem',
      marginLeft: '2rem',
    },
    userInfo: {
      fontWeight: 500,
    },
    logoutBtn: {
      background: 'rgba(255, 255, 255, 0.1)',
      color: 'white',
      border: '1px solid rgba(255, 255, 255, 0.3)',
      padding: '0.5rem 1rem',
      borderRadius: '6px',
      cursor: 'pointer',
      transition: 'all 0.3s ease',
    },
    mobileMenuBtn: {
      display: 'none',
      background: 'none',
      border: 'none',
      color: 'white',
      fontSize: '1.5rem',
      cursor: 'pointer',
      padding: '0.5rem',
    },
    mobileNav: {
      display: isMobileMenuOpen ? 'flex' : 'none',
      flexDirection: 'column' as const,
      background: 'white',
      padding: '1rem',
      boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
    },
    mobileNavLink: {
      color: '#333',
      textDecoration: 'none',
      padding: '1rem',
      borderBottom: '1px solid #eee',
      transition: 'background-color 0.3s ease',
    },
    mobileUserInfo: {
      padding: '1rem',
      borderTop: '1px solid #eee',
      marginTop: '1rem',
      color: '#333',
    },
    mobileLogoutBtn: {
      background: '#667eea',
      color: 'white',
      border: 'none',
      padding: '0.5rem 1rem',
      borderRadius: '6px',
      cursor: 'pointer',
      marginTop: '0.5rem',
      width: '100%',
    },
  };

  return (
    <header style={styles.header}>
      <div style={styles.headerContent}>
        <div style={styles.logo}>
          <h1 style={styles.logoH1}>🔄 Schichtenplaner</h1>
        </div>
        
        {/* Desktop Navigation */}
        <nav style={styles.desktopNav}>
          {filteredNavigation.map((item) => (
            <a 
              key={item.path} 
              href={item.path}
              style={styles.navLink}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                e.currentTarget.style.transform = 'translateY(-1px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'none';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
              onClick={(e) => {
                e.preventDefault();
                window.location.href = item.path;
              }}
            >
              {item.label}
            </a>
          ))}
        </nav>

        {/* User Menu */}
        <div style={styles.userMenu}>
          <span style={styles.userInfo}>
            {user?.name} ({user?.role})
          </span>
          <button 
            onClick={handleLogout} 
            style={styles.logoutBtn}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
            }}
          >
            Abmelden
          </button>
        </div>

        {/* Mobile Menu Button */}
        <button 
          style={styles.mobileMenuBtn}
          onClick={toggleMobileMenu}
        >
          ☰
        </button>
      </div>

      {/* Mobile Navigation */}
      {isMobileMenuOpen && (
        <nav style={styles.mobileNav}>
          {filteredNavigation.map((item) => (
            <a 
              key={item.path} 
              href={item.path}
              style={styles.mobileNavLink}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#f5f5f5';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
              onClick={(e) => {
                e.preventDefault();
                window.location.href = item.path;
                setIsMobileMenuOpen(false);
              }}
            >
              {item.label}
            </a>
          ))}
          <div style={styles.mobileUserInfo}>
            <span>{user?.name} ({user?.role})</span>
            <button 
              onClick={handleLogout} 
              style={styles.mobileLogoutBtn}
            >
              Abmelden
            </button>
          </div>
        </nav>
      )}
    </header>
  );
};

export default Navigation;