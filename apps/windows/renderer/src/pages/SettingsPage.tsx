import React, { useState, useEffect } from 'react';
import ComicPanel from '../components/ui/ComicPanel';
import ComicButton from '../components/ui/ComicButton';
import ComicInput from '../components/ui/ComicInput';
import SpeechBubble from '../components/ui/SpeechBubble';
import { useAuth } from '../context/AuthContext';
import { updatePublicProfileSchema, updateUserAccountSchema } from '@comiclink/validation';
import type { PresenceStatus } from '@comiclink/shared-types';
import {
  Settings,
  Shield,
  CheckCircle2,
  AlertCircle,
  Copy,
  Lock,
  Radio,
  Sliders,
  Sparkles
} from 'lucide-react';

export default function SettingsPage() {
  const { currentUser, userAccount, publicProfile, updateProfile, updateAccount } = useAuth();

  // Public Profile Form State
  const [displayName, setDisplayName] = useState('');
  const [photoURL, setPhotoURL] = useState('');
  const [bio, setBio] = useState('');
  const [presenceStatus, setPresenceStatus] = useState<PresenceStatus>('online');
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileFeedback, setProfileFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Private Account Preferences State
  const [clipboardSyncEnabled, setClipboardSyncEnabled] = useState(true);
  const [accountLoading, setAccountLoading] = useState(false);
  const [accountFeedback, setAccountFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Synchronize state from user objects when loaded
  useEffect(() => {
    if (publicProfile) {
      setDisplayName(publicProfile.displayName || '');
      setPhotoURL(publicProfile.photoURL || '');
      setBio(publicProfile.bio || '');
      setPresenceStatus(publicProfile.presenceStatus || 'online');
    }
  }, [publicProfile]);

  useEffect(() => {
    if (userAccount) {
      setClipboardSyncEnabled(userAccount.clipboardSyncEnabled ?? true);
    }
  }, [userAccount]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileFeedback(null);

    const payload = {
      displayName: displayName.trim(),
      photoURL: photoURL.trim() ? photoURL.trim() : null,
      bio: bio.trim(),
      presenceStatus
    };

    const parsed = updatePublicProfileSchema.safeParse(payload);
    if (!parsed.success) {
      setProfileFeedback({
        type: 'error',
        message: parsed.error.issues[0]?.message || 'Validation error in profile fields.'
      });
      return;
    }

    setProfileLoading(true);
    try {
      await updateProfile(parsed.data);
      setProfileFeedback({
        type: 'success',
        message: 'Public profile updated successfully!'
      });
    } catch (err: any) {
      setProfileFeedback({
        type: 'error',
        message: err.message || 'Failed to update public profile.'
      });
    } finally {
      setProfileLoading(false);
    }
  };

  const handleSaveAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setAccountFeedback(null);

    const payload = {
      clipboardSyncEnabled
    };

    const parsed = updateUserAccountSchema.safeParse(payload);
    if (!parsed.success) {
      setAccountFeedback({
        type: 'error',
        message: parsed.error.issues[0]?.message || 'Invalid account settings.'
      });
      return;
    }

    setAccountLoading(true);
    try {
      await updateAccount(parsed.data);
      setAccountFeedback({
        type: 'success',
        message: 'Account preferences saved to private vault!'
      });
    } catch (err: any) {
      setAccountFeedback({
        type: 'error',
        message: err.message || 'Failed to update account preferences.'
      });
    } finally {
      setAccountLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 h-full max-w-5xl mx-auto w-full pb-10">
      {/* Header */}
      <div className="border-b-4 border-ink pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h1 className="text-3xl font-black uppercase text-text tracking-wider flex items-center gap-3">
            <Settings className="w-8 h-8 text-accent-yellow" strokeWidth={3} />
            System Settings
          </h1>
          <p className="text-xs text-text-muted uppercase font-bold tracking-widest mt-1">
            Operative Identification & Station Directives
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Forms (2 Cols) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Public Profile Panel */}
          <ComicPanel title="PUBLIC DOSSIER & CALLSIGN">
            <form onSubmit={handleSaveProfile} className="space-y-4 py-2">
              <p className="text-xs text-text-muted">
                This identity is broadcast across the communications network and visible to paired stations.
              </p>

              {profileFeedback && (
                <div
                  className={`p-3 border-2 flex items-center gap-2 text-xs font-bold uppercase ${
                    profileFeedback.type === 'success'
                      ? 'bg-green-500/20 border-green-500 text-green-400'
                      : 'bg-accent-red/20 border-accent-red text-accent-red'
                  }`}
                >
                  {profileFeedback.type === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  )}
                  <span>{profileFeedback.message}</span>
                </div>
              )}

              <ComicInput
                label="Callsign (Display Name)"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="e.g. Red Hawk, Shadow-1"
                maxLength={50}
                required
              />

              <ComicInput
                label="Avatar URL (Optional)"
                type="url"
                value={photoURL}
                onChange={(e) => setPhotoURL(e.target.value)}
                placeholder="https://example.com/avatar.png"
              />

              <div className="flex flex-col gap-1">
                <label className="font-bold text-text-muted text-sm uppercase">Mission Bio</label>
                <textarea
                  className="bg-ink border-2 border-border text-text px-3 py-2 outline-none focus:border-accent-blue focus:ring-1 focus:ring-accent-blue transition-colors text-sm min-h-[80px]"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Operational background, sector, or notes..."
                  maxLength={500}
                />
                <div className="text-[10px] text-text-muted text-right font-mono">
                  {bio.length} / 500
                </div>
              </div>

              {/* Presence Status Select */}
              <div className="flex flex-col gap-1.5">
                <label className="font-bold text-text-muted text-sm uppercase flex items-center gap-1.5">
                  <Radio className="w-3.5 h-3.5 text-accent-blue" />
                  Presence Beacon (Self-Reported Status)
                </label>
                <p className="text-[10px] text-text-muted">
                  Broadcast status displayed on your profile. Automated station heartbeat telemetry will activate in Phase 3.
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {(['online', 'away', 'offline'] as const).map((status) => (
                    <button
                      type="button"
                      key={status}
                      onClick={() => setPresenceStatus(status)}
                      className={`py-2 px-3 border-2 font-bold text-xs uppercase flex items-center justify-center gap-2 transition-all ${
                        presenceStatus === status
                          ? 'bg-accent-yellow text-ink border-ink comic-shadow'
                          : 'bg-ink border-border text-text-muted hover:text-text hover:border-text-muted'
                      }`}
                    >
                      <span
                        className={`w-2.5 h-2.5 rounded-full ${
                          status === 'online'
                            ? 'bg-green-500'
                            : status === 'away'
                            ? 'bg-accent-yellow'
                            : 'bg-gray-500'
                        }`}
                      />
                      {status}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-2">
                <ComicButton
                  type="submit"
                  variant="primary"
                  loading={profileLoading}
                  disabled={profileLoading}
                  className="w-full sm:w-auto"
                >
                  <Sparkles className="w-4 h-4" />
                  SAVE PUBLIC PROFILE
                </ComicButton>
              </div>
            </form>
          </ComicPanel>

          {/* Account Preferences Panel */}
          <ComicPanel title="PRIVATE STATION DIRECTIVES">
            <form onSubmit={handleSaveAccount} className="space-y-4 py-2">
              <p className="text-xs text-text-muted">
                Private preferences stored strictly in your private user account vault (<code className="text-accent-yellow">users/{currentUser?.uid}</code>).
              </p>

              {accountFeedback && (
                <div
                  className={`p-3 border-2 flex items-center gap-2 text-xs font-bold uppercase ${
                    accountFeedback.type === 'success'
                      ? 'bg-green-500/20 border-green-500 text-green-400'
                      : 'bg-accent-red/20 border-accent-red text-accent-red'
                  }`}
                >
                  {accountFeedback.type === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  )}
                  <span>{accountFeedback.message}</span>
                </div>
              )}

              <div className="bg-ink/60 border-2 border-border p-4 flex items-start gap-4">
                <input
                  id="clipboardSync"
                  type="checkbox"
                  checked={clipboardSyncEnabled}
                  onChange={(e) => setClipboardSyncEnabled(e.target.checked)}
                  className="mt-1 w-4 h-4 accent-accent-yellow cursor-pointer"
                />
                <label htmlFor="clipboardSync" className="cursor-pointer">
                  <div className="font-bold text-sm text-text uppercase flex items-center gap-2">
                    <Copy className="w-4 h-4 text-accent-yellow" />
                    Enable Cross-Station Clipboard Relay
                  </div>
                  <p className="text-xs text-text-muted mt-1 leading-relaxed">
                    When active, shared text or links can be relayed across your authorized devices. Can be toggled off at any time.
                  </p>
                </label>
              </div>

              <div className="pt-2">
                <ComicButton
                  type="submit"
                  variant="secondary"
                  loading={accountLoading}
                  disabled={accountLoading}
                  className="w-full sm:w-auto"
                >
                  <Sliders className="w-4 h-4" />
                  SAVE ACCOUNT PREFERENCES
                </ComicButton>
              </div>
            </form>
          </ComicPanel>
        </div>

        {/* Right Column: Security Audit & Server-Owned Fields (1 Col) */}
        <div className="space-y-6">
          <ComicPanel title="SECURITY CONSTRAINTS">
            <div className="space-y-4 py-2">
              <div className="flex items-center gap-2 text-xs font-bold text-accent-yellow uppercase">
                <Lock className="w-4 h-4 text-accent-yellow" />
                Server-Owned Ledger
              </div>

              <p className="text-xs text-text-muted leading-relaxed">
                The fields below are managed exclusively by server authority and security rules. Clients cannot tamper with or mutate these values.
              </p>

              <div className="space-y-3 bg-ink/70 p-3 border-2 border-border text-xs">
                <div>
                  <div className="text-[10px] text-text-muted uppercase font-bold">User UID</div>
                  <div className="font-mono text-accent-yellow break-all mt-0.5">
                    {currentUser?.uid || 'N/A'}
                  </div>
                </div>

                <div className="border-t border-border pt-2">
                  <div className="text-[10px] text-text-muted uppercase font-bold">Account Role</div>
                  <div className="font-bold text-text uppercase mt-0.5 flex items-center gap-1.5">
                    <Shield className="w-3.5 h-3.5 text-accent-blue" />
                    {userAccount?.role || 'user'}
                  </div>
                </div>

                <div className="border-t border-border pt-2">
                  <div className="text-[10px] text-text-muted uppercase font-bold">Account Status</div>
                  <div className="font-bold text-green-400 uppercase mt-0.5">
                    {userAccount?.accountStatus || 'active'}
                  </div>
                </div>

                <div className="border-t border-border pt-2">
                  <div className="text-[10px] text-text-muted uppercase font-bold">Email Verification</div>
                  <div className="font-bold uppercase mt-0.5 text-text">
                    {currentUser?.emailVerified ? 'VERIFIED' : 'UNVERIFIED'}
                  </div>
                </div>

                <div className="border-t border-border pt-2">
                  <div className="text-[10px] text-text-muted uppercase font-bold">Registered Stations</div>
                  <div className="font-bold uppercase mt-0.5 text-text">
                    {userAccount?.deviceCount ?? 1} station(s)
                  </div>
                </div>
              </div>

              <SpeechBubble direction="left" className="text-xs font-bold text-text-muted">
                Rule Defense: Attempts to modify role or bypass access result in Firestore <span className="text-accent-red font-mono font-bold">PERMISSION_DENIED</span>.
              </SpeechBubble>
            </div>
          </ComicPanel>
        </div>
      </div>
    </div>
  );
}

