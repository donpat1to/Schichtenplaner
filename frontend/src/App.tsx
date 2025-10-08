// frontend/src/App.tsx - KORRIGIERT
import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Layout from './components/Layout/Layout';
import Login from './pages/Auth/Login';
import Dashboard from './pages/Dashboard/Dashboard';
import ShiftPlanList from './pages/ShiftPlans/ShiftPlanList';
import ShiftPlanCreate from './pages/ShiftPlans/ShiftPlanCreate';
import EmployeeManagement from './pages/Employees/EmployeeManagement';
import Settings from './pages/Settings/Settings';
import Help from './pages/Help/Help';

// Protected Route Component
const ProtectedRoute: React.FC<{ children: React.ReactNode; roles?: string[] }> = ({ 
  children, 
  roles = ['admin', 'instandhalter', 'user'] 
}) => {
  const { user, loading, hasRole } = useAuth();

  console.log('🔒 ProtectedRoute - User:', user?.email, 'Loading:', loading);

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '40px' }}>
        <div>⏳ Lade Anwendung...</div>
      </div>
    );
  }
  
  if (!user) {
    console.log('❌ No user, redirecting to login');
    return <Login />;
  }

  if (!hasRole(roles)) {
    console.log('❌ Insufficient permissions for:', user.email);
    return (
      <Layout>
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <h2>Zugriff verweigert</h2>
          <p>Sie haben keine Berechtigung für diese Seite.</p>
        </div>
      </Layout>
    );
  }
  
  console.log('✅ Access granted for:', user.email);
  return <Layout>{children}</Layout>;
};

function App() {
  const { user, loading } = useAuth();

  console.log('🏠 App Component - User:', user?.email, 'Loading:', loading);

  // Während des Ladens zeigen wir einen Loading Screen
  if (loading) {
    return (
      <div style={{ 
        textAlign: 'center', 
        padding: '100px 20px',
        fontSize: '18px'
      }}>
        <div>⏳ SchichtPlaner wird geladen...</div>
      </div>
    );
  }

  return (
    <Router>
      <Routes>
        {/* Public Route */}
        <Route path="/login" element={<Login />} />
        
        {/* Protected Routes with Layout */}
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
  );
}

// Hauptkomponente mit AuthProvider
function AppWrapper() {
  return (
    <AuthProvider>
      <App />
    </AuthProvider>
  );
}

export default AppWrapper;