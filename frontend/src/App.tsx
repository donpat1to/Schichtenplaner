// frontend/src/App.tsx - ONE-REPO SAFE WITHOUT DYNAMIC IMPORTS
import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { NotificationProvider } from './contexts/NotificationContext';
import NotificationContainer from './components/Notification/NotificationContainer';
import Layout from './components/Layout/Layout';
import Login from './pages/Auth/Login';
import Dashboard from './pages/Dashboard/Dashboard';
import ShiftPlanList from './pages/ShiftPlans/ShiftPlanList';
import ShiftPlanCreate from './pages/ShiftPlans/ShiftPlanCreate';
import ShiftPlanEdit from './pages/ShiftPlans/ShiftPlanEdit';
import ShiftPlanView from './pages/ShiftPlans/ShiftPlanView';
import EmployeeManagement from './pages/Employees/EmployeeManagement';
import Settings from './pages/Settings/Settings';
import Help from './pages/Help/Help';
import Setup from './pages/Setup/Setup';

// Free Footer Link Pages (always available)
import FAQ from './components/Layout/FooterLinks/FAQ/FAQ';
import About from './components/Layout/FooterLinks/About/About';
import Features from './components/Layout/FooterLinks/Features/Features';

// Feature flag from environment
const ENABLE_PRO = process.env.ENABLE_PRO === 'true';

// Community fallback components (always available)
const CommunityContact: React.FC = () => (
  <div style={{ padding: '40px 20px', maxWidth: '800px', margin: '0 auto' }}>
    <h1>📞 Kontakt</h1>
    <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '30px', marginTop: '20px' }}>
      <h2 style={{ color: '#2c3e50' }}>Community Edition</h2>
      <p>Kontaktfunktionen sind in der Premium Edition verfügbar.</p>
      <p>
        <a href="/features" style={{ color: '#3498db' }}>
          ➡️ Zu den Features
        </a>
      </p>
    </div>
  </div>
);

const CommunityLegalPage: React.FC<{ title: string }> = ({ title }) => (
  <div style={{ padding: '40px 20px', maxWidth: '800px', margin: '0 auto' }}>
    <h1>📄 {title}</h1>
    <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '30px', marginTop: '20px' }}>
      <h2 style={{ color: '#2c3e50' }}>Community Edition</h2>
      <p>Rechtliche Dokumentation ist in der Premium Edition verfügbar.</p>
      <p>
        <a href="/features" style={{ color: '#3498db' }}>
          ➡️ Erfahren Sie mehr über Premium
        </a>
      </p>
    </div>
  </div>
);

// Conditional Premium Components
let PremiumContact: React.FC = CommunityContact;
let PremiumPrivacy: React.FC = () => <CommunityLegalPage title="Datenschutz" />;
let PremiumImprint: React.FC = () => <CommunityLegalPage title="Impressum" />;
let PremiumTerms: React.FC = () => <CommunityLegalPage title="AGB" />;

// Load premium components only when ENABLE_PRO is true
if (ENABLE_PRO) {
  try {
    // Use require with type assertions to avoid dynamic import issues
    const premiumModule = require('@premium-frontend/components/FooterLinks');
    
    if (premiumModule.Contact) PremiumContact = premiumModule.Contact;
    if (premiumModule.Privacy) PremiumPrivacy = premiumModule.Privacy;
    if (premiumModule.Imprint) PremiumImprint = premiumModule.Imprint;
    if (premiumModule.Terms) PremiumTerms = premiumModule.Terms;
    
    console.log('✅ Premium components loaded successfully');
  } catch (error) {
    console.warn('⚠️ Premium components not available, using community fallbacks:', error);
  }
}

// Protected Route Component
const ProtectedRoute: React.FC<{ children: React.ReactNode; roles?: string[] }> = ({ 
  children, 
  roles = ['admin', 'maintenance', 'user'] 
}) => {
  const { user, loading, hasRole } = useAuth();

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '40px' }}>
        <div>⏳ Lade Anwendung...</div>
      </div>
    );
  }
  
  if (!user) {
    return <Login />;
  }

  if (!hasRole(roles)) {
    return (
      <Layout>
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <h2>Zugriff verweigert</h2>
          <p>Sie haben keine Berechtigung für diese Seite.</p>
        </div>
      </Layout>
    );
  }
  
  return <Layout>{children}</Layout>;
};

// Public Route Component (without Layout for footer pages)
const PublicRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '40px' }}>
        <div>⏳ Lade Anwendung...</div>
      </div>
    );
  }

  return user ? <Layout>{children}</Layout> : <>{children}</>;
};

// Main App Content
const AppContent: React.FC = () => {
  const { loading, needsSetup, user } = useAuth();

  console.log('🏠 AppContent rendering - loading:', loading, 'needsSetup:', needsSetup, 'user:', user);
  console.log('🎯 Premium features enabled:', ENABLE_PRO);

  // Während des Ladens
  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '40px' }}>
        <div>⏳ Lade Anwendung...</div>
      </div>
    );
  }

  // Setup benötigt
  if (needsSetup) {
    console.log('🔧 Showing setup page');
    return <Setup />;
  }

  // Kein User eingeloggt
  if (!user) {
    console.log('🔐 Showing login page');
    return <Login />;
  }

  // User eingeloggt - Geschützte Routen
  console.log('✅ Showing protected routes for user:', user.email);
  return (
    <Routes>
      {/* Protected Routes (require login) */}
      <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/shift-plans" element={<ProtectedRoute><ShiftPlanList /></ProtectedRoute>} />
      <Route path="/shift-plans/new" element={<ProtectedRoute roles={['admin', 'maintenance']}><ShiftPlanCreate /></ProtectedRoute>} />
      <Route path="/shift-plans/:id/edit" element={<ProtectedRoute roles={['admin', 'maintenance']}><ShiftPlanEdit /></ProtectedRoute>} />
      <Route path="/shift-plans/:id" element={<ProtectedRoute><ShiftPlanView /></ProtectedRoute>} />
      <Route path="/employees" element={<ProtectedRoute roles={['admin', 'maintenance']}><EmployeeManagement /></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
      <Route path="/help" element={<ProtectedRoute><Help /></ProtectedRoute>} />

      {/* Public Footer Link Pages (always available) */}
      <Route path="/faq" element={<PublicRoute><FAQ /></PublicRoute>} />
      <Route path="/about" element={<PublicRoute><About /></PublicRoute>} />
      <Route path="/features" element={<PublicRoute><Features /></PublicRoute>} />

      {/* PREMIUM Footer Link Pages (conditionally available) */}
      <Route path="/contact" element={<PublicRoute><PremiumContact /></PublicRoute>} />
      <Route path="/privacy" element={<PublicRoute><PremiumPrivacy /></PublicRoute>} />
      <Route path="/imprint" element={<PublicRoute><PremiumImprint /></PublicRoute>} />
      <Route path="/terms" element={<PublicRoute><PremiumTerms /></PublicRoute>} />

      {/* Auth Routes */}
      <Route path="/login" element={<Login />} />
      
      {/* Catch-all Route */}
      <Route path="*" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
    </Routes>
  );
};

function App() {
  return (
    <NotificationProvider>
      <AuthProvider>
        <Router>
          <NotificationContainer />
          <AppContent />
        </Router>
      </AuthProvider>
    </NotificationProvider>
  );
}

export default App;