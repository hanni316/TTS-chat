import { useEffect } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/state/authStore';
import { useDesktopNotifications } from '@/hooks/useDesktopNotifications';
import { Toaster } from '@/components/Toaster';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { LandingPage } from '@/routes/LandingPage';
import { NicknamePage } from '@/routes/NicknamePage';
import { HomePage } from '@/routes/HomePage';
import { AddPage } from '@/routes/AddPage';
import { ChatRoomPage } from '@/routes/ChatRoomPage';
import { DetailPage } from '@/routes/DetailPage';
import { SettingsPage } from '@/routes/SettingsPage';

function Protected({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user);
  const status = useAuthStore((s) => s.status);
  const location = useLocation();
  if (status === 'idle') return null;
  if (!user) return <Navigate to="/" replace state={{ from: location }} />;
  return <>{children}</>;
}

export default function App() {
  const refresh = useAuthStore((s) => s.refresh);
  useEffect(() => {
    refresh();
  }, [refresh]);
  useDesktopNotifications();

  return (
    <div className="mx-auto flex h-[100dvh] max-w-screen-sm flex-col overflow-hidden bg-bg-base">
      <ErrorBoundary>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/signup" element={<NicknamePage />} />
          <Route
            path="/home"
            element={
              <Protected>
                <HomePage />
              </Protected>
            }
          />
          <Route
            path="/add"
            element={
              <Protected>
                <AddPage />
              </Protected>
            }
          />
          <Route
            path="/room/:roomId"
            element={
              <Protected>
                <ChatRoomPage />
              </Protected>
            }
          />
          <Route
            path="/detail/friend/:otherId"
            element={
              <Protected>
                <DetailPage kind="friend" />
              </Protected>
            }
          />
          <Route
            path="/detail/group/:roomId"
            element={
              <Protected>
                <DetailPage kind="group" />
              </Protected>
            }
          />
          <Route
            path="/settings"
            element={
              <Protected>
                <SettingsPage />
              </Protected>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </ErrorBoundary>
      <Toaster />
    </div>
  );
}
