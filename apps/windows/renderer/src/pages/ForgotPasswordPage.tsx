import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import ComicPanel from '../components/ui/ComicPanel';
import ComicButton from '../components/ui/ComicButton';
import ComicInput from '../components/ui/ComicInput';
import Logo from '../components/ui/Logo';
import { KeyRound, ArrowLeft, CheckCircle2, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { forgotPasswordSchema } from '@comiclink/validation';
import { isEmulatorMode } from '../services/firebase';

export default function ForgotPasswordPage() {
  const { sendReset, error: authError, clearError } = useAuth();

  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);
    clearError();

    const parseResult = forgotPasswordSchema.safeParse({ email });
    if (!parseResult.success) {
      setValidationError(parseResult.error.issues[0]?.message || 'Please enter a valid email.');
      return;
    }

    setLoading(true);
    try {
      await sendReset(email);
      setSubmitted(true);
    } catch {
      // Handled by context
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

        <ComicPanel title="IDENTITY RECOVERY">
          {submitted ? (
            <div className="flex flex-col gap-4 py-4">
              <div className="bg-accent-blue/20 border-2 border-accent-blue p-4 flex items-start gap-3 comic-shadow-sm">
                <CheckCircle2 className="w-6 h-6 text-accent-blue shrink-0 mt-0.5" />
                <div className="text-sm text-text">
                  <p className="font-bold uppercase tracking-wider">Recovery Signal Dispatched</p>
                  <p className="mt-1 text-text-muted leading-relaxed">
                    If an account matches <span className="text-text font-mono font-bold">{email}</span>, a secure password reset link has been dispatched to your inbox.
                  </p>
                </div>
              </div>

              <Link to="/login" className="pt-2">
                <ComicButton variant="primary" className="w-full h-11 flex justify-center gap-2">
                  <ArrowLeft className="w-4 h-4" />
                  RETURN TO LOGIN
                </ComicButton>
              </Link>
            </div>
          ) : (
            <>
              <p className="text-xs text-text-muted mb-4 leading-relaxed">
                Enter your registered agent email address to receive password reset instructions.
              </p>

              {activeError && (
                <div className="mb-4 bg-accent-red/20 border-2 border-accent-red p-3 flex items-start gap-2 comic-shadow-sm text-sm text-text">
                  <AlertCircle className="w-5 h-5 text-accent-red shrink-0 mt-0.5" />
                  <span>{activeError}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <ComicInput
                  label="Registered Email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="agent@comiclink.hq"
                  required
                />

                <div className="pt-2">
                  <ComicButton
                    type="submit"
                    variant="accent"
                    loading={loading}
                    className="w-full h-12 flex justify-center gap-2"
                  >
                    <KeyRound className="w-5 h-5" />
                    SEND RESET LINK
                  </ComicButton>
                </div>
              </form>

              <div className="mt-6 pt-4 border-t-2 border-border flex items-center justify-center text-xs text-text-muted">
                <Link
                  to="/login"
                  className="text-text hover:text-accent-blue font-bold uppercase flex items-center gap-1"
                >
                  <ArrowLeft className="w-3 h-3" />
                  Back to Sign In
                </Link>
              </div>
            </>
          )}
        </ComicPanel>
      </div>
    </div>
  );
}
