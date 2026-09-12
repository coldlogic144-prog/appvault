import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import ComicPanel from '../components/ui/ComicPanel';
import ComicButton from '../components/ui/ComicButton';
import ComicInput from '../components/ui/ComicInput';
import Logo from '../components/ui/Logo';
import { LogIn, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { loginSchema } from '@comiclink/validation';
import { isEmulatorMode, isFirebaseConfigValid, missingEnvKeys } from '../services/firebase';

export default function LoginPage() {
  const navigate = useNavigate();
  const { login, error: authError, clearError } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);
    clearError();

    const parseResult = loginSchema.safeParse({ email, password });
    if (!parseResult.success) {
      setValidationError(parseResult.error.issues[0]?.message || 'Please check your input.');
      return;
    }

    setLoading(true);
    try {
      await login(email, password);
      navigate('/dashboard');
    } catch {
      // Error handled by AuthContext
    } finally {
      setLoading(false);
    }
  };

  const activeError = validationError || authError;

  return (
    <div className="min-h-screen flex items-center justify-center bg-navy p-6">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center gap-2">
          <Logo className="text-4xl" />
          {isEmulatorMode && (
            <span className="bg-accent-yellow/20 border border-accent-yellow text-accent-yellow text-xs font-bold px-2 py-0.5 uppercase tracking-wider comic-shadow-sm">
              Local Emulator Mode
            </span>
          )}
        </div>

        <ComicPanel title="AUTHENTICATION REQUIRED">
          {!isFirebaseConfigValid && (
            <div className="mb-4 bg-accent-yellow/20 border-2 border-accent-yellow p-3 flex items-start gap-2 comic-shadow-sm text-xs text-text">
              <AlertCircle className="w-5 h-5 text-accent-yellow shrink-0 mt-0.5" />
              <div>
                <strong className="text-accent-yellow uppercase block font-black">Configuration Required</strong>
                <span>Firebase credentials are missing ({missingEnvKeys.join(', ')}). Set up <code>.env</code> or set <code>VITE_USE_EMULATORS=true</code>.</span>
              </div>
            </div>
          )}

          {activeError && (
            <div className="mb-4 bg-accent-red/20 border-2 border-accent-red p-3 flex items-start gap-2 comic-shadow-sm text-sm text-text">
              <AlertCircle className="w-5 h-5 text-accent-red shrink-0 mt-0.5" />
              <span>{activeError}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="flex flex-col gap-4 mt-2">
            <ComicInput
              label="Email Address"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="agent@comiclink.hq"
              required
            />
            <ComicInput
              label="Passcode"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />

            <div className="flex justify-end">
              <Link
                to="/forgot-password"
                className="text-xs text-accent-blue hover:underline font-bold uppercase tracking-wide"
              >
                Lost Passcode?
              </Link>
            </div>

            <div className="pt-2">
              <ComicButton
                type="submit"
                loading={loading}
                className="w-full h-12 flex justify-center gap-2"
              >
                <LogIn className="w-5 h-5" />
                ENTER SYSTEM
              </ComicButton>
            </div>
          </form>

          <div className="mt-6 pt-4 border-t-2 border-border flex items-center justify-center text-xs text-text-muted gap-2">
            <span>New recruit?</span>
            <Link
              to="/register"
              className="text-accent-yellow font-bold uppercase hover:underline"
            >
              Enlist Now
            </Link>
          </div>
        </ComicPanel>
      </div>
    </div>
  );
}
