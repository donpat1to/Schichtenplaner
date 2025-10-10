// frontend/src/App.tsx - KORRIGIERT MIT LAYOUT
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

// Main App Content
const AppContent: React.FC = () => {
  const { loading, needsSetup, user } = useAuth();

  console.log('🏠 AppContent rendering - loading:', loading, 'needsSetup:', needsSetup, 'user:', user);

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
      <Route path="/shift-plans/:id/edit" element={
        <ProtectedRoute roles={['admin', 'instandhalter']}>
          <ShiftPlanEdit />
        </ProtectedRoute>
      } />
      <Route path="/shift-plans/:id" element={
        <ProtectedRoute>
          <ShiftPlanView />
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
      <Route path="*" element={
        <ProtectedRoute>
          <Dashboard />
        </ProtectedRoute>
      } />
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