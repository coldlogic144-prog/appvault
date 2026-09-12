import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { isFirebaseConfigValid } from '../../services/firebase';
import ConfigErrorPanel from '../ui/ConfigErrorPanel';
import ComicPanel from '../ui/ComicPanel';
import Logo from '../ui/Logo';
import { Loader2 } from 'lucide-react';

export default function PublicRoute() {
  const { currentUser, loading } = useAuth();

  if (!isFirebaseConfigValid) {
    return <ConfigErrorPanel />;
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-navy p-6">
        <div className="w-full max-w-sm">
          <div className="mb-6 flex justify-center">
            <Logo className="text-3xl" />
          </div>
          <ComicPanel title="INITIALIZING SYSTEM">
            <div className="flex flex-col items-center justify-center py-6 gap-3">
              <Loader2 className="w-10 h-10 text-accent-yellow animate-spin" />
              <p className="font-bold text-sm text-text-muted tracking-wider uppercase text-center">
                Establishing Link...
              </p>
            </div>
          </ComicPanel>
        </div>
      </div>
    );
  }

  if (currentUser) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}
