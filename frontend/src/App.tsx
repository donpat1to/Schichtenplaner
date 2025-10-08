// frontend/src/App.tsx
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Login from './pages/Auth/Login';
import Dashboard from './pages/Dashboard/Dashboard';
import ShiftTemplateList from './pages/ShiftTemplates/ShiftTemplateList';
import ShiftTemplateEditor from './pages/ShiftTemplates/ShiftTemplateEditor';

// Protected Route Component
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();
  
  if (loading) {
    return <div style={{ padding: '20px' }}>Lade...</div>;
  }
  
  return user ? <>{children}</> : <Navigate to="/login" replace />;
};

const PublicRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();
  
  if (loading) {
    return <div style={{ padding: '20px' }}>Lade...</div>;
  }
  
  return !user ? <>{children}</> : <Navigate to="/" replace />;
};

function AppRoutes() {
  return (
    <Routes>
      {/* Public Route - nur für nicht eingeloggte User */}
      <Route path="/login" element={
        <PublicRoute>
          <Login />
        </PublicRoute>
      } />
      
      {/* Protected Routes - nur für eingeloggte User */}
      <Route path="/" element={
        <ProtectedRoute>
          <Dashboard />
        </ProtectedRoute>
      } />
      
      <Route path="/shift-templates" element={
        <ProtectedRoute>
          <ShiftTemplateList />
        </ProtectedRoute>
      } />
      
      <Route path="/shift-templates/new" element={
        <ProtectedRoute>
          <ShiftTemplateEditor />
        </ProtectedRoute>
      } />
      
      <Route path="/shift-templates/:id" element={
        <ProtectedRoute>
          <ShiftTemplateEditor />
        </ProtectedRoute>
      } />
      
      {/* Fallback Route */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <AppRoutes />
      </Router>
    </AuthProvider>
  );
}

export default App;