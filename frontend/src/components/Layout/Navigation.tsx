// frontend/src/components/Layout/Navigation.tsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import PillNav from '../PillNav/PillNav';

const Navigation: React.FC = () => {
  const { user, logout, hasRole } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [activePath, setActivePath] = useState('/');
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileLayout, setIsMobileLayout] = useState(false);

  const headerContentRef = useRef<HTMLDivElement>(null);
  const resizeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pillNavMeasurementRef = useRef<HTMLDivElement>(null);
  const userMenuMeasurementRef = useRef<HTMLDivElement>(null);
  const lastLayoutStateRef = useRef<boolean>(false);

  const navigationItems = [
    { path: '/plans', label: 'Pläne', roles: ['admin', 'maintenance', 'user'] },
    { path: '/my-availability', label: 'Verfügbarkeit', roles: ['admin', 'maintenance', 'user'] },
    { path: '/employees', label: 'Mitarbeiter', roles: ['admin', 'maintenance'] },
    { path: '/holidays', label: 'Feiertage', roles: ['admin'] },
    { path: '/help', label: 'Hilfe', roles: ['admin', 'maintenance', 'user'] },
  ];

  const filteredNavigation = navigationItems.filter(item =>
    hasRole(item.roles)
  );

  const pillNavItems = filteredNavigation.map(item => ({
    id: item.path,
    label: item.label
  }));

  const checkLayout = useCallback(() => {
    if (!headerContentRef.current) return;

    const headerContent = headerContentRef.current;
    const headerWidth = headerContent.offsetWidth;

    // Get actual measured widths
    const measuredPillNavWidth = pillNavMeasurementRef.current?.offsetWidth ?? 0;
    const measuredUserMenuWidth = userMenuMeasurementRef.current?.offsetWidth ?? 0;

    // Fixed widths
    const logoWidth = 180;
    const mobileButtonWidth = 50;

    // Calculate total required width
    const totalRequiredWidth = logoWidth + measuredPillNavWidth + 200 + measuredUserMenuWidth;

    // Check if we need mobile layout
    const needsMobileLayout = headerWidth < totalRequiredWidth;

    // Only update if the layout state actually changed
    if (needsMobileLayout !== lastLayoutStateRef.current) {
      setIsMobileLayout(needsMobileLayout);
      lastLayoutStateRef.current = needsMobileLayout;

      // Close mobile menu when switching to desktop
      if (!needsMobileLayout) {
        setIsMobileMenuOpen(false);
      }
    }
  }, [pillNavItems]);

  useEffect(() => {
    setActivePath(window.location.pathname);

    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };

    window.addEventListener('scroll', handleScroll);

    // Initial layout check with debounce
    const checkInitialLayout = () => {
      setTimeout(checkLayout, 100);
    };

    checkInitialLayout();

    // Debounced resize handler
    const handleResize = () => {
      if (resizeTimeoutRef.current) {
        clearTimeout(resizeTimeoutRef.current);
      }

      // Use a longer debounce time to prevent flickering
      resizeTimeoutRef.current = setTimeout(() => {
        checkLayout();
      }, 150);
    };

    window.addEventListener('resize', handleResize);

    // Use IntersectionObserver instead of ResizeObserver for better performance
    const initLayoutObserver = () => {
      // Check layout after a brief delay to ensure DOM is ready
      setTimeout(checkLayout, 200);
    };

    const timeoutId = setTimeout(initLayoutObserver, 300);

    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleResize);

      if (resizeTimeoutRef.current) {
        clearTimeout(resizeTimeoutRef.current);
      }

      clearTimeout(timeoutId);
    };
  }, [checkLayout]);

  // Check layout when user info changes (debounced)
  useEffect(() => {
    if (resizeTimeoutRef.current) {
      clearTimeout(resizeTimeoutRef.current);
    }

    resizeTimeoutRef.current = setTimeout(() => {
      checkLayout();
    }, 100);

    return () => {
      if (resizeTimeoutRef.current) {
        clearTimeout(resizeTimeoutRef.current);
      }
    };
  }, [user?.firstname, user?.lastname, user?.roles, checkLayout]);

  // Check layout when pillNavItems changes (debounced)
  useEffect(() => {
    if (resizeTimeoutRef.current) {
      clearTimeout(resizeTimeoutRef.current);
    }

    resizeTimeoutRef.current = setTimeout(() => {
      checkLayout();
    }, 100);

    return () => {
      if (resizeTimeoutRef.current) {
        clearTimeout(resizeTimeoutRef.current);
      }
    };
  }, [pillNavItems, checkLayout]);

  const handleLogout = () => {
    logout();
    setIsMobileMenuOpen(false);
  };

  const handleSettings = () => {
    window.location.href = '/settings';
  };

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const handlePillChange = (path: string) => {
    setActivePath(path);
    window.location.href = path;
  };

  const handleLogoClick = () => {
    window.location.href = '/';
  };

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
      overflow: 'hidden', // Prevent content from overflowing before switch
    },
    logo: {
      flexShrink: 0,
      minWidth: '150px',
      flex: '0 0 auto',
    },
    logoButton: {
      background: 'none',
      border: 'none',
      cursor: 'pointer',
      padding: 0,
      margin: 0,
      textAlign: 'left' as const,
      transition: 'all 0.2s ease',
    },
    logoH1: {
      margin: 0,
      fontSize: '1.5rem',
      fontWeight: 700,
      color: '#161718',
      letterSpacing: '-0.02em',
      whiteSpace: 'nowrap' as const,
      transition: 'all 0.2s ease',
    },
    pillNavWrapper: {
      display: isMobileLayout ? 'none' : 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      flex: '1 1 auto',
      minWidth: 0,
      margin: '0 1rem',
      opacity: isMobileLayout ? 0 : 1,
      transition: 'opacity 0.2s ease',
    },
    pillNavContainer: {
      display: 'flex',
      justifyContent: 'center',
      maxWidth: '600px',
      width: '100%',
      margin: '0 auto',
    },
    pillNavMeasurement: {
      position: 'absolute' as const,
      top: '-9999px',
      left: '-9999px',
      visibility: 'hidden' as const,
      pointerEvents: 'none' as const,
      display: 'inline-flex',
      alignItems: 'center',
      whiteSpace: 'nowrap' as const,
    },
    userMenu: {
      flexShrink: 0,
      display: isMobileLayout ? 'none' : 'flex',
      alignItems: 'center',
      justifyContent: 'flex-end',
      gap: '1.5rem',
      minWidth: '250px',
      opacity: isMobileLayout ? 0 : 1,
      transition: 'opacity 0.2s ease',
    },
    userMenuMeasurement: {
      position: 'absolute' as const,
      top: '-9999px',
      left: '-9999px',
      visibility: 'hidden' as const,
      pointerEvents: 'none' as const,
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'flex-end',
      gap: '1.5rem',
      whiteSpace: 'nowrap' as const,
    },
    userInfo: {
      fontWeight: 500,
      color: '#666',
      fontSize: '0.9rem',
      textAlign: 'right' as const,
      whiteSpace: 'nowrap' as const,
    },
    settingsBtn: {
      background: 'none',
      border: 'none',
      color: '#161718',
      fontSize: '1.5rem',
      cursor: 'pointer',
      padding: '0.5rem',
      borderRadius: '4px',
      transition: 'all 0.2s ease',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: '40px',
      height: '40px',
      flexShrink: 0,
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
      flexShrink: 0,
    },
    mobileMenuBtn: {
      display: isMobileLayout ? 'block' : 'none',
      background: 'none',
      border: 'none',
      color: '#161718',
      fontSize: '1.5rem',
      cursor: 'pointer',
      padding: '0.5rem',
      borderRadius: '4px',
      transition: 'background-color 0.2s ease',
      flexShrink: 0,
      opacity: isMobileLayout ? 1 : 0,
      //transition: 'opacity 0.2s ease',
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
    mobileUserMenu: {
      display: isMobileLayout ? 'flex' : 'none',
      alignItems: 'center',
      gap: '0.5rem',
      marginLeft: 'auto',
      flexShrink: 0,
      opacity: isMobileLayout ? 1 : 0,
      transition: 'opacity 0.2s ease',
    },
    mobileUserText: {
      fontWeight: 500,
      color: '#161718',
      fontSize: '0.9rem',
      whiteSpace: 'nowrap' as const,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      maxWidth: '150px',
    },
  };

  return (
    <header style={styles.header}>
      <div style={styles.headerContent} ref={headerContentRef}>
        {/* Logo */}
        <div style={styles.logo}>
          <button
            onClick={handleLogoClick}
            style={styles.logoButton}
            onMouseEnter={(e) => {
              e.currentTarget.style.opacity = '0.8';
              e.currentTarget.style.transform = 'translateY(-1px)';
              const h1 = e.currentTarget.querySelector('h1');
              if (h1) {
                h1.style.color = '#51258f';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.opacity = '1';
              e.currentTarget.style.transform = 'translateY(0)';
              const h1 = e.currentTarget.querySelector('h1');
              if (h1) {
                h1.style.color = '#161718';
              }
            }}
            onMouseDown={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.opacity = '0.7';
            }}
            onMouseUp={(e) => {
              e.currentTarget.style.transform = 'translateY(-1px)';
              e.currentTarget.style.opacity = '0.8';
            }}
            title="Zurück zum Dashboard"
          >
            <h1 style={styles.logoH1}>Schichtenplaner</h1>
          </button>
        </div>

        {/* PillNav */}
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

        {/* User Menu */}
        <div style={styles.userMenu}>
          <span style={styles.userInfo}>
            {user?.firstname} {user?.lastname} <span style={{ color: '#999' }}>({user?.roles})</span>
          </span>

          <button
            onClick={handleSettings}
            style={styles.settingsBtn}
            title="Einstellungen"
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(81, 37, 143, 0.08)';
              e.currentTarget.style.color = '#51258f';
              e.currentTarget.style.transform = 'translateY(-1px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = '#161718';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
            onMouseDown={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.background = 'rgba(81, 37, 143, 0.12)';
            }}
            onMouseUp={(e) => {
              e.currentTarget.style.transform = 'translateY(-1px)';
              e.currentTarget.style.background = 'rgba(81, 37, 143, 0.08)';
            }}
          >
            ⚙️
          </button>

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

        {/* Hidden measurements */}
        <div
          ref={pillNavMeasurementRef}
          style={styles.pillNavMeasurement}
          aria-hidden="true"
        >
          <PillNav
            items={pillNavItems}
            activeId={activePath}
            onChange={() => { }}
            variant="solid"
          />
        </div>

        <div
          ref={userMenuMeasurementRef}
          style={styles.userMenuMeasurement}
          aria-hidden="true"
        >
          <span style={styles.userInfo}>
            {user?.firstname} {user?.lastname} <span style={{ color: '#999' }}>({user?.roles})</span>
          </span>
          <button type="button" tabIndex={-1} style={styles.settingsBtn}>
            ⚙️
          </button>
          <button type="button" tabIndex={-1} style={styles.logoutBtn}>
            Abmelden
          </button>
        </div>

        {/* Mobile User Menu */}
        <div style={styles.mobileUserMenu}>
          <span style={styles.mobileUserText}>
            {user?.firstname} {user?.lastname?.charAt(0)}.
          </span>
          <button
            onClick={handleSettings}
            style={styles.settingsBtn}
            title="Einstellungen"
          >
            ⚙️
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
      {isMobileLayout && isMobileMenuOpen && (
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
            <div style={{ marginBottom: '0.5rem' }}>
              <span style={{ fontWeight: 500 }}>{user?.firstname} {user?.lastname}</span>
              <span style={{ color: '#999', marginLeft: '0.5rem' }}>({user?.roles})</span>
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