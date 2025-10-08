// frontend/src/App.tsx
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
  
  if (loading) {
    return (
      <Layout>
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <div>⏳ Lade Anwendung...</div>
        </div>
      </Layout>
    );
  }
  
  if (!user || !hasRole(roles)) {
    return <Login />;
  }
  
  return <Layout>{children}</Layout>;
};

function App() {
  return (
    <AuthProvider>
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
          
          {/* Legal Pages (ohne Layout für einfacheren Zugang) */}
          <Route path="/impressum" element={<div>Impressum Seite</div>} />
          <Route path="/datenschutz" element={<div>Datenschutz Seite</div>} />
          <Route path="/agb" element={<div>AGB Seite</div>} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;