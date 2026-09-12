import ComicPanel from './ComicPanel';
import ComicButton from './ComicButton';
import Logo from './Logo';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { missingEnvKeys } from '../../services/firebase';

export default function ConfigErrorPanel() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-navy p-6">
      <div className="w-full max-w-lg">
        <div className="mb-8 flex justify-center">
          <Logo className="text-4xl" />
        </div>

        <ComicPanel title="SYSTEM CONFIGURATION REQUIRED">
          <div className="flex items-start gap-4 mb-4">
            <AlertTriangle className="w-10 h-10 text-accent-red shrink-0" />
            <div>
              <h2 className="text-lg font-bold text-accent-red uppercase tracking-wide">
                Firebase Environment Not Detected
              </h2>
              <p className="text-sm text-text-muted mt-1 leading-relaxed">
                ComicLink requires valid Firebase client configuration to authenticate securely.
              </p>
            </div>
          </div>

          <div className="bg-ink border-2 border-border p-4 mb-4 text-xs font-mono space-y-1">
            <p className="text-accent-yellow font-bold">Missing Environment Variables:</p>
            {missingEnvKeys.map((key) => (
              <p key={key} className="text-text-muted">• {key}</p>
            ))}
          </div>

          <div className="bg-ink/50 border border-border/50 p-3 mb-6 text-xs text-text-muted space-y-2">
            <p className="text-text font-bold">To resolve:</p>
            <p>1. Copy <code className="text-accent-blue">.env.example</code> to <code className="text-accent-blue">.env</code> in the project root.</p>
            <p>2. Provide your Firebase Web project API credentials, or set <code className="text-accent-yellow">VITE_USE_EMULATORS=true</code> for local development.</p>
          </div>

          <ComicButton
            variant="secondary"
            className="w-full h-11 flex justify-center gap-2"
            onClick={() => window.location.reload()}
          >
            <RefreshCw className="w-4 h-4" />
            RE-CHECK CONFIGURATION
          </ComicButton>
        </ComicPanel>
      </div>
    </div>
  );
}
