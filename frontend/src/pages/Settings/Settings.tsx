// frontend/src/pages/Settings/Settings.tsx - UPDATED WITH VALIDATION STRATEGY
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { employeeService } from '../../services/employeeService';
import { useNotification } from '../../contexts/NotificationContext';
import { useBackendValidation } from '../../hooks/useBackendValidation';
import AvailabilityManager from '../Employees/components/AvailabilityManager';
import { Employee } from '../../models/Employee';
import { styles } from './type/SettingsType';
import {
  identityProviderService,
  IdentityProvider,
  IdentityProviderRequest,
  TestConnectionResult
} from '../../services/identityProviderService';

const Settings: React.FC = () => {
  const { user: currentUser, updateUser, hasRole } = useAuth();
  const isAdmin = hasRole(['admin', 'maintenance']);
  const { showNotification } = useNotification();
  const { executeWithValidation, clearErrors, isSubmitting } = useBackendValidation();

  const [activeTab, setActiveTab] = useState<'profile' | 'password' | 'availability' | 'security'>('profile');
  const [showAvailabilityManager, setShowAvailabilityManager] = useState(false);

  // Security tab state (Identity Providers)
  const [identityProviders, setIdentityProviders] = useState<IdentityProvider[]>([]);
  const [loadingProviders, setLoadingProviders] = useState(false);
  const [showIdpModal, setShowIdpModal] = useState(false);
  const [editingIdp, setEditingIdp] = useState<IdentityProvider | null>(null);
  const [testResult, setTestResult] = useState<TestConnectionResult | null>(null);
  const [testingConnection, setTestingConnection] = useState(false);
  const [idpForm, setIdpForm] = useState<IdentityProviderRequest>({
    name: '',
    issuer: '',
    clientId: '',
    clientSecret: '',
    scope: ['openid', 'profile', 'email'],
    pkce: true,
    enabled: true,
    defaultRole: 'user',
    claimMapping: {
      id: 'sub',
      email: 'email',
      firstName: 'given_name',
      lastName: 'family_name',
    },
  });

  // Profile form state
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

  // Password visibility states
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Refs for timeout management
  const currentPasswordTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const newPasswordTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const confirmPasswordTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (currentUser) {
      setProfileForm({
        firstname: currentUser.firstname || '',
        lastname: currentUser.lastname || ''
      });
    }
  }, [currentUser]);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      [currentPasswordTimeoutRef, newPasswordTimeoutRef, confirmPasswordTimeoutRef].forEach(ref => {
        if (ref.current) {
          clearTimeout(ref.current);
        }
      });
    };
  }, []);

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

  // Password visibility handlers
  const handleCurrentPasswordMouseDown = () => {
    currentPasswordTimeoutRef.current = setTimeout(() => {
      setShowCurrentPassword(true);
    }, 300);
  };

  const handleCurrentPasswordMouseUp = () => {
    if (currentPasswordTimeoutRef.current) {
      clearTimeout(currentPasswordTimeoutRef.current);
      currentPasswordTimeoutRef.current = null;
    }
    setShowCurrentPassword(false);
  };

  const handleNewPasswordMouseDown = () => {
    newPasswordTimeoutRef.current = setTimeout(() => {
      setShowNewPassword(true);
    }, 300);
  };

  const handleNewPasswordMouseUp = () => {
    if (newPasswordTimeoutRef.current) {
      clearTimeout(newPasswordTimeoutRef.current);
      newPasswordTimeoutRef.current = null;
    }
    setShowNewPassword(false);
  };

  const handleConfirmPasswordMouseDown = () => {
    confirmPasswordTimeoutRef.current = setTimeout(() => {
      setShowConfirmPassword(true);
    }, 300);
  };

  const handleConfirmPasswordMouseUp = () => {
    if (confirmPasswordTimeoutRef.current) {
      clearTimeout(confirmPasswordTimeoutRef.current);
      confirmPasswordTimeoutRef.current = null;
    }
    setShowConfirmPassword(false);
  };

  // Touch event handlers
  const handleTouchStart = (setter: () => void) => (e: React.TouchEvent) => {
    e.preventDefault();
    setter();
  };

  const handleTouchEnd = (cleanup: () => void) => (e: React.TouchEvent) => {
    e.preventDefault();
    cleanup();
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
  };

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;

    // BASIC FRONTEND VALIDATION: Only check required fields
    if (!profileForm.firstname.trim()) {
      showNotification({
        type: 'error',
        title: 'Fehler',
        message: 'Vorname ist erforderlich'
      });
      return;
    }

    if (!profileForm.lastname.trim()) {
      showNotification({
        type: 'error',
        title: 'Fehler',
        message: 'Nachname ist erforderlich'
      });
      return;
    }

    try {
      // Use executeWithValidation to handle backend validation
      await executeWithValidation(async () => {
        const updatedEmployee = await employeeService.updateEmployee(currentUser.id, {
          firstname: profileForm.firstname.trim(),
          lastname: profileForm.lastname.trim()
        });

        // Update the auth context with new user data
        updateUser(updatedEmployee);

        showNotification({
          type: 'success',
          title: 'Erfolg',
          message: 'Profil erfolgreich aktualisiert'
        });
      });
    } catch (error) {
      // Backend validation errors are already handled by executeWithValidation
      // We only need to handle unexpected errors here
      console.error('Unexpected error:', error);
    }
  };

  const handlePasswordUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;

    // BASIC FRONTEND VALIDATION: Only check minimum requirements
    if (!passwordForm.currentPassword) {
      showNotification({
        type: 'error',
        title: 'Fehler',
        message: 'Aktuelles Passwort ist erforderlich'
      });
      return;
    }

    if (!passwordForm.newPassword) {
      showNotification({
        type: 'error',
        title: 'Fehler',
        message: 'Neues Passwort ist erforderlich'
      });
      return;
    }

    if (passwordForm.newPassword.length < 8) {
      showNotification({
        type: 'error',
        title: 'Fehler',
        message: 'Das neue Passwort muss mindestens 8 Zeichen lang sein'
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
      // Use executeWithValidation to handle backend validation
      await executeWithValidation(async () => {
        await employeeService.changePassword(currentUser.id, {
          currentPassword: passwordForm.currentPassword,
          newPassword: passwordForm.newPassword,
          confirmPassword: passwordForm.confirmPassword
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
      });
    } catch (error) {
      // Backend validation errors are already handled by executeWithValidation
      console.error('Unexpected error:', error);
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

  // Load identity providers when security tab is accessed
  const loadIdentityProviders = useCallback(async () => {
    if (!isAdmin) return;
    setLoadingProviders(true);
    try {
      const providers = await identityProviderService.getAll();
      setIdentityProviders(providers);
    } catch (error) {
      console.error('Failed to load identity providers:', error);
      showNotification({
        type: 'error',
        title: 'Fehler',
        message: 'Identity Provider konnten nicht geladen werden'
      });
    } finally {
      setLoadingProviders(false);
    }
  }, [isAdmin, showNotification]);

  // Reset IDP form
  const resetIdpForm = () => {
    setIdpForm({
      name: '',
      issuer: '',
      clientId: '',
      clientSecret: '',
      scope: ['openid', 'profile', 'email'],
      pkce: true,
      enabled: true,
      defaultRole: 'user',
      claimMapping: {
        id: 'sub',
        email: 'email',
        firstName: 'given_name',
        lastName: 'family_name',
      },
    });
    setEditingIdp(null);
    setTestResult(null);
  };

  // Open modal to add new IDP
  const handleAddIdp = () => {
    resetIdpForm();
    setShowIdpModal(true);
  };

  // Open modal to edit existing IDP
  const handleEditIdp = async (idp: IdentityProvider) => {
    try {
      const fullIdp = await identityProviderService.getById(idp.id);
      setEditingIdp(fullIdp);
      setIdpForm({
        name: fullIdp.name,
        issuer: fullIdp.issuer,
        authorizationURL: fullIdp.authorizationURL,
        tokenURL: fullIdp.tokenURL,
        userInfoURL: fullIdp.userInfoURL,
        clientId: fullIdp.clientId,
        clientSecret: fullIdp.clientSecret || '',
        scope: fullIdp.scope,
        pkce: fullIdp.pkce,
        enabled: fullIdp.enabled,
        defaultRole: fullIdp.defaultRole,
        allowedDomains: fullIdp.allowedDomains,
        claimMapping: fullIdp.claimMapping,
      });
      setShowIdpModal(true);
    } catch (error) {
      showNotification({
        type: 'error',
        title: 'Fehler',
        message: 'Identity Provider konnte nicht geladen werden'
      });
    }
  };

  // Save IDP (create or update)
  const handleSaveIdp = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!idpForm.name || !idpForm.issuer || !idpForm.clientId || !idpForm.clientSecret) {
      showNotification({
        type: 'error',
        title: 'Fehler',
        message: 'Bitte füllen Sie alle Pflichtfelder aus'
      });
      return;
    }

    try {
      if (editingIdp) {
        await identityProviderService.update(editingIdp.id, idpForm);
        showNotification({
          type: 'success',
          title: 'Erfolg',
          message: 'Identity Provider wurde aktualisiert'
        });
      } else {
        await identityProviderService.create(idpForm);
        showNotification({
          type: 'success',
          title: 'Erfolg',
          message: 'Identity Provider wurde erstellt'
        });
      }
      setShowIdpModal(false);
      resetIdpForm();
      loadIdentityProviders();
    } catch (error) {
      showNotification({
        type: 'error',
        title: 'Fehler',
        message: editingIdp ? 'Aktualisierung fehlgeschlagen' : 'Erstellung fehlgeschlagen'
      });
    }
  };

  // Delete IDP
  const handleDeleteIdp = async (idp: IdentityProvider) => {
    if (!confirm(`Möchten Sie den Identity Provider "${idp.name}" wirklich löschen?`)) {
      return;
    }

    try {
      await identityProviderService.delete(idp.id);
      showNotification({
        type: 'success',
        title: 'Erfolg',
        message: 'Identity Provider wurde gelöscht'
      });
      loadIdentityProviders();
    } catch (error: any) {
      showNotification({
        type: 'error',
        title: 'Fehler',
        message: error.message || 'Löschen fehlgeschlagen'
      });
    }
  };

  // Toggle IDP enabled/disabled
  const handleToggleIdp = async (idp: IdentityProvider) => {
    try {
      await identityProviderService.toggle(idp.id, !idp.enabled);
      showNotification({
        type: 'success',
        title: 'Erfolg',
        message: `Identity Provider wurde ${!idp.enabled ? 'aktiviert' : 'deaktiviert'}`
      });
      loadIdentityProviders();
    } catch (error) {
      showNotification({
        type: 'error',
        title: 'Fehler',
        message: 'Status konnte nicht geändert werden'
      });
    }
  };

  // Test connection
  const handleTestConnection = async () => {
    if (!editingIdp) return;

    setTestingConnection(true);
    setTestResult(null);

    try {
      const result = await identityProviderService.testConnection(editingIdp.id);
      setTestResult(result);
    } catch (error) {
      setTestResult({
        success: false,
        message: 'Verbindungstest fehlgeschlagen'
      });
    } finally {
      setTestingConnection(false);
    }
  };

  // Handle IDP form changes
  const handleIdpFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;

    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setIdpForm(prev => ({ ...prev, [name]: checked }));
    } else if (name === 'scope') {
      setIdpForm(prev => ({ ...prev, scope: value.split(',').map(s => s.trim()) }));
    } else if (name.startsWith('claimMapping.')) {
      const key = name.replace('claimMapping.', '');
      setIdpForm(prev => ({
        ...prev,
        claimMapping: { ...prev.claimMapping, [key]: value }
      }));
    } else if (name === 'allowedDomains') {
      setIdpForm(prev => ({
        ...prev,
        allowedDomains: value ? value.split(',').map(s => s.trim()) : undefined
      }));
    } else {
      setIdpForm(prev => ({ ...prev, [name]: value }));
    }
  };

  // Clear validation errors when switching tabs
  const handleTabChange = (tab: 'profile' | 'password' | 'availability' | 'security') => {
    clearErrors();
    setActiveTab(tab);

    // Load providers when switching to security tab
    if (tab === 'security' && isAdmin) {
      loadIdentityProviders();
    }
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
            onClick={() => handleTabChange('profile')}
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
            onClick={() => handleTabChange('password')}
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
            onClick={() => handleTabChange('availability')}
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

          {/* Security Tab - Only visible for admins */}
          {isAdmin && (
            <button
              onClick={() => handleTabChange('security')}
              style={{
                ...styles.tab,
                ...(activeTab === 'security' ? styles.tabActive : {})
              }}
              onMouseEnter={(e) => {
                if (activeTab !== 'security') {
                  e.currentTarget.style.background = styles.tabHover.background;
                  e.currentTarget.style.color = styles.tabHover.color;
                  e.currentTarget.style.transform = styles.tabHover.transform;
                }
              }}
              onMouseLeave={(e) => {
                if (activeTab !== 'security') {
                  e.currentTarget.style.background = styles.tab.background;
                  e.currentTarget.style.color = styles.tab.color;
                  e.currentTarget.style.transform = 'none';
                }
              }}
            >
              <span style={{ fontSize: '1.2rem', width: '24px' }}>🔐</span>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                <span style={{ fontSize: '0.95rem', fontWeight: 500 }}>Sicherheit</span>
                <span style={{ fontSize: '0.8rem', opacity: 0.7, marginTop: '2px' }}>SSO / OpenID Connect</span>
              </div>
            </button>
          )}
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
                        Vorname {isAdmin && '*'}
                      </label>
                      <input
                        type="text"
                        name="firstname"
                        value={profileForm.firstname}
                        onChange={handleProfileChange}
                        required={isAdmin}
                        disabled={!isAdmin}
                        style={isAdmin ? styles.fieldInput : styles.fieldInputDisabled}
                        placeholder="Ihr Vorname"
                        onFocus={(e) => {
                          if (isAdmin) {
                            e.target.style.borderColor = '#1a1325';
                            e.target.style.boxShadow = '0 0 0 3px rgba(26, 19, 37, 0.1)';
                          }
                        }}
                        onBlur={(e) => {
                          if (isAdmin) {
                            e.target.style.borderColor = '#e8e8e8';
                            e.target.style.boxShadow = 'none';
                          }
                        }}
                      />
                    </div>
                    <div style={styles.field}>
                      <label style={styles.fieldLabel}>
                        Nachname {isAdmin && '*'}
                      </label>
                      <input
                        type="text"
                        name="lastname"
                        value={profileForm.lastname}
                        onChange={handleProfileChange}
                        required={isAdmin}
                        disabled={!isAdmin}
                        style={isAdmin ? styles.fieldInput : styles.fieldInputDisabled}
                        placeholder="Ihr Nachname"
                        onFocus={(e) => {
                          if (isAdmin) {
                            e.target.style.borderColor = '#1a1325';
                            e.target.style.boxShadow = '0 0 0 3px rgba(26, 19, 37, 0.1)';
                          }
                        }}
                        onBlur={(e) => {
                          if (isAdmin) {
                            e.target.style.borderColor = '#e8e8e8';
                            e.target.style.boxShadow = 'none';
                          }
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>
              {isAdmin && (
                <div style={styles.actions}>
                  <button
                    type="submit"
                    disabled={isSubmitting || !profileForm.firstname.trim() || !profileForm.lastname.trim()}
                    style={{
                      ...styles.button,
                      ...styles.buttonPrimary,
                      ...((isSubmitting || !profileForm.firstname.trim() || !profileForm.lastname.trim()) ? styles.buttonDisabled : {})
                    }}
                    onMouseEnter={(e) => {
                      if (!isSubmitting && profileForm.firstname.trim() && profileForm.lastname.trim()) {
                        e.currentTarget.style.background = styles.buttonPrimaryHover.background;
                        e.currentTarget.style.transform = styles.buttonPrimaryHover.transform;
                        e.currentTarget.style.boxShadow = styles.buttonPrimaryHover.boxShadow;
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isSubmitting && profileForm.firstname.trim() && profileForm.lastname.trim()) {
                        e.currentTarget.style.background = styles.buttonPrimary.background;
                        e.currentTarget.style.transform = 'none';
                        e.currentTarget.style.boxShadow = styles.buttonPrimary.boxShadow;
                      }
                    }}
                  >
                    {isSubmitting ? '⏳ Wird gespeichert...' : 'Profil aktualisieren'}
                  </button>
                </div>
              )}
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
                {/* Current Password Field */}
                <div style={styles.field}>
                  <label style={styles.fieldLabel}>
                    Aktuelles Passwort *
                  </label>
                  <div style={styles.fieldInputContainer}>
                    <input
                      type={showCurrentPassword ? 'text' : 'password'}
                      name="currentPassword"
                      value={passwordForm.currentPassword}
                      onChange={handlePasswordChange}
                      required
                      style={styles.fieldInputWithIcon}
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
                    <button
                      type="button"
                      onMouseDown={handleCurrentPasswordMouseDown}
                      onMouseUp={handleCurrentPasswordMouseUp}
                      onMouseLeave={handleCurrentPasswordMouseUp}
                      onTouchStart={handleTouchStart(handleCurrentPasswordMouseDown)}
                      onTouchEnd={handleTouchEnd(handleCurrentPasswordMouseUp)}
                      onTouchCancel={handleTouchEnd(handleCurrentPasswordMouseUp)}
                      onContextMenu={handleContextMenu}
                      style={{
                        ...styles.passwordToggleButton,
                        backgroundColor: showCurrentPassword ? 'rgba(26, 19, 37, 0.1)' : 'transparent'
                      }}
                      title="Gedrückt halten zum Anzeigen des Passworts"
                    >
                      {showCurrentPassword ? '👁' : '👁'}
                    </button>
                  </div>
                </div>

                {/* New Password Field */}
                <div style={styles.field}>
                  <label style={styles.fieldLabel}>
                    Neues Passwort *
                  </label>
                  <div style={styles.fieldInputContainer}>
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      name="newPassword"
                      value={passwordForm.newPassword}
                      onChange={handlePasswordChange}
                      required
                      minLength={8}
                      style={styles.fieldInputWithIcon}
                      placeholder="Mindestens 8 Zeichen"
                      onFocus={(e) => {
                        e.target.style.borderColor = '#1a1325';
                        e.target.style.boxShadow = '0 0 0 3px rgba(26, 19, 37, 0.1)';
                      }}
                      onBlur={(e) => {
                        e.target.style.borderColor = '#e8e8e8';
                        e.target.style.boxShadow = 'none';
                      }}
                    />
                    <button
                      type="button"
                      onMouseDown={handleNewPasswordMouseDown}
                      onMouseUp={handleNewPasswordMouseUp}
                      onMouseLeave={handleNewPasswordMouseUp}
                      onTouchStart={handleTouchStart(handleNewPasswordMouseDown)}
                      onTouchEnd={handleTouchEnd(handleNewPasswordMouseUp)}
                      onTouchCancel={handleTouchEnd(handleNewPasswordMouseUp)}
                      onContextMenu={handleContextMenu}
                      style={{
                        ...styles.passwordToggleButton,
                        backgroundColor: showNewPassword ? 'rgba(26, 19, 37, 0.1)' : 'transparent'
                      }}
                      title="Gedrückt halten zum Anzeigen des Passworts"
                    >
                      {showNewPassword ? '👁' : '👁'}
                    </button>
                  </div>
                  <div style={styles.fieldHint}>
                    Das Passwort muss mindestens 8 Zeichen lang sein.
                  </div>
                </div>

                {/* Confirm Password Field */}
                <div style={styles.field}>
                  <label style={styles.fieldLabel}>
                    Neues Passwort bestätigen *
                  </label>
                  <div style={styles.fieldInputContainer}>
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      name="confirmPassword"
                      value={passwordForm.confirmPassword}
                      onChange={handlePasswordChange}
                      required
                      style={styles.fieldInputWithIcon}
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
                    <button
                      type="button"
                      onMouseDown={handleConfirmPasswordMouseDown}
                      onMouseUp={handleConfirmPasswordMouseUp}
                      onMouseLeave={handleConfirmPasswordMouseUp}
                      onTouchStart={handleTouchStart(handleConfirmPasswordMouseDown)}
                      onTouchEnd={handleTouchEnd(handleConfirmPasswordMouseUp)}
                      onTouchCancel={handleTouchEnd(handleConfirmPasswordMouseUp)}
                      onContextMenu={handleContextMenu}
                      style={{
                        ...styles.passwordToggleButton,
                        backgroundColor: showConfirmPassword ? 'rgba(26, 19, 37, 0.1)' : 'transparent'
                      }}
                      title="Gedrückt halten zum Anzeigen des Passworts"
                    >
                      {showConfirmPassword ? '👁' : '👁'}
                    </button>
                  </div>
                </div>
              </div>

              <div style={styles.actions}>
                <button
                  type="submit"
                  disabled={isSubmitting || !passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword}
                  style={{
                    ...styles.button,
                    ...styles.buttonPrimary,
                    ...((isSubmitting || !passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword) ? styles.buttonDisabled : {})
                  }}
                  onMouseEnter={(e) => {
                    if (!isSubmitting && passwordForm.currentPassword && passwordForm.newPassword && passwordForm.confirmPassword) {
                      e.currentTarget.style.background = styles.buttonPrimaryHover.background;
                      e.currentTarget.style.transform = styles.buttonPrimaryHover.transform;
                      e.currentTarget.style.boxShadow = styles.buttonPrimaryHover.boxShadow;
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isSubmitting && passwordForm.currentPassword && passwordForm.newPassword && passwordForm.confirmPassword) {
                      e.currentTarget.style.background = styles.buttonPrimary.background;
                      e.currentTarget.style.transform = 'none';
                      e.currentTarget.style.boxShadow = styles.buttonPrimary.boxShadow;
                    }
                  }}
                >
                  {isSubmitting ? '⏳ Wird geändert...' : 'Passwort ändern'}
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

        {/* Security Tab */}
        {activeTab === 'security' && isAdmin && (
          <>
            <div style={styles.section}>
              <h2 style={styles.sectionTitle}>Identity Provider</h2>
              <p style={styles.sectionDescription}>
                Konfigurieren Sie externe Authentifizierungsanbieter (OpenID Connect / SSO)
              </p>
            </div>

            <div style={styles.headerActions}>
              <div style={{ color: '#666', fontSize: '0.9rem' }}>
                {identityProviders.length} Provider konfiguriert
              </div>
              <button
                onClick={handleAddIdp}
                style={{
                  ...styles.button,
                  ...styles.buttonPrimary,
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
                + Neuer Provider
              </button>
            </div>

            {loadingProviders ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: '#666' }}>
                Lade Identity Provider...
              </div>
            ) : identityProviders.length === 0 ? (
              <div style={styles.emptyState}>
                <div style={styles.emptyStateIcon}>🔐</div>
                <p style={styles.emptyStateText}>
                  Noch keine Identity Provider konfiguriert.<br />
                  Fügen Sie einen Provider hinzu, um Single Sign-On zu aktivieren.
                </p>
                <button
                  onClick={handleAddIdp}
                  style={{
                    ...styles.button,
                    ...styles.buttonPrimary,
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
                  Ersten Provider hinzufügen
                </button>
              </div>
            ) : (
              <div style={styles.providerList}>
                {identityProviders.map((idp) => (
                  <div
                    key={idp.id}
                    style={styles.providerCard}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.boxShadow = styles.providerCardHover.boxShadow;
                      e.currentTarget.style.borderColor = styles.providerCardHover.borderColor;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.boxShadow = 'none';
                      e.currentTarget.style.borderColor = 'rgba(26, 19, 37, 0.1)';
                    }}
                  >
                    <div style={styles.providerInfo}>
                      <div style={styles.providerIcon}>
                        {idp.type === 'oidc' ? '🔑' : '🛡️'}
                      </div>
                      <div style={styles.providerDetails}>
                        <h4 style={styles.providerName}>{idp.name}</h4>
                        <p style={styles.providerIssuer}>{idp.issuer}</p>
                      </div>
                      <div style={{
                        ...styles.providerStatus,
                        ...(idp.enabled ? styles.providerStatusEnabled : styles.providerStatusDisabled)
                      }}>
                        <span style={{ fontSize: '0.7rem' }}>{idp.enabled ? '●' : '○'}</span>
                        {idp.enabled ? 'Aktiv' : 'Inaktiv'}
                      </div>
                    </div>
                    <div style={styles.providerActions}>
                      <button
                        onClick={() => handleToggleIdp(idp)}
                        style={styles.iconButton}
                        title={idp.enabled ? 'Deaktivieren' : 'Aktivieren'}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = styles.iconButtonHover.background;
                          e.currentTarget.style.borderColor = styles.iconButtonHover.borderColor;
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'transparent';
                          e.currentTarget.style.borderColor = 'rgba(26, 19, 37, 0.1)';
                        }}
                      >
                        {idp.enabled ? '⏸️' : '▶️'}
                      </button>
                      <button
                        onClick={() => handleEditIdp(idp)}
                        style={styles.iconButton}
                        title="Bearbeiten"
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = styles.iconButtonHover.background;
                          e.currentTarget.style.borderColor = styles.iconButtonHover.borderColor;
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'transparent';
                          e.currentTarget.style.borderColor = 'rgba(26, 19, 37, 0.1)';
                        }}
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => handleDeleteIdp(idp)}
                        style={{ ...styles.iconButton, ...styles.iconButtonDanger }}
                        title="Löschen"
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = styles.iconButtonDangerHover.background;
                          e.currentTarget.style.borderColor = styles.iconButtonDangerHover.borderColor;
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'transparent';
                          e.currentTarget.style.borderColor = 'rgba(26, 19, 37, 0.1)';
                        }}
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Identity Provider Modal */}
            {showIdpModal && (
              <div style={styles.modal} onClick={() => { setShowIdpModal(false); resetIdpForm(); }}>
                <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
                  <div style={styles.modalHeader}>
                    <h3 style={styles.modalTitle}>
                      {editingIdp ? 'Identity Provider bearbeiten' : 'Neuer Identity Provider'}
                    </h3>
                    <button
                      style={styles.modalClose}
                      onClick={() => { setShowIdpModal(false); resetIdpForm(); }}
                    >
                      ×
                    </button>
                  </div>

                  <form onSubmit={handleSaveIdp}>
                    <div style={styles.modalBody}>
                      {/* Basic Information */}
                      <h4 style={styles.sectionSubtitle}>Grundeinstellungen</h4>
                      <div style={{ display: 'grid', gap: '1rem', marginBottom: '1rem' }}>
                        <div style={styles.field}>
                          <label style={styles.fieldLabel}>Name *</label>
                          <input
                            type="text"
                            name="name"
                            value={idpForm.name}
                            onChange={handleIdpFormChange}
                            placeholder="z.B. Azure AD, Authentik, Keycloak"
                            style={styles.fieldInput}
                            required
                          />
                        </div>

                        <div style={styles.field}>
                          <label style={styles.fieldLabel}>Issuer URL *</label>
                          <input
                            type="url"
                            name="issuer"
                            value={idpForm.issuer}
                            onChange={handleIdpFormChange}
                            placeholder="https://login.example.com/realms/myrealm"
                            style={styles.fieldInput}
                            required
                          />
                          <div style={styles.fieldHint}>
                            Die Basis-URL des Identity Providers (ohne /.well-known/openid-configuration)
                          </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                          <div style={styles.field}>
                            <label style={styles.fieldLabel}>Client ID *</label>
                            <input
                              type="text"
                              name="clientId"
                              value={idpForm.clientId}
                              onChange={handleIdpFormChange}
                              placeholder="client-id"
                              style={styles.fieldInput}
                              required
                            />
                          </div>
                          <div style={styles.field}>
                            <label style={styles.fieldLabel}>Client Secret *</label>
                            <input
                              type="password"
                              name="clientSecret"
                              value={idpForm.clientSecret}
                              onChange={handleIdpFormChange}
                              placeholder="••••••••"
                              style={styles.fieldInput}
                              required
                            />
                          </div>
                        </div>
                      </div>

                      <div style={styles.divider} />

                      {/* Advanced Settings */}
                      <h4 style={styles.sectionSubtitle}>Erweiterte Einstellungen</h4>
                      <div style={{ display: 'grid', gap: '1rem', marginBottom: '1rem' }}>
                        <div style={styles.field}>
                          <label style={styles.fieldLabel}>Scopes</label>
                          <input
                            type="text"
                            name="scope"
                            value={idpForm.scope?.join(', ') || ''}
                            onChange={handleIdpFormChange}
                            placeholder="openid, profile, email"
                            style={styles.fieldInput}
                          />
                          <div style={styles.fieldHint}>
                            Komma-getrennte Liste der Scopes (Standard: openid, profile, email)
                          </div>
                        </div>

                        <div style={styles.field}>
                          <label style={styles.fieldLabel}>Erlaubte Domains</label>
                          <input
                            type="text"
                            name="allowedDomains"
                            value={idpForm.allowedDomains?.join(', ') || ''}
                            onChange={handleIdpFormChange}
                            placeholder="example.com, company.de"
                            style={styles.fieldInput}
                          />
                          <div style={styles.fieldHint}>
                            Komma-getrennte Liste der erlaubten E-Mail-Domains (leer = alle erlaubt)
                          </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                          <div style={styles.field}>
                            <label style={styles.fieldLabel}>Standard-Rolle</label>
                            <select
                              name="defaultRole"
                              value={idpForm.defaultRole || 'user'}
                              onChange={handleIdpFormChange}
                              style={styles.fieldSelect}
                            >
                              <option value="user">Benutzer</option>
                              <option value="admin">Administrator</option>
                              <option value="maintenance">Wartung</option>
                            </select>
                          </div>
                          <div style={styles.field}>
                            <label style={styles.fieldLabel}>&nbsp;</label>
                            <label style={styles.checkbox}>
                              <input
                                type="checkbox"
                                name="pkce"
                                checked={idpForm.pkce !== false}
                                onChange={handleIdpFormChange}
                                style={styles.checkboxInput}
                              />
                              <span style={styles.checkboxLabel}>PKCE aktivieren</span>
                            </label>
                          </div>
                        </div>

                        <label style={styles.checkbox}>
                          <input
                            type="checkbox"
                            name="enabled"
                            checked={idpForm.enabled !== false}
                            onChange={handleIdpFormChange}
                            style={styles.checkboxInput}
                          />
                          <span style={styles.checkboxLabel}>Provider aktivieren</span>
                        </label>
                      </div>

                      <div style={styles.divider} />

                      {/* Claim Mapping */}
                      <h4 style={styles.sectionSubtitle}>Claim Mapping</h4>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        <div style={styles.field}>
                          <label style={styles.fieldLabel}>ID Claim</label>
                          <input
                            type="text"
                            name="claimMapping.id"
                            value={idpForm.claimMapping?.id || 'sub'}
                            onChange={handleIdpFormChange}
                            placeholder="sub"
                            style={styles.fieldInput}
                          />
                        </div>
                        <div style={styles.field}>
                          <label style={styles.fieldLabel}>Email Claim</label>
                          <input
                            type="text"
                            name="claimMapping.email"
                            value={idpForm.claimMapping?.email || 'email'}
                            onChange={handleIdpFormChange}
                            placeholder="email"
                            style={styles.fieldInput}
                          />
                        </div>
                        <div style={styles.field}>
                          <label style={styles.fieldLabel}>Vorname Claim</label>
                          <input
                            type="text"
                            name="claimMapping.firstName"
                            value={idpForm.claimMapping?.firstName || 'given_name'}
                            onChange={handleIdpFormChange}
                            placeholder="given_name"
                            style={styles.fieldInput}
                          />
                        </div>
                        <div style={styles.field}>
                          <label style={styles.fieldLabel}>Nachname Claim</label>
                          <input
                            type="text"
                            name="claimMapping.lastName"
                            value={idpForm.claimMapping?.lastName || 'family_name'}
                            onChange={handleIdpFormChange}
                            placeholder="family_name"
                            style={styles.fieldInput}
                          />
                        </div>
                      </div>

                      {/* Test Connection (only for editing) */}
                      {editingIdp && (
                        <>
                          <div style={styles.divider} />
                          <h4 style={styles.sectionSubtitle}>Verbindungstest</h4>
                          <button
                            type="button"
                            onClick={handleTestConnection}
                            disabled={testingConnection}
                            style={{
                              ...styles.button,
                              ...styles.buttonSecondary,
                              ...(testingConnection ? styles.buttonDisabled : {})
                            }}
                          >
                            {testingConnection ? 'Teste Verbindung...' : 'Verbindung testen'}
                          </button>

                          {testResult && (
                            <div style={{
                              ...styles.testResult,
                              ...(testResult.success ? styles.testResultSuccess : styles.testResultError)
                            }}>
                              <strong>{testResult.success ? '✓ Erfolgreich' : '✗ Fehlgeschlagen'}</strong>
                              <p style={{ margin: '0.5rem 0 0 0' }}>{testResult.message}</p>
                              {testResult.endpoints && (
                                <div style={{ marginTop: '0.5rem', fontSize: '0.85rem' }}>
                                  <div>Authorization: {testResult.endpoints.authorization}</div>
                                  <div>Token: {testResult.endpoints.token}</div>
                                  <div>UserInfo: {testResult.endpoints.userinfo}</div>
                                </div>
                              )}
                            </div>
                          )}
                        </>
                      )}
                    </div>

                    <div style={styles.modalFooter}>
                      <button
                        type="button"
                        onClick={() => { setShowIdpModal(false); resetIdpForm(); }}
                        style={{
                          ...styles.button,
                          ...styles.buttonSecondary,
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = styles.buttonSecondaryHover.background;
                          e.currentTarget.style.borderColor = styles.buttonSecondaryHover.borderColor;
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'transparent';
                          e.currentTarget.style.borderColor = 'rgba(26, 19, 37, 0.2)';
                        }}
                      >
                        Abbrechen
                      </button>
                      <button
                        type="submit"
                        style={{
                          ...styles.button,
                          ...styles.buttonPrimary,
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
                        {editingIdp ? 'Speichern' : 'Erstellen'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default Settings;