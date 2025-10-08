// frontend/src/pages/Dashboard/Dashboard.tsx
import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

const Dashboard: React.FC = () => {
  const { user, logout, hasRole } = useAuth();

  return (
    <div style={{ padding: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
        <h1>Schichtplan Dashboard</h1>
        <div>
          <span style={{ marginRight: '15px' }}>Eingeloggt als: <strong>{user?.name}</strong> ({user?.role})</span>
          <button 
            onClick={logout}
            style={{ 
              padding: '8px 16px', 
              backgroundColor: '#dc3545', 
              color: 'white', 
              border: 'none', 
              borderRadius: '4px' 
            }}
          >
            Abmelden
          </button>
        </div>
      </div>

      {/* Admin/Instandhalter Funktionen */}
      {hasRole(['admin', 'instandhalter']) && (
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', 
          gap: '20px', 
          marginBottom: '40px' 
        }}>
          <div style={{ 
            border: '1px solid #007bff', 
            padding: '20px', 
            borderRadius: '8px',
            backgroundColor: '#f8f9fa'
          }}>
            <h3>Schichtplan erstellen</h3>
            <p>Neuen Schichtplan erstellen und verwalten</p>
            <Link to="/shift-plans/new">
              <button style={{ 
                padding: '10px 20px', 
                backgroundColor: '#007bff', 
                color: 'white', 
                border: 'none', 
                borderRadius: '4px' 
              }}>
                Erstellen
              </button>
            </Link>
          </div>

          <div style={{ 
            border: '1px solid #28a745', 
            padding: '20px', 
            borderRadius: '8px',
            backgroundColor: '#f8f9fa'
          }}>
            <h3>Vorlagen verwalten</h3>
            <p>Schichtplan Vorlagen erstellen und bearbeiten</p>
            <Link to="/shift-templates">
              <button style={{ 
                padding: '10px 20px', 
                backgroundColor: '#28a745', 
                color: 'white', 
                border: 'none', 
                borderRadius: '4px' 
              }}>
                Verwalten
              </button>
            </Link>
          </div>

          {hasRole(['admin']) && (
            <div style={{ 
              border: '1px solid #6f42c1', 
              padding: '20px', 
              borderRadius: '8px',
              backgroundColor: '#f8f9fa'
            }}>
              <h3>Benutzer verwalten</h3>
              <p>Benutzerkonten erstellen und verwalten</p>
              <Link to="/user-management">
                <button style={{ 
                  padding: '10px 20px', 
                  backgroundColor: '#6f42c1', 
                  color: 'white', 
                  border: 'none', 
                  borderRadius: '4px' 
                }}>
                  Verwalten
                </button>
              </Link>
            </div>
          )}
        </div>
      )}

      {/* Aktuelle Schichtpläne */}
      <div style={{ 
        border: '1px solid #ddd', 
        padding: '20px', 
        borderRadius: '8px'
      }}>
        <h2>Aktuelle Schichtpläne</h2>
        <div style={{ padding: '20px', textAlign: 'center', color: '#666' }}>
          <p>Noch keine Schichtpläne vorhanden.</p>
          {hasRole(['admin', 'instandhalter']) && (
            <Link to="/shift-plans/new">
              <button style={{ 
                padding: '10px 20px', 
                backgroundColor: '#007bff', 
                color: 'white', 
                border: 'none', 
                borderRadius: '4px' 
              }}>
                Ersten Schichtplan erstellen
              </button>
            </Link>
          )}
        </div>
      </div>

      {/* Schnellzugriff für alle User */}
      <div style={{ marginTop: '30px' }}>
        <h3>Schnellzugriff</h3>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <Link to="/shift-templates">
            <button style={{ 
              padding: '8px 16px', 
              border: '1px solid #007bff', 
              backgroundColor: 'white', 
              color: '#007bff',
              borderRadius: '4px' 
            }}>
              Vorlagen ansehen
            </button>
          </Link>
          
          {hasRole(['user']) && (
            <button style={{ 
              padding: '8px 16px', 
              border: '1px solid #28a745', 
              backgroundColor: 'white', 
              color: '#28a745',
              borderRadius: '4px' 
            }}>
              Meine Schichten
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;