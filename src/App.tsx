import React from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { FullPageAuthSkeleton } from '@/src/components/Skeletons';
import { UsernameOnboardingScreen } from '@/src/components/UsernameOnboardingModal';
import { AuthProvider, useAuth } from '@/src/context/AuthContext';
import { ToastProvider } from '@/src/context/ToastContext';
import { AuthPage } from '@/src/pages/AuthPage';
import { ChatPage } from '@/src/pages/ChatPage';
import { HomePage } from '@/src/pages/HomePage';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { firebaseUser, profile, needsUsernameSetup, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <FullPageAuthSkeleton />;
  }

  if (!firebaseUser || !profile) {
    const search = location.search || '';
    return <Navigate to={`/login${search}`} replace />;
  }

  if (needsUsernameSetup) {
    return <UsernameOnboardingScreen />;
  }

  return <>{children}</>;
}

function JoinRedirect() {
  const location = useLocation();
  return <Navigate to={`/${location.search}`} replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<AuthPage />} />
            <Route path="/join" element={<JoinRedirect />} />
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <HomePage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/room/:roomId"
              element={
                <ProtectedRoute>
                  <ChatPage />
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}
