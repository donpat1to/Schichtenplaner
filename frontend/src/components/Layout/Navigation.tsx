// frontend/src/components/Layout/Navigation.tsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import PillNav from '../PillNav/PillNav';

const Navigation: React.FC = () => {
  const { user, logout, hasRole } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [activePath, setActivePath] = useState('/');
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    setActivePath(window.location.pathname);
    
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleLogout = () => {
    logout();
    setIsMobileMenuOpen(false);
  };

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const navigationItems = [
    { path: '/', label: 'Dashboard', roles: ['admin', 'maintenance', 'user'] },
    { path: '/shift-plans', label: 'Schichtpläne', roles: ['admin', 'maintenance', 'user'] },
    { path: '/employees', label: 'Mitarbeiter', roles: ['admin', 'maintenance'] },
    { path: '/help', label: 'Hilfe', roles: ['admin', 'maintenance', 'user'] },
    { path: '/settings', label: 'Einstellungen', roles: ['admin', 'maintenance', 'user'] },
  ];

  const filteredNavigation = navigationItems.filter(item => 
    hasRole(item.roles)
  );

  const handlePillChange = (path: string) => {
    setActivePath(path);
    window.location.href = path;
  };

  const pillNavItems = filteredNavigation.map(item => ({
    id: item.path,
    label: item.label
  }));

  const styles = {
    header: {
      background: isScrolled 
        ? 'rgba(251, 250, 246, 0.95)'
        : '#FBFAF6',
      backdropFilter: isScrolled ? 'blur(10px)' : 'none',
      borderBottom: isScrolled 
        ? '1px solid rgba(22, 23, 24, 0.08)'
        : '1px solid transparent',
      color: '#161718',
      position: 'fixed' as const,
      top: 0,
      left: 0,
      right: 0,
      zIndex: 1000,
      transition: 'all 0.3s ease-in-out',
      boxShadow: isScrolled 
        ? '0 2px 20px rgba(22, 23, 24, 0.06)'
        : 'none',
    },
    headerContent: {
      maxWidth: '1200px',
      margin: '0 auto',
      padding: '0 2rem',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      height: '70px',
      transition: 'all 0.3s ease',
    },
    logo: {
      flex: 1,
      display: 'flex',
      justifyContent: 'flex-start',
    },
    logoH1: {
      margin: 0,
      fontSize: '1.5rem',
      fontWeight: 700,
      color: '#161718',
      letterSpacing: '-0.02em',
    },
    pillNavWrapper: {
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      flex: 2,
      minWidth: 0,
    },
    pillNavContainer: {
      display: 'flex',
      justifyContent: 'center',
      maxWidth: '600px',
      width: '100%',
      margin: '0 auto',
    },
    userMenu: {
      flex: 1,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'flex-end',
      gap: '1.5rem',
    },
    userInfo: {
      fontWeight: 500,
      color: '#666',
      fontSize: '0.9rem',
      textAlign: 'right' as const,
    },
    logoutBtn: {
      background: 'transparent',
      color: '#161718',
      border: '1.5px solid #51258f',
      padding: '0.5rem 1.25rem',
      borderRadius: '8px',
      cursor: 'pointer',
      transition: 'all 0.2s ease-in-out',
      fontWeight: 500,
      fontSize: '0.9rem',
      whiteSpace: 'nowrap' as const,
    },
    mobileMenuBtn: {
      display: 'none',
      background: 'none',
      border: 'none',
      color: '#161718',
      fontSize: '1.5rem',
      cursor: 'pointer',
      padding: '0.5rem',
      borderRadius: '4px',
      transition: 'background-color 0.2s ease',
    },
    mobileNav: {
      display: isMobileMenuOpen ? 'flex' : 'none',
      flexDirection: 'column' as const,
      background: '#FBFAF6',
      padding: '1rem 0',
      borderTop: '1px solid rgba(22, 23, 24, 0.1)',
      boxShadow: '0 4px 20px rgba(22, 23, 24, 0.08)',
    },
    mobileNavLink: {
      color: '#161718',
      textDecoration: 'none',
      padding: '1rem 2rem',
      borderBottom: '1px solid rgba(22, 23, 24, 0.05)',
      transition: 'all 0.2s ease',
      fontWeight: 500,
    },
    mobileUserInfo: {
      padding: '1.5rem 2rem',
      borderTop: '1px solid rgba(22, 23, 24, 0.1)',
      marginTop: '0.5rem',
      color: '#666',
    },
    mobileLogoutBtn: {
      background: '#51258f',
      color: 'white',
      border: 'none',
      padding: '0.75rem 1.5rem',
      borderRadius: '8px',
      cursor: 'pointer',
      marginTop: '1rem',
      width: '100%',
      fontWeight: 500,
      transition: 'all 0.2s ease',
    },
  };

  return (
    <header style={styles.header}>
      <div style={styles.headerContent}>
        {/* Logo - Links */}
        <div style={styles.logo}>
          <h1 style={styles.logoH1}>Schichtenplaner</h1>
        </div>
        
        {/* PillNav - Zentriert */}
        <div style={styles.pillNavWrapper}>
          <div style={styles.pillNavContainer}>
            <PillNav
              items={pillNavItems}
              activeId={activePath}
              onChange={handlePillChange}
              variant="solid"
            />
          </div>
        </div>

        {/* User Menu - Rechts */}
        <div style={styles.userMenu}>
          <span style={styles.userInfo}>
            {user?.firstname} {user?.lastname} <span style={{color: '#999'}}>({user?.roles})</span>
          </span>
          <button 
            onClick={handleLogout} 
            style={styles.logoutBtn}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#51258f';
              e.currentTarget.style.color = 'white';
              e.currentTarget.style.transform = 'translateY(-1px)';
              e.currentTarget.style.borderColor = '#51258f';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = '#161718';
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.borderColor = '#51258f';
            }}
          >
            Abmelden
          </button>
        </div>

        {/* Mobile Menu Button */}
        <button 
          style={styles.mobileMenuBtn}
          onClick={toggleMobileMenu}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(81, 37, 143, 0.08)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
          }}
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
                e.currentTarget.style.backgroundColor = 'rgba(81, 37, 143, 0.08)';
                e.currentTarget.style.color = '#51258f';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.color = '#161718';
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
            <div style={{marginBottom: '0.5rem'}}>
              <span style={{fontWeight: 500}}>{user?.firstname} {user?.lastname}</span>
              <span style={{color: '#999', marginLeft: '0.5rem'}}>({user?.roles})</span>
            </div>
            <button 
              onClick={handleLogout} 
              style={styles.mobileLogoutBtn}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#642ab5';
                e.currentTarget.style.transform = 'translateY(-1px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#51258f';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
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