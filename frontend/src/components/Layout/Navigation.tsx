// frontend/src/components/Layout/Navigation.tsx
import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

const Navigation: React.FC = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { user, logout, hasRole } = useAuth();
  const location = useLocation();

  const isActive = (path: string) => location.pathname === path;

const navigationItems = [
    { path: '/', label: 'Dashboard', icon: '🏠', roles: ['admin', 'instandhalter', 'user'] },
    { path: '/shift-plans', label: 'Schichtpläne', icon: '📅', roles: ['admin', 'instandhalter', 'user'] },
    { path: '/employees', label: 'Mitarbeiter', icon: '👥', roles: ['admin', 'instandhalter'] },
    { path: '/settings', label: 'Einstellungen', icon: '⚙️', roles: ['admin'] },
    { path: '/help', label: 'Hilfe', icon: '❓', roles: ['admin', 'instandhalter', 'user'] },
];

  const filteredNavigation = navigationItems.filter(item => 
    hasRole(item.roles)
  );

  return (
    <>
      {/* Desktop Navigation */}
      <nav style={{
        backgroundColor: '#2c3e50',
        padding: '0 20px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          maxWidth: '1200px',
          margin: '0 auto'
        }}>
          {/* Logo/Brand */}
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <Link 
              to="/" 
              style={{
                color: 'white',
                textDecoration: 'none',
                fontSize: '20px',
                fontWeight: 'bold',
                padding: '15px 0'
              }}
            >
              🗓️ SchichtPlaner
            </Link>
          </div>

          {/* Desktop Menu */}
          <div style={{ 
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}>
            {filteredNavigation.map(item => (
              <Link
                key={item.path}
                to={item.path}
                style={{
                  color: 'white',
                  textDecoration: 'none',
                  padding: '15px 20px',
                  borderRadius: '4px',
                  backgroundColor: isActive(item.path) ? '#3498db' : 'transparent',
                  transition: 'background-color 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
                onMouseEnter={(e) => {
                  if (!isActive(item.path)) {
                    e.currentTarget.style.backgroundColor = '#34495e';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive(item.path)) {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }
                }}
              >
                <span>{item.icon}</span>
                {item.label}
              </Link>
            ))}
          </div>

          {/* User Menu */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <span style={{ color: 'white', fontSize: '14px' }}>
              {user?.name} ({user?.role})
            </span>
            <button
              onClick={logout}
              style={{
                background: 'none',
                border: '1px solid #e74c3c',
                color: '#e74c3c',
                padding: '8px 16px',
                borderRadius: '4px',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#e74c3c';
                e.currentTarget.style.color = 'white';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.color = '#e74c3c';
              }}
            >
              Abmelden
            </button>
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            style={{
              display: 'block',
              background: 'none',
              border: 'none',
              color: 'white',
              fontSize: '24px',
              cursor: 'pointer'
            }}
          >
            ☰
          </button>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div style={{
            display: 'block',
            backgroundColor: '#34495e',
            padding: '10px 0'
          }}>
            {filteredNavigation.map(item => (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setMobileMenuOpen(false)}
                style={{
                  display: 'block',
                  color: 'white',
                  textDecoration: 'none',
                  padding: '12px 20px',
                  borderBottom: '1px solid #2c3e50'
                }}
              >
                <span style={{ marginRight: '10px' }}>{item.icon}</span>
                {item.label}
              </Link>
            ))}
          </div>
        )}
      </nav>

      {/* Breadcrumbs */}
      <div style={{
        backgroundColor: '#ecf0f1',
        padding: '10px 20px',
        borderBottom: '1px solid #bdc3c7',
        fontSize: '14px'
      }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          {/* Breadcrumb wird dynamisch basierend auf der Route gefüllt */}
          <span style={{ color: '#7f8c8d' }}>
            🏠 Dashboard {location.pathname !== '/' && '>'} 
            {location.pathname === '/shift-plans' && ' 📅 Schichtpläne'}
            {location.pathname === '/employees' && ' 👥 Mitarbeiter'}
            {location.pathname === '/settings' && ' ⚙️ Einstellungen'}
            {location.pathname === '/help' && ' ❓ Hilfe'}
          </span>
        </div>
      </div>
    </>
  );
};

export default Navigation;