// frontend/src/pages/Settings/Settings.tsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { employeeService } from '../../services/employeeService';
import { useNotification } from '../../contexts/NotificationContext';
import AvailabilityManager from '../Employees/components/AvailabilityManager';
import { Employee } from '../../models/Employee';

const Settings: React.FC = () => {
  const { user: currentUser, updateUser } = useAuth();
  const { showNotification } = useNotification();
  const [activeTab, setActiveTab] = useState<'profile' | 'password' | 'availability'>('profile');
  const [loading, setLoading] = useState(false);
  const [showAvailabilityManager, setShowAvailabilityManager] = useState(false);
  
  // Profile form state
  const [profileForm, setProfileForm] = useState({
    name: currentUser?.name || ''
  });

  // Password form state
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  useEffect(() => {
    if (currentUser) {
      setProfileForm({
        name: currentUser.name
      });
    }
  }, [currentUser]);

  const handleProfileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setProfileForm(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setPasswordForm(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;

    try {
      setLoading(true);
      await employeeService.updateEmployee(currentUser.id, {
        name: profileForm.name.trim()
      });

      // Update the auth context with new user data
      const updatedUser = await employeeService.getEmployee(currentUser.id);
      updateUser(updatedUser);

      showNotification({
        type: 'success',
        title: 'Erfolg',
        message: 'Profil erfolgreich aktualisiert'
      });
    } catch (error: any) {
      showNotification({
        type: 'error',
        title: 'Fehler',
        message: error.message || 'Profil konnte nicht aktualisiert werden'
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;

    // Validation
    if (passwordForm.newPassword.length < 6) {
      showNotification({
        type: 'error',
        title: 'Fehler',
        message: 'Das neue Passwort muss mindestens 6 Zeichen lang sein'
      });
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      showNotification({
        type: 'error',
        title: 'Fehler',
        message: 'Die Passwörter stimmen nicht überein'
      });
      return;
    }

    try {
      setLoading(true);
      
      // Use the actual password change endpoint
      await employeeService.changePassword(currentUser.id, {
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword
      });

      showNotification({
        type: 'success',
        title: 'Erfolg',
        message: 'Passwort erfolgreich geändert'
      });

      // Clear password form
      setPasswordForm({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      });
    } catch (error: any) {
      showNotification({
        type: 'error',
        title: 'Fehler',
        message: error.message || 'Passwort konnte nicht geändert werden'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAvailabilitySave = () => {
    setShowAvailabilityManager(false);
    showNotification({
      type: 'success',
      title: 'Erfolg',
      message: 'Verfügbarkeit erfolgreich gespeichert'
    });
  };

  const handleAvailabilityCancel = () => {
    setShowAvailabilityManager(false);
  };

  if (!currentUser) {
    return <div>Nicht eingeloggt</div>;
  }

  if (showAvailabilityManager) {
    return (
      <AvailabilityManager
        employee={currentUser as Employee}
        onSave={handleAvailabilitySave}
        onCancel={handleAvailabilityCancel}
      />
    );
  }

  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
      <h1>⚙️ Einstellungen</h1>
      
      {/* Tab Navigation */}
      <div style={{ 
        display: 'flex', 
        borderBottom: '1px solid #e0e0e0',
        marginBottom: '30px'
      }}>
        <button
          onClick={() => setActiveTab('profile')}
          style={{
            padding: '12px 24px',
            backgroundColor: activeTab === 'profile' ? '#3498db' : 'transparent',
            color: activeTab === 'profile' ? 'white' : '#333',
            border: 'none',
            borderBottom: activeTab === 'profile' ? '3px solid #3498db' : 'none',
            cursor: 'pointer',
            fontWeight: 'bold'
          }}
        >
          👤 Profil
        </button>
        <button
          onClick={() => setActiveTab('password')}
          style={{
            padding: '12px 24px',
            backgroundColor: activeTab === 'password' ? '#3498db' : 'transparent',
            color: activeTab === 'password' ? 'white' : '#333',
            border: 'none',
            borderBottom: activeTab === 'password' ? '3px solid #3498db' : 'none',
            cursor: 'pointer',
            fontWeight: 'bold'
          }}
        >
          🔒 Passwort
        </button>
        <button
          onClick={() => setActiveTab('availability')}
          style={{
            padding: '12px 24px',
            backgroundColor: activeTab === 'availability' ? '#3498db' : 'transparent',
            color: activeTab === 'availability' ? 'white' : '#333',
            border: 'none',
            borderBottom: activeTab === 'availability' ? '3px solid #3498db' : 'none',
            cursor: 'pointer',
            fontWeight: 'bold'
          }}
        >
          📅 Verfügbarkeit
        </button>
      </div>

      {/* Profile Tab */}
      {activeTab === 'profile' && (
        <div style={{
          backgroundColor: 'white',
          padding: '30px',
          borderRadius: '8px',
          border: '1px solid #e0e0e0',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
        }}>
          <h2 style={{ marginTop: 0, color: '#2c3e50' }}>Profilinformationen</h2>
          
          <form onSubmit={handleProfileUpdate}>
            <div style={{ display: 'grid', gap: '20px' }}>
              {/* Read-only information */}
              <div style={{
                padding: '15px',
                backgroundColor: '#f8f9fa',
                borderRadius: '6px',
                border: '1px solid #e9ecef'
              }}>
                <h4 style={{ margin: '0 0 15px 0', color: '#495057' }}>Systeminformationen</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', color: '#2c3e50' }}>
                      E-Mail
                    </label>
                    <input
                      type="email"
                      value={currentUser.email}
                      disabled
                      style={{
                        width: '95%',
                        padding: '10px',
                        border: '1px solid #ddd',
                        borderRadius: '4px',
                        backgroundColor: '#f8f9fa',
                        color: '#666'
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', color: '#2c3e50' }}>
                      Rolle
                    </label>
                    <input
                      type="text"
                      value={currentUser.role}
                      disabled
                      style={{
                        width: '95%',
                        padding: '10px',
                        border: '1px solid #ddd',
                        borderRadius: '4px',
                        backgroundColor: '#f8f9fa',
                        color: '#666'
                      }}
                    />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginTop: '15px' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', color: '#2c3e50' }}>
                      Mitarbeiter Typ
                    </label>
                    <input
                      type="text"
                      value={currentUser.employeeType}
                      disabled
                      style={{
                        width: '95%',
                        padding: '10px',
                        border: '1px solid #ddd',
                        borderRadius: '4px',
                        backgroundColor: '#f8f9fa',
                        color: '#666'
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', color: '#2c3e50' }}>
                      Vertragstyp
                    </label>
                    <input
                      type="text"
                      value={currentUser.contractType}
                      disabled
                      style={{
                        width: '95%',
                        padding: '10px',
                        border: '1px solid #ddd',
                        borderRadius: '4px',
                        backgroundColor: '#f8f9fa',
                        color: '#666'
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div
              style={{
                marginTop: '10px',
                padding: '15px',
                backgroundColor: '#f8f9fa',
                borderRadius: '6px',
                border: '1px solid #e9ecef',
              }}
            >
              <label
                style={{
                  display: 'block',
                  marginBottom: '8px',
                  fontWeight: 'bold',
                  color: '#2c3e50',
                }}
              >
                Vollständiger Name *
              </label>
              <input
                type="text"
                name="name"
                value={profileForm.name}
                onChange={handleProfileChange}
                required
                style={{
                  width: '97.5%',
                  padding: '10px',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  fontSize: '16px',
                }}
                placeholder="Ihr vollständiger Name"
              />
            </div>

            <div style={{ 
              display: 'flex', 
              gap: '15px', 
              justifyContent: 'flex-end',
              marginTop: '30px',
              paddingTop: '20px',
              borderTop: '1px solid #f0f0f0'
            }}>
              <button
                type="submit"
                disabled={loading || !profileForm.name.trim()}
                style={{
                  padding: '12px 24px',
                  backgroundColor: loading ? '#bdc3c7' : (!profileForm.name.trim() ? '#95a5a6' : '#27ae60'),
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: (loading || !profileForm.name.trim()) ? 'not-allowed' : 'pointer',
                  fontWeight: 'bold'
                }}
              >
                {loading ? '⏳ Wird gespeichert...' : 'Profil aktualisieren'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Password Tab */}
      {activeTab === 'password' && (
        <div style={{
          backgroundColor: 'white',
          padding: '30px',
          borderRadius: '8px',
          border: '1px solid #e0e0e0',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
        }}>
          <h2 style={{ marginTop: 0, color: '#2c3e50' }}>Passwort ändern</h2>
          
          <form onSubmit={handlePasswordUpdate}>
            <div style={{ display: 'grid', gap: '20px', maxWidth: '400px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#2c3e50' }}>
                  Aktuelles Passwort *
                </label>
                <input
                  type="password"
                  name="currentPassword"
                  value={passwordForm.currentPassword}
                  onChange={handlePasswordChange}
                  required
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    fontSize: '16px'
                  }}
                  placeholder="Aktuelles Passwort"
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#2c3e50' }}>
                  Neues Passwort *
                </label>
                <input
                  type="password"
                  name="newPassword"
                  value={passwordForm.newPassword}
                  onChange={handlePasswordChange}
                  required
                  minLength={6}
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    fontSize: '16px'
                  }}
                  placeholder="Mindestens 6 Zeichen"
                />
                <div style={{ fontSize: '12px', color: '#7f8c8d', marginTop: '5px' }}>
                  Das Passwort muss mindestens 6 Zeichen lang sein.
                </div>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#2c3e50' }}>
                  Neues Passwort bestätigen *
                </label>
                <input
                  type="password"
                  name="confirmPassword"
                  value={passwordForm.confirmPassword}
                  onChange={handlePasswordChange}
                  required
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    fontSize: '16px'
                  }}
                  placeholder="Passwort wiederholen"
                />
              </div>
            </div>

            <div style={{ 
              display: 'flex', 
              gap: '15px', 
              justifyContent: 'flex-end',
              marginTop: '30px',
              paddingTop: '20px',
              borderTop: '1px solid #f0f0f0'
            }}>
              <button
                type="submit"
                disabled={loading || !passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword}
                style={{
                  padding: '12px 24px',
                  backgroundColor: loading ? '#bdc3c7' : (!passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword ? '#95a5a6' : '#3498db'),
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: (loading || !passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword) ? 'not-allowed' : 'pointer',
                  fontWeight: 'bold'
                }}
              >
                {loading ? '⏳ Wird geändert...' : 'Passwort ändern'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Availability Tab */}
      {activeTab === 'availability' && (
        <div style={{
          backgroundColor: 'white',
          padding: '30px',
          borderRadius: '8px',
          border: '1px solid #e0e0e0',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
        }}>
          <h2 style={{ marginTop: 0, color: '#2c3e50' }}>Meine Verfügbarkeit</h2>
          
          <div style={{
            padding: '30px',
            textAlign: 'center',
            backgroundColor: '#f8f9fa',
            borderRadius: '8px',
            border: '2px dashed #dee2e6'
          }}>
            <div style={{ fontSize: '48px', marginBottom: '20px' }}>📅</div>
            <h3 style={{ color: '#2c3e50' }}>Verfügbarkeit verwalten</h3>
            <p style={{ color: '#6c757d', marginBottom: '25px' }}>
              Hier können Sie Ihre persönliche Verfügbarkeit für Schichtpläne festlegen.
              Legen Sie für jeden Tag und jede Schicht fest, ob Sie bevorzugt, möglicherweise 
              oder nicht verfügbar sind.
            </p>
            
            <button
              onClick={() => setShowAvailabilityManager(true)}
              style={{
                padding: '12px 24px',
                backgroundColor: '#3498db',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: 'bold',
                fontSize: '16px'
              }}
            >
              Verfügbarkeit bearbeiten
            </button>

            <div style={{ 
              marginTop: '20px', 
              padding: '15px',
              backgroundColor: '#e8f4fd',
              border: '1px solid #b6d7e8',
              borderRadius: '6px',
              fontSize: '14px',
              color: '#2c3e50',
              textAlign: 'left'
            }}>
              <strong>💡 Informationen:</strong>
              <ul style={{ margin: '8px 0 0 20px', padding: 0 }}>
                <li><strong>Bevorzugt:</strong> Sie möchten diese Schicht arbeiten</li>
                <li><strong>Möglich:</strong> Sie können diese Schicht arbeiten</li>
                <li><strong>Nicht möglich:</strong> Sie können diese Schicht nicht arbeiten</li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Settings;