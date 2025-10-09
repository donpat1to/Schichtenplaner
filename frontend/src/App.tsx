// frontend/src/App.tsx - KORRIGIERTE VERSION
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
import EmployeeManagement from './pages/Employees/EmployeeManagement';
import Settings from './pages/Settings/Settings';
import Help from './pages/Help/Help';
import Setup from './pages/Setup/Setup';

// Protected Route Component
const ProtectedRoute: React.FC<{ children: React.ReactNode; roles?: string[] }> = ({ 
  children, 
  roles = ['admin', 'instandhalter', 'user'] 
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

// SetupWrapper Component
const SetupWrapper: React.FC = () => {
  return (
    <Router>
      <Setup />
    </Router>
  );
};

// LoginWrapper Component  
const LoginWrapper: React.FC = () => {
  return (
    <Router>
      <Login />
    </Router>
  );
};

// Main App Content
const AppContent: React.FC = () => {
  const { loading, needsSetup, user } = useAuth();

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '40px' }}>
        <div>⏳ Lade Anwendung...</div>
      </div>
    );
  }

  console.log('AppContent - needsSetup:', needsSetup, 'user:', user);

  // Wenn Setup benötigt wird → Setup zeigen (mit Router)
  if (needsSetup) {
    return <SetupWrapper />;
  }

  // Wenn kein User eingeloggt ist → Login zeigen (mit Router)
  if (!user) {
    return <LoginWrapper />;
  }

  // Wenn User eingeloggt ist → Geschützte Routen zeigen
  return (
    <Router>
      <NotificationContainer />
      <Routes>
        <Route path="/" element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        } />
        <Route path="/shift-plans" element={
          <ProtectedRoute>
            <ShiftPlanList />
          </ProtectedRoute>
        } />
        <Route path="/shift-plans/new" element={
          <ProtectedRoute roles={['admin', 'instandhalter']}>
            <ShiftPlanCreate />
          </ProtectedRoute>
        } />
        <Route path="/employees" element={
          <ProtectedRoute roles={['admin', 'instandhalter']}>
            <EmployeeManagement />
          </ProtectedRoute>
        } />
        <Route path="/settings" element={
          <ProtectedRoute roles={['admin']}>
            <Settings />
          </ProtectedRoute>
        } />
        <Route path="/help" element={
          <ProtectedRoute>
            <Help />
          </ProtectedRoute>
        } />
        <Route path="/login" element={<Login />} />
      </Routes>
    </Router>
  );
};

function App() {
  return (
    <NotificationProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </NotificationProvider>
  );
}

export default App;