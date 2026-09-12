import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import ComicPanel from '../components/ui/ComicPanel';
import ComicButton from '../components/ui/ComicButton';
import ComicInput from '../components/ui/ComicInput';
import Logo from '../components/ui/Logo';
import { UserPlus, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { registerSchema } from '@comiclink/validation';
import { isEmulatorMode, isFirebaseConfigValid, missingEnvKeys } from '../services/firebase';

export default function RegisterPage() {
  const navigate = useNavigate();
  const { register, error: authError, clearError } = useAuth();

  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);
    clearError();

    const parseResult = registerSchema.safeParse({
      displayName,
      email,
      password,
      confirmPassword
    });

    if (!parseResult.success) {
      setValidationError(parseResult.error.issues[0]?.message || 'Please verify your information.');
      return;
    }

    setLoading(true);
    try {
      await register(email, password, displayName);
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

        <ComicPanel title="CREATE SECURE IDENTITY">
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

          <form onSubmit={handleRegister} className="flex flex-col gap-4 mt-2">
            <ComicInput
              label="Callsign / Display Name"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="ShadowHawk"
              required
            />
            <ComicInput
              label="Email Address"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="agent@comiclink.hq"
              required
            />
            <ComicInput
              label="Passcode (min 8 characters)"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
            <ComicInput
              label="Confirm Passcode"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              required
            />

            <div className="pt-2">
              <ComicButton
                type="submit"
                variant="secondary"
                loading={loading}
                className="w-full h-12 flex justify-center gap-2"
              >
                <UserPlus className="w-5 h-5" />
                JOIN THE LINK
              </ComicButton>
            </div>
          </form>

          <div className="mt-6 pt-4 border-t-2 border-border flex items-center justify-center text-xs text-text-muted gap-2">
            <span>Already have an identity?</span>
            <Link
              to="/login"
              className="text-accent-blue font-bold uppercase hover:underline"
            >
              Sign In
            </Link>
          </div>
        </ComicPanel>
      </div>
    </div>
  );
}
