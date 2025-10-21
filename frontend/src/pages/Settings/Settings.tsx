// frontend/src/pages/Settings/Settings.tsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { employeeService } from '../../services/employeeService';
import { useNotification } from '../../contexts/NotificationContext';
import AvailabilityManager from '../Employees/components/AvailabilityManager';
import { Employee } from '../../models/Employee';
import { styles } from './type/SettingsType';

const Settings: React.FC = () => {
  const { user: currentUser, updateUser } = useAuth();
  const { showNotification } = useNotification();
  const [activeTab, setActiveTab] = useState<'profile' | 'password' | 'availability'>('profile');
  const [loading, setLoading] = useState(false);
  const [showAvailabilityManager, setShowAvailabilityManager] = useState(false);
  
  // Profile form state - updated for firstname/lastname
  const [profileForm, setProfileForm] = useState({
    firstname: currentUser?.firstname || '',
    lastname: currentUser?.lastname || ''
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
        firstname: currentUser.firstname || '',
        lastname: currentUser.lastname || ''
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

    // Validation
    if (!profileForm.firstname.trim() || !profileForm.lastname.trim()) {
      showNotification({
        type: 'error',
        title: 'Fehler',
        message: 'Vorname und Nachname sind erforderlich'
      });
      return;
    }

    try {
      setLoading(true);
      await employeeService.updateEmployee(currentUser.id, {
        firstname: profileForm.firstname.trim(),
        lastname: profileForm.lastname.trim()
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
    return <div style={{ 
      textAlign: 'center', 
      padding: '3rem', 
      color: '#666', 
      fontSize: '1.1rem' 
    }}>Nicht eingeloggt</div>;
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

  // Get full name for display
  const getFullName = () => {
    return `${currentUser.firstname || ''} ${currentUser.lastname || ''}`.trim();
  };

  return (
    <div style={styles.container}>
      {/* Left Sidebar with Tabs */}
      <div style={styles.sidebar}>
        <div style={styles.header}>
          <h1 style={styles.title}>Einstellungen</h1>
          <div style={styles.subtitle}>Verwalten Sie Ihre Kontoeinstellungen und Präferenzen</div>
        </div>
        
        <div style={styles.tabs}>
          <button
            onClick={() => setActiveTab('profile')}
            style={{
              ...styles.tab,
              ...(activeTab === 'profile' ? styles.tabActive : {})
            }}
            onMouseEnter={(e) => {
              if (activeTab !== 'profile') {
                e.currentTarget.style.background = styles.tabHover.background;
                e.currentTarget.style.color = styles.tabHover.color;
                e.currentTarget.style.transform = styles.tabHover.transform;
              }
            }}
            onMouseLeave={(e) => {
              if (activeTab !== 'profile') {
                e.currentTarget.style.background = styles.tab.background;
                e.currentTarget.style.color = styles.tab.color;
                e.currentTarget.style.transform = 'none';
              }
            }}
          >
            <span style={{ color: '#cda8f0', fontSize: '24px' }}>{'\u{1F464}\u{FE0E}'}</span>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
              <span style={{ fontSize: '0.95rem', fontWeight: 500 }}>Profil</span>
              <span style={{ fontSize: '0.8rem', opacity: 0.7, marginTop: '2px' }}>Persönliche Informationen</span>
            </div>
          </button>
          
          <button
            onClick={() => setActiveTab('password')}
            style={{
              ...styles.tab,
              ...(activeTab === 'password' ? styles.tabActive : {})
            }}
            onMouseEnter={(e) => {
              if (activeTab !== 'password') {
                e.currentTarget.style.background = styles.tabHover.background;
                e.currentTarget.style.color = styles.tabHover.color;
                e.currentTarget.style.transform = styles.tabHover.transform;
              }
            }}
            onMouseLeave={(e) => {
              if (activeTab !== 'password') {
                e.currentTarget.style.background = styles.tab.background;
                e.currentTarget.style.color = styles.tab.color;
                e.currentTarget.style.transform = 'none';
              }
            }}
          >
            <span style={{ fontSize: '1.2rem', width: '24px' }}>🔒</span>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
              <span style={{ fontSize: '0.95rem', fontWeight: 500 }}>Passwort</span>
              <span style={{ fontSize: '0.8rem', opacity: 0.7, marginTop: '2px' }}>Sicherheitseinstellungen</span>
            </div>
          </button>
          
          <button
            onClick={() => setActiveTab('availability')}
            style={{
              ...styles.tab,
              ...(activeTab === 'availability' ? styles.tabActive : {})
            }}
            onMouseEnter={(e) => {
              if (activeTab !== 'availability') {
                e.currentTarget.style.background = styles.tabHover.background;
                e.currentTarget.style.color = styles.tabHover.color;
                e.currentTarget.style.transform = styles.tabHover.transform;
              }
            }}
            onMouseLeave={(e) => {
              if (activeTab !== 'availability') {
                e.currentTarget.style.background = styles.tab.background;
                e.currentTarget.style.color = styles.tab.color;
                e.currentTarget.style.transform = 'none';
              }
            }}
          >
            <span style={{ fontSize: '1.2rem', width: '24px' }}>📅</span>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
              <span style={{ fontSize: '0.95rem', fontWeight: 500 }}>Verfügbarkeit</span>
              <span style={{ fontSize: '0.8rem', opacity: 0.7, marginTop: '2px' }}>Schichtplanung</span>
            </div>
          </button>
        </div>
      </div>

      {/* Right Content Area */}
      <div style={styles.content}>
        {/* Profile Tab */}
        {activeTab === 'profile' && (
          <>
            <div style={styles.section}>
              <h2 style={styles.sectionTitle}>Profilinformationen</h2>
              <p style={styles.sectionDescription}>
                Verwalten Sie Ihre persönlichen Informationen und Kontaktdaten
              </p>
            </div>
            
            <form onSubmit={handleProfileUpdate} style={{ marginTop: '2rem' }}>
              <div style={styles.formGrid}>
                {/* Read-only information */}
                <div style={styles.infoCard}>
                  <h4 style={styles.infoCardTitle}>Systeminformationen</h4>
                  <div style={styles.infoGrid}>
                    <div style={styles.field}>
                      <label style={styles.fieldLabel}>
                        E-Mail
                      </label>
                      <input
                        type="email"
                        value={currentUser.email}
                        disabled
                        style={styles.fieldInputDisabled}
                      />
                      <div style={styles.fieldHint}>
                        E-Mail wird automatisch aus Vor- und Nachname generiert
                      </div>
                    </div>
                    <div style={styles.field}>
                      <label style={styles.fieldLabel}>
                        Rolle
                      </label>
                      <input
                        type="text"
                        value={currentUser.roles}
                        disabled
                        style={styles.fieldInputDisabled}
                      />
                    </div>
                    <div style={styles.field}>
                      <label style={styles.fieldLabel}>
                        Mitarbeiter Typ
                      </label>
                      <input
                        type="text"
                        value={currentUser.employeeType}
                        disabled
                        style={styles.fieldInputDisabled}
                      />
                    </div>
                    <div style={styles.field}>
                      <label style={styles.fieldLabel}>
                        Vertragstyp
                      </label>
                      <input
                        type="text"
                        value={currentUser.contractType}
                        disabled
                        style={styles.fieldInputDisabled}
                      />
                    </div>
                  </div>
                </div>
                <div style={styles.infoCard}>
                  <h4 style={styles.infoCardTitle}>Persönliche Informationen</h4>
                  {/* Editable name fields */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div style={styles.field}>
                      <label style={styles.fieldLabel}>
                        Vorname *
                      </label>
                      <input
                        type="text"
                        name="firstname"
                        value={profileForm.firstname}
                        onChange={handleProfileChange}
                        required
                        style={styles.fieldInput}
                        placeholder="Ihr Vorname"
                        onFocus={(e) => {
                          e.target.style.borderColor = '#1a1325';
                          e.target.style.boxShadow = '0 0 0 3px rgba(26, 19, 37, 0.1)';
                        }}
                        onBlur={(e) => {
                          e.target.style.borderColor = '#e8e8e8';
                          e.target.style.boxShadow = 'none';
                        }}
                      />
                    </div>
                    <div style={styles.field}>
                      <label style={styles.fieldLabel}>
                        Nachname *
                      </label>
                      <input
                        type="text"
                        name="lastname"
                        value={profileForm.lastname}
                        onChange={handleProfileChange}
                        required
                        style={styles.fieldInput}
                        placeholder="Ihr Nachname"
                        onFocus={(e) => {
                          e.target.style.borderColor = '#1a1325';
                          e.target.style.boxShadow = '0 0 0 3px rgba(26, 19, 37, 0.1)';
                        }}
                        onBlur={(e) => {
                          e.target.style.borderColor = '#e8e8e8';
                          e.target.style.boxShadow = 'none';
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div style={styles.actions}>
                <button
                  type="submit"
                  disabled={loading || !profileForm.firstname.trim() || !profileForm.lastname.trim()}
                  style={{
                    ...styles.button,
                    ...styles.buttonPrimary,
                    ...((loading || !profileForm.firstname.trim() || !profileForm.lastname.trim()) ? styles.buttonDisabled : {})
                  }}
                  onMouseEnter={(e) => {
                    if (!loading && profileForm.firstname.trim() && profileForm.lastname.trim()) {
                      e.currentTarget.style.background = styles.buttonPrimaryHover.background;
                      e.currentTarget.style.transform = styles.buttonPrimaryHover.transform;
                      e.currentTarget.style.boxShadow = styles.buttonPrimaryHover.boxShadow;
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!loading && profileForm.firstname.trim() && profileForm.lastname.trim()) {
                      e.currentTarget.style.background = styles.buttonPrimary.background;
                      e.currentTarget.style.transform = 'none';
                      e.currentTarget.style.boxShadow = styles.buttonPrimary.boxShadow;
                    }
                  }}
                >
                  {loading ? '⏳ Wird gespeichert...' : 'Profil aktualisieren'}
                </button>
              </div>
            </form>
          </>
        )}

        {/* Password Tab */}
        {activeTab === 'password' && (
          <>
            <div style={styles.section}>
              <h2 style={styles.sectionTitle}>Passwort ändern</h2>
              <p style={styles.sectionDescription}>
                Aktualisieren Sie Ihr Passwort für erhöhte Sicherheit
              </p>
            </div>
            
            <form onSubmit={handlePasswordUpdate} style={{ marginTop: '2rem' }}>
              <div style={styles.formGridCompact}>
                <div style={styles.field}>
                  <label style={styles.fieldLabel}>
                    Aktuelles Passwort *
                  </label>
                  <input
                    type="password"
                    name="currentPassword"
                    value={passwordForm.currentPassword}
                    onChange={handlePasswordChange}
                    required
                    style={styles.fieldInput}
                    placeholder="Aktuelles Passwort"
                    onFocus={(e) => {
                      e.target.style.borderColor = '#1a1325';
                      e.target.style.boxShadow = '0 0 0 3px rgba(26, 19, 37, 0.1)';
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = '#e8e8e8';
                      e.target.style.boxShadow = 'none';
                    }}
                  />
                </div>

                <div style={styles.field}>
                  <label style={styles.fieldLabel}>
                    Neues Passwort *
                  </label>
                  <input
                    type="password"
                    name="newPassword"
                    value={passwordForm.newPassword}
                    onChange={handlePasswordChange}
                    required
                    minLength={6}
                    style={styles.fieldInput}
                    placeholder="Mindestens 6 Zeichen"
                    onFocus={(e) => {
                      e.target.style.borderColor = '#1a1325';
                      e.target.style.boxShadow = '0 0 0 3px rgba(26, 19, 37, 0.1)';
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = '#e8e8e8';
                      e.target.style.boxShadow = 'none';
                    }}
                  />
                  <div style={styles.fieldHint}>
                    Das Passwort muss mindestens 6 Zeichen lang sein.
                  </div>
                </div>

                <div style={styles.field}>
                  <label style={styles.fieldLabel}>
                    Neues Passwort bestätigen *
                  </label>
                  <input
                    type="password"
                    name="confirmPassword"
                    value={passwordForm.confirmPassword}
                    onChange={handlePasswordChange}
                    required
                    style={styles.fieldInput}
                    placeholder="Passwort wiederholen"
                    onFocus={(e) => {
                      e.target.style.borderColor = '#1a1325';
                      e.target.style.boxShadow = '0 0 0 3px rgba(26, 19, 37, 0.1)';
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = '#e8e8e8';
                      e.target.style.boxShadow = 'none';
                    }}
                  />
                </div>
              </div>

              <div style={styles.actions}>
                <button
                  type="submit"
                  disabled={loading || !passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword}
                  style={{
                    ...styles.button,
                    ...styles.buttonPrimary,
                    ...((loading || !passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword) ? styles.buttonDisabled : {})
                  }}
                  onMouseEnter={(e) => {
                    if (!loading && passwordForm.currentPassword && passwordForm.newPassword && passwordForm.confirmPassword) {
                      e.currentTarget.style.background = styles.buttonPrimaryHover.background;
                      e.currentTarget.style.transform = styles.buttonPrimaryHover.transform;
                      e.currentTarget.style.boxShadow = styles.buttonPrimaryHover.boxShadow;
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!loading && passwordForm.currentPassword && passwordForm.newPassword && passwordForm.confirmPassword) {
                      e.currentTarget.style.background = styles.buttonPrimary.background;
                      e.currentTarget.style.transform = 'none';
                      e.currentTarget.style.boxShadow = styles.buttonPrimary.boxShadow;
                    }
                  }}
                >
                  {loading ? '⏳ Wird geändert...' : 'Passwort ändern'}
                </button>
              </div>
            </form>
          </>
        )}

        {/* Availability Tab */}
        {activeTab === 'availability' && (
          <>
            <div style={styles.section}>
              <h2 style={styles.sectionTitle}>Meine Verfügbarkeit</h2>
              <p style={styles.sectionDescription}>
                Legen Sie Ihre persönliche Verfügbarkeit für Schichtpläne fest
              </p>
            </div>
            
            <div style={styles.availabilityCard}>
              <div style={styles.availabilityIcon}>📅</div>
              <h3 style={styles.availabilityTitle}>Verfügbarkeit verwalten</h3>
              <p style={styles.availabilityDescription}>
                Hier können Sie Ihre persönliche Verfügbarkeit für Schichtpläne festlegen.
                Legen Sie für jeden Tag und jede Schicht fest, ob Sie bevorzugt, möglicherweise 
                oder nicht verfügbar sind.
              </p>
              
              <button
                onClick={() => setShowAvailabilityManager(true)}
                style={{
                  ...styles.button,
                  ...styles.buttonPrimary,
                  marginBottom: '2rem'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = styles.buttonPrimaryHover.background;
                  e.currentTarget.style.transform = styles.buttonPrimaryHover.transform;
                  e.currentTarget.style.boxShadow = styles.buttonPrimaryHover.boxShadow;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = styles.buttonPrimary.background;
                  e.currentTarget.style.transform = 'none';
                  e.currentTarget.style.boxShadow = styles.buttonPrimary.boxShadow;
                }}
              >
                Verfügbarkeit bearbeiten
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default Settings;