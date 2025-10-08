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

// Protected Route Component direkt in App.tsx
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

function App() {
  return (
    <NotificationProvider>
      <AuthProvider>
        <Router>
          <NotificationContainer />
          <Routes>
            <Route path="/login" element={<Login />} />
            
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
          </Routes>
        </Router>
      </AuthProvider>
    </NotificationProvider>
  );
}

export default App;