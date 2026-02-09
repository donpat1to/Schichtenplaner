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
  TestConnectionResult,
  WhitelistEntry,
  CreateWhitelistEntryRequest
} from '../../services/identityProviderService';
import { APP_URL } from '../../config/runtime';

// Convert name to URL-friendly slug
const slugify = (text: string): string => {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
    .replace(/[äÄ]/g, 'ae')
    .replace(/[öÖ]/g, 'oe')
    .replace(/[üÜ]/g, 'ue')
    .replace(/[ß]/g, 'ss')
    .replace(/[^a-z0-9-]/g, '-') // Replace non-alphanumeric with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single
    .replace(/^-|-$/g, ''); // Remove leading/trailing hyphens
};

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
  const [slugTouched, setSlugTouched] = useState(false); // Track if user manually edited slug
  const [idpForm, setIdpForm] = useState<IdentityProviderRequest>({
    slug: '',
    name: '',
    type: 'oidc',
    issuer: '',
    authorizationURL: '',
    tokenURL: '',
    userInfoURL: '',
    clientId: '',
    clientSecret: '',
    scope: ['openid', 'profile', 'email'],
    pkce: true,
    enabled: true,
    defaultRole: 'user',
    registrationMode: 'whitelist',
    claimMapping: {
      id: 'sub',
      email: 'email',
      username: '',
      firstName: 'given_name',
      lastName: 'family_name',
    },
  });

  // Whitelist management state
  const [whitelistEntries, setWhitelistEntries] = useState<WhitelistEntry[]>([]);
  const [loadingWhitelist, setLoadingWhitelist] = useState(false);
  const [whitelistForm, setWhitelistForm] = useState<CreateWhitelistEntryRequest>({
    identifierType: 'username',
    identifierValue: '',
    defaultRole: 'user',
    notes: '',
  });

  // Profile form state
  const [profileForm, setProfileForm] = useState({
    username: currentUser?.username || '',
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

  // Client Secret visibility states
  const [showClientSecret, setShowClientSecret] = useState(false);

  // Refs for timeout management
  const currentPasswordTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const newPasswordTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const confirmPasswordTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const clientSecretTimeoutRef = useRef<NodeJS.Timeout | null>(null);


  useEffect(() => {
    if (currentUser) {
      setProfileForm({
        username: currentUser.username || '',
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

  useEffect(() => {
    return () => {
      [currentPasswordTimeoutRef, newPasswordTimeoutRef, confirmPasswordTimeoutRef, clientSecretTimeoutRef].forEach(ref => {
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

  // Client Secret Visible handling
  const handleClientSecretMouseDown = () => {
    clientSecretTimeoutRef.current = setTimeout(() => {
      setShowClientSecret(true);
    }, 300);
  };

  const handleClientSecretMouseUp = () => {
    if (clientSecretTimeoutRef.current) {
      clearTimeout(clientSecretTimeoutRef.current);
      clientSecretTimeoutRef.current = null;
    }
    setShowClientSecret(false);
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
    if (!profileForm.username.trim()) {
      showNotification({
        type: 'error',
        title: 'Fehler',
        message: 'Benutzername ist erforderlich'
      });
      return;
    }

    try {
      // Use executeWithValidation to handle backend validation
      await executeWithValidation(async () => {
        const updatedEmployee = await employeeService.updateEmployee(currentUser.id, {
          username: profileForm.username.trim(),
          firstname: profileForm.firstname.trim() || undefined,
          lastname: profileForm.lastname.trim() || undefined
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
      slug: '',
      name: '',
      type: 'oidc',
      issuer: '',
      clientId: '',
      clientSecret: '',
      scope: ['openid', 'profile', 'email'],
      pkce: true,
      enabled: true,
      defaultRole: 'user',
      registrationMode: 'whitelist',
      claimMapping: {
        id: 'sub',
        email: 'email',
        firstName: 'given_name',
        lastName: 'family_name',
      },
    });
    setEditingIdp(null);
    setTestResult(null);
    setSlugTouched(false);
    setWhitelistEntries([]);
    setWhitelistForm({
      identifierType: 'username',
      identifierValue: '',
      defaultRole: 'user',
      notes: '',
    });
  };

  // Open modal to add new IDP
  const handleAddIdp = () => {
    resetIdpForm();
    setShowIdpModal(true);
  };

  // Load whitelist entries for an IDP
  const loadWhitelistEntries = async (idpId: string) => {
    setLoadingWhitelist(true);
    try {
      const entries = await identityProviderService.getWhitelistEntries(idpId);
      setWhitelistEntries(entries);
    } catch (error) {
      console.error('Failed to load whitelist entries:', error);
    } finally {
      setLoadingWhitelist(false);
    }
  };

  // Open modal to edit existing IDP
  const handleEditIdp = async (idp: IdentityProvider) => {
    try {
      const fullIdp = await identityProviderService.getById(idp.id);
      setEditingIdp(fullIdp);
      setIdpForm({
        slug: fullIdp.slug,
        name: fullIdp.name,
        type: fullIdp.type || 'oidc',
        issuer: fullIdp.issuer,
        authorizationURL: fullIdp.authorizationURL || undefined,
        tokenURL: fullIdp.tokenURL || undefined,
        userInfoURL: fullIdp.userInfoURL || undefined,
        clientId: fullIdp.clientId,
        clientSecret: fullIdp.clientSecret || '',
        scope: fullIdp.scope || ['openid', 'profile', 'email'],
        pkce: fullIdp.pkce ?? true,
        enabled: fullIdp.enabled ?? true,
        defaultRole: fullIdp.defaultRole || 'user',
        registrationMode: fullIdp.registrationMode || 'whitelist',
        allowedDomains: fullIdp.allowedDomains || undefined,
        claimMapping: fullIdp.claimMapping || {
          id: 'sub',
          email: 'email',
          username: '',
          firstName: 'given_name',
          lastName: 'family_name',
        },
      });
      setSlugTouched(true); // Don't auto-update slug when editing existing IDP
      setShowIdpModal(true);

      // Load whitelist entries if in whitelist mode
      if (fullIdp.registrationMode === 'whitelist') {
        loadWhitelistEntries(fullIdp.id);
      }
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

    if (!idpForm.slug || !idpForm.name || !idpForm.issuer || !idpForm.clientId || !idpForm.clientSecret) {
      showNotification({
        type: 'error',
        title: 'Fehler',
        message: 'Bitte füllen Sie alle Pflichtfelder aus'
      });
      return;
    }

    // Validate slug format
    if (!/^[a-z0-9-]+$/.test(idpForm.slug)) {
      showNotification({
        type: 'error',
        title: 'Fehler',
        message: 'Slug darf nur Kleinbuchstaben, Zahlen und Bindestriche enthalten'
      });
      return;
    }

    try {
      // Clean form data: convert null/empty strings to undefined for optional fields
      const cleanedForm = {
        ...idpForm,
        authorizationURL: idpForm.authorizationURL || undefined,
        tokenURL: idpForm.tokenURL || undefined,
        userInfoURL: idpForm.userInfoURL || undefined,
        allowedDomains: idpForm.allowedDomains?.length ? idpForm.allowedDomains : undefined,
        // Deduplicate and trim scopes
        scope: [...new Set(idpForm.scope?.map(s => s.trim()).filter(s => s))],
        // Trim client credentials
        clientId: idpForm.clientId.trim(),
        clientSecret: idpForm.clientSecret.trim(),
        registrationMode: idpForm.registrationMode || 'whitelist',
      };

      if (editingIdp) {
        await identityProviderService.update(editingIdp.id, cleanedForm);
        showNotification({
          type: 'success',
          title: 'Erfolg',
          message: 'Identity Provider wurde aktualisiert'
        });
      } else {
        await identityProviderService.create(cleanedForm);
        showNotification({
          type: 'success',
          title: 'Erfolg',
          message: 'Identity Provider wurde erstellt'
        });
      }
      setShowIdpModal(false);
      resetIdpForm();
      loadIdentityProviders();
    } catch (error: any) {
      console.error('IDP save error:', error);
      let errorMessage = editingIdp ? 'Aktualisierung fehlgeschlagen' : 'Erstellung fehlgeschlagen';

      if (error?.validationErrors?.length > 0) {
        errorMessage = error.validationErrors.map((e: any) => `${e.field}: ${e.message}`).join(', ');
      } else if (error?.message) {
        errorMessage = error.message;
      }

      showNotification({
        type: 'error',
        title: 'Fehler',
        message: errorMessage
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

  // Add whitelist entry
  const handleAddWhitelistEntry = async () => {
    if (!editingIdp || !whitelistForm.identifierValue.trim()) {
      showNotification({
        type: 'error',
        title: 'Fehler',
        message: 'Bitte geben Sie einen Wert ein'
      });
      return;
    }

    try {
      await identityProviderService.addWhitelistEntry(editingIdp.id, {
        identifierType: whitelistForm.identifierType,
        identifierValue: whitelistForm.identifierValue.trim(),
        defaultRole: whitelistForm.defaultRole || 'user',
        notes: whitelistForm.notes?.trim() || undefined,
      });

      showNotification({
        type: 'success',
        title: 'Erfolg',
        message: 'Eintrag zur Whitelist hinzugefügt'
      });

      // Reload whitelist entries
      loadWhitelistEntries(editingIdp.id);

      // Reset form
      setWhitelistForm({
        identifierType: 'username',
        identifierValue: '',
        defaultRole: 'user',
        notes: '',
      });
    } catch (error: any) {
      showNotification({
        type: 'error',
        title: 'Fehler',
        message: error.message || 'Eintrag konnte nicht hinzugefügt werden'
      });
    }
  };

  // Delete whitelist entry
  const handleDeleteWhitelistEntry = async (entry: WhitelistEntry) => {
    if (!editingIdp) return;

    if (!confirm(`Möchten Sie den Eintrag "${entry.identifierValue}" wirklich löschen?`)) {
      return;
    }

    try {
      await identityProviderService.deleteWhitelistEntry(editingIdp.id, entry.id);

      showNotification({
        type: 'success',
        title: 'Erfolg',
        message: 'Eintrag wurde gelöscht'
      });

      // Reload whitelist entries
      loadWhitelistEntries(editingIdp.id);
    } catch (error: any) {
      showNotification({
        type: 'error',
        title: 'Fehler',
        message: error.message || 'Eintrag konnte nicht gelöscht werden'
      });
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
    } else if (name === 'registrationMode') {
      setIdpForm(prev => ({ ...prev, registrationMode: value as 'open' | 'whitelist' }));
      // Load whitelist entries when switching to whitelist mode
      if (value === 'whitelist' && editingIdp) {
        loadWhitelistEntries(editingIdp.id);
      }
    } else {
      setIdpForm(prev => ({ ...prev, [name]: value }));
    }
  };

  const idpWhitelistPlaceholders: Record<'username' | 'email' | 'subject', string> = {
    username: 'username123',
    email: 'user@example.com',
    subject: 'subject-id-123',
  };

  const idPWhitelistIdentifierTypeConfig: Record<
    'username' | 'email' | 'subject',
    { label: string; bg: string; color: string }
  > = {
    username: {
      label: 'Username',
      bg: '#e8f5e9',
      color: '#2e7d32',
    },
    email: {
      label: 'E-Mail',
      bg: '#e3f2fd',
      color: '#1565c0',
    },
    subject: {
      label: 'Subject',
      bg: '#f3e5f5',
      color: '#7b1fa2',
    },
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
                        Benutzername
                      </label>
                      <input
                        type="text"
                        value={currentUser.username}
                        disabled
                        style={styles.fieldInputDisabled}
                      />
                    </div>
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
                        E-Mail wird automatisch generiert
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
                  {/* Editable fields */}
                  <div style={styles.field}>
                    <label style={styles.fieldLabel}>
                      Benutzername {isAdmin && '*'}
                    </label>
                    <input
                      type="text"
                      name="username"
                      value={profileForm.username}
                      onChange={handleProfileChange}
                      required={isAdmin}
                      disabled={!isAdmin}
                      style={isAdmin ? styles.fieldInput : styles.fieldInputDisabled}
                      placeholder="Ihr Benutzername"
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
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div style={styles.field}>
                      <label style={styles.fieldLabel}>
                        Vorname
                      </label>
                      <input
                        type="text"
                        name="firstname"
                        value={profileForm.firstname}
                        onChange={handleProfileChange}
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
                        Nachname
                      </label>
                      <input
                        type="text"
                        name="lastname"
                        value={profileForm.lastname}
                        onChange={handleProfileChange}
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
                    disabled={isSubmitting || !profileForm.username.trim()}
                    style={{
                      ...styles.button,
                      ...styles.buttonPrimary,
                      ...((isSubmitting || !profileForm.username.trim()) ? styles.buttonDisabled : {})
                    }}
                    onMouseEnter={(e) => {
                      if (!isSubmitting && profileForm.username.trim()) {
                        e.currentTarget.style.background = styles.buttonPrimaryHover.background;
                        e.currentTarget.style.transform = styles.buttonPrimaryHover.transform;
                        e.currentTarget.style.boxShadow = styles.buttonPrimaryHover.boxShadow;
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isSubmitting && profileForm.username.trim()) {
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
                        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
                          <span style={{
                            fontSize: '0.7rem',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            background: idp.registrationMode === 'whitelist' ? '#fff3e0' : '#e8f5e9',
                            color: idp.registrationMode === 'whitelist' ? '#e65100' : '#2e7d32',
                          }}>
                            {idp.registrationMode === 'whitelist' ? '🔒 Whitelist' : '🌐 Offen'}
                          </span>
                        </div>
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
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                          <div style={styles.field}>
                            <label style={styles.fieldLabel}>Name *</label>
                            <input
                              type="text"
                              name="name"
                              value={idpForm.name}
                              onChange={(e) => {
                                const newName = e.target.value;
                                setIdpForm(f => ({
                                  ...f,
                                  name: newName,
                                  // Auto-generate slug from name if user hasn't manually edited it
                                  ...(slugTouched ? {} : { slug: slugify(newName) })
                                }));
                              }}
                              placeholder="z.B. Azure AD, Authentik"
                              style={styles.fieldInput}
                              required
                            />
                          </div>
                          <div style={styles.field}>
                            <label style={styles.fieldLabel}>Slug *</label>
                            <input
                              type="text"
                              name="slug"
                              value={idpForm.slug}
                              onChange={(e) => {
                                setSlugTouched(true);
                                setIdpForm(f => ({ ...f, slug: slugify(e.target.value) }));
                              }}
                              placeholder="z.B. azure-ad, authentik"
                              style={styles.fieldInput}
                              pattern="[a-z0-9-]+"
                              required
                            />
                          </div>
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

                        {/* Callback URL Display */}
                        {idpForm.slug && (
                          <div style={styles.field}>
                            <label style={styles.fieldLabel}>Callback URL (Redirect URI)</label>
                            <input
                              type="text"
                              value={`${APP_URL}/api/auth/external/${idpForm.slug}/callback`}
                              readOnly
                              style={{
                                ...styles.fieldInputDisabled,
                                fontFamily: 'monospace',
                                fontSize: '0.85rem'
                              }}
                              onClick={(e) => {
                                (e.target as HTMLInputElement).select();
                                navigator.clipboard.writeText((e.target as HTMLInputElement).value);
                              }}
                            />
                            <div style={styles.fieldHint}>
                              Diese URL muss im Identity Provider als erlaubte Redirect URI konfiguriert werden. Klicken zum Kopieren.
                            </div>
                          </div>
                        )}
                        <div style={{
                          marginBottom: '0px', display: 'flex',
                          flexDirection: 'column' as const,
                          width: '100%',
                        }}>
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
                        </div>
                        <div style={{
                          position: 'relative' as const,
                          width: '100%',
                        }}>
                          <div style={styles.field}>
                            <label style={styles.fieldLabel}>Client Secret *</label>
                            <input
                              type={showClientSecret ? 'text' : 'password'}
                              name="clientSecret"
                              value={idpForm.clientSecret}
                              onChange={handleIdpFormChange}
                              placeholder="••••••••"
                              style={styles.fieldInput}
                              required
                            />
                            <button
                              type="button"
                              onMouseDown={handleClientSecretMouseDown}
                              onMouseUp={handleClientSecretMouseUp}
                              onMouseLeave={handleClientSecretMouseUp}
                              onTouchStart={handleTouchStart(handleClientSecretMouseDown)}
                              onTouchEnd={handleTouchEnd(handleClientSecretMouseUp)}
                              onTouchCancel={handleTouchEnd(handleClientSecretMouseUp)}
                              onContextMenu={handleContextMenu}
                              style={{
                                position: 'absolute' as const,
                                right: '10px',
                                top: '50%',
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                                padding: '5px',
                                borderRadius: '4px',
                                transition: 'background-color 0.2s',
                                userSelect: 'none' as const,
                                WebkitUserSelect: 'none' as const,
                                touchAction: 'manipulation' as const,
                                backgroundColor: showClientSecret ? '#e0e0e0' : 'transparent',
                              }}
                              title="Gedrückt halten zum Anzeigen des Passworts"
                            >
                              {showClientSecret ? '👁' : '👁'}
                            </button>
                          </div>
                        </div>
                      </div>

                      <div style={styles.divider} />

                      {/* Endpoint URLs (Optional) */}
                      <details>
                        <summary style={styles.sectionSubtitle}>
                          Endpoint URLs (Optional)
                        </summary>
                        <div style={{ display: 'grid', gap: '1rem', marginBottom: '1rem' }}>
                          <div style={styles.field}>
                            <label style={styles.fieldLabel}>Authorization URL</label>
                            <input
                              type="url"
                              name="authorizationURL"
                              value={idpForm.authorizationURL || ''}
                              onChange={handleIdpFormChange}
                              placeholder="Automatisch aus Issuer abgeleitet"
                              style={styles.fieldInput}
                            />
                            <div style={styles.fieldHint}>
                              Leer lassen für automatische Ableitung aus Issuer URL
                            </div>
                          </div>

                          <div style={{ display: 'grid', gap: '1rem', marginBottom: '1rem' }}>
                            <div style={styles.field}>
                              <label style={styles.fieldLabel}>Token URL</label>
                              <input
                                type="url"
                                name="tokenURL"
                                value={idpForm.tokenURL || ''}
                                onChange={handleIdpFormChange}
                                placeholder="Automatisch aus Issuer"
                                style={styles.fieldInput}
                              />
                            </div>
                          </div>
                          <div style={{ display: 'grid', gap: '1rem', marginBottom: '1rem' }}>
                            <div style={styles.field}>
                              <label style={styles.fieldLabel}>UserInfo URL</label>
                              <input
                                type="url"
                                name="userInfoURL"
                                value={idpForm.userInfoURL || ''}
                                onChange={handleIdpFormChange}
                                placeholder="Automatisch aus Issuer"
                                style={styles.fieldInput}
                              />
                            </div>
                          </div>
                        </div>
                      </details>

                      <div style={styles.divider} />

                      {/* Advanced Settings */}
                      <details>
                        <summary style={styles.sectionSubtitle}>
                          Erweiterte Einstellungen
                        </summary>
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
                              <label style={styles.fieldLabel}>Registrierungsmodus</label>
                              <select
                                name="registrationMode"
                                value={idpForm.registrationMode || 'whitelist'}
                                onChange={handleIdpFormChange}
                                style={styles.fieldSelect}
                              >
                                <option value="whitelist">Whitelist (Vorfreigabe erforderlich)</option>
                                <option value="open">Offen (automatische Kontoerstellung)</option>
                              </select>
                            </div>
                          </div>

                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
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
                        </div>
                      </details>

                      {/* Whitelist Management - Only shown when editing and mode is whitelist */}
                      {editingIdp && idpForm.registrationMode === 'whitelist' && (
                        <>
                          <div style={styles.divider} />
                          <h4 style={styles.sectionSubtitle}>Whitelist-Verwaltung</h4>
                          <p style={{ color: '#666', fontSize: '0.85rem', marginBottom: '1rem' }}>
                            Nur vorfreigegebene Benutzer können sich über diesen Provider registrieren.
                          </p>

                          {/* Add Entry Form */}
                          <div style={{
                            display: 'grid',
                            gridTemplateColumns: '120px 1fr 100px auto',
                            gap: '0.5rem',
                            marginBottom: '1rem',
                            alignItems: 'end'
                          }}>
                            <div style={styles.field}>
                              <label style={{ ...styles.fieldLabel, fontSize: '0.8rem' }}>Typ</label>
                              <select
                                value={whitelistForm.identifierType}
                                onChange={(e) => setWhitelistForm(prev => ({
                                  ...prev,
                                  identifierType: e.target.value as 'username' | 'email' | 'subject'
                                }))}
                                style={{ ...styles.fieldSelect, padding: '0.5rem' }}
                              >
                                <option value="username">Username</option>
                                <option value="email">E-Mail</option>
                                <option value="subject">Subject ID</option>
                              </select>
                            </div>
                            <div style={styles.field}>
                              <label style={{ ...styles.fieldLabel, fontSize: '0.8rem' }}>Wert</label>
                              <input
                                type="text"
                                value={whitelistForm.identifierValue}
                                onChange={(e) => setWhitelistForm(prev => ({
                                  ...prev,
                                  identifierValue: e.target.value
                                }))}
                                placeholder={idpWhitelistPlaceholders[whitelistForm.identifierType]}
                                style={{ ...styles.fieldInput, padding: '0.5rem' }}
                              />
                            </div>
                            <div style={styles.field}>
                              <label style={{ ...styles.fieldLabel, fontSize: '0.8rem' }}>Rolle</label>
                              <select
                                value={whitelistForm.defaultRole || 'user'}
                                onChange={(e) => setWhitelistForm(prev => ({
                                  ...prev,
                                  defaultRole: e.target.value
                                }))}
                                style={{ ...styles.fieldSelect, padding: '0.5rem' }}
                              >
                                <option value="user">Benutzer</option>
                                <option value="admin">Admin</option>
                                <option value="maintenance">Wartung</option>
                              </select>
                            </div>
                            <button
                              type="button"
                              onClick={handleAddWhitelistEntry}
                              style={{
                                ...styles.button,
                                ...styles.buttonPrimary,
                                padding: '0.5rem 1rem',
                                fontSize: '0.85rem'
                              }}
                            >
                              + Hinzufügen
                            </button>
                          </div>

                          {/* Whitelist Entries Table */}
                          {loadingWhitelist ? (
                            <div style={{ textAlign: 'center', padding: '1rem', color: '#666' }}>
                              Lade Whitelist...
                            </div>
                          ) : whitelistEntries.length === 0 ? (
                            <div style={{
                              textAlign: 'center',
                              padding: '1.5rem',
                              background: '#f8f8f8',
                              borderRadius: '8px',
                              color: '#666'
                            }}>
                              Noch keine Einträge vorhanden.
                            </div>
                          ) : (
                            <div style={{
                              border: '1px solid #e8e8e8',
                              borderRadius: '8px',
                              overflow: 'hidden',
                              maxHeight: '200px',
                              overflowY: 'auto'
                            }}>
                              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                                <thead>
                                  <tr style={{ background: '#f5f5f5' }}>
                                    <th style={{ padding: '0.5rem', textAlign: 'left', borderBottom: '1px solid #e8e8e8' }}>Typ</th>
                                    <th style={{ padding: '0.5rem', textAlign: 'left', borderBottom: '1px solid #e8e8e8' }}>Wert</th>
                                    <th style={{ padding: '0.5rem', textAlign: 'left', borderBottom: '1px solid #e8e8e8' }}>Rolle</th>
                                    <th style={{ padding: '0.5rem', textAlign: 'center', borderBottom: '1px solid #e8e8e8', width: '60px' }}></th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {whitelistEntries.map((entry) => (
                                    < tr key={entry.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                                      <td style={{ padding: '0.5rem' }}>
                                        <span
                                          style={{
                                            background: idPWhitelistIdentifierTypeConfig[entry.identifierType].bg,
                                            color: idPWhitelistIdentifierTypeConfig[entry.identifierType].color,
                                            padding: '2px 8px',
                                            borderRadius: '4px',
                                            fontSize: '0.75rem',
                                            fontWeight: 500,
                                          }}
                                        >
                                          {idPWhitelistIdentifierTypeConfig[entry.identifierType].label}
                                        </span>
                                      </td>
                                      <td style={{ padding: '0.5rem', fontFamily: 'monospace' }}>{entry.identifierValue}</td>
                                      <td style={{ padding: '0.5rem' }}>{entry.defaultRole}</td>
                                      <td style={{ padding: '0.5rem', textAlign: 'center' }}>
                                        <button
                                          type="button"
                                          onClick={() => handleDeleteWhitelistEntry(entry)}
                                          style={{
                                            background: 'transparent',
                                            border: 'none',
                                            cursor: 'pointer',
                                            color: '#d32f2f',
                                            fontSize: '1rem'
                                          }}
                                          title="Löschen"
                                        >
                                          🗑️
                                        </button>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </>
                      )}

                      <div style={styles.divider} />

                      {/* Claim Mapping */}
                      <details>
                        <summary style={styles.sectionSubtitle}>
                          Claim Mapping
                        </summary>
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
                            <label style={styles.fieldLabel}>Username Claim</label>
                            <input
                              type="text"
                              name="claimMapping.username"
                              value={idpForm.claimMapping?.username || ''}
                              onChange={handleIdpFormChange}
                              placeholder="preferred_username"
                              style={styles.fieldInput}
                            />
                            <div style={styles.fieldHint}>
                              Claim für Benutzername (z.B. 'preferred_username')
                            </div>
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
                          <div style={styles.field}>
                            <label style={styles.fieldLabel}>Rollen Claim (optional)</label>
                            <input
                              type="text"
                              name="claimMapping.roles"
                              value={idpForm.claimMapping?.roles || ''}
                              onChange={handleIdpFormChange}
                              placeholder="groups oder roles"
                              style={styles.fieldInput}
                            />
                            <div style={styles.fieldHint}>
                              Claim für Gruppenrollen (z.B. 'groups' oder 'roles')
                            </div>
                          </div>
                        </div>
                      </details>

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
        )
        }
      </div >
    </div >
  );
};

export default Settings;