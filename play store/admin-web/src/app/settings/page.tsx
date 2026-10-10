'use client';

import React, { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import AdminGuard from '@/components/AdminGuard';

export default function SettingsPage() {
  const { user, isAdmin, refreshAdminStatus, signOut } = useAuth();
  const [checking, setChecking] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const handleRefresh = async () => {
    setChecking(true);
    setStatusMessage(null);
    const ok = await refreshAdminStatus();
    setChecking(false);
    setStatusMessage(ok ? '✓ Administrator authorization verified with live Firebase token!' : '⚠️ Still not recognized as administrator.');
  };

  return (
    <AdminGuard>
      <header className="top-header">
        <h1 className="header-title">Settings & System Configuration</h1>
      </header>

      <div className="content-body" style={{ maxWidth: '800px' }}>
        {/* Administrator Profile Card */}
        <div style={{
          backgroundColor: 'var(--bg-surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          padding: '28px',
          marginBottom: '24px'
        }}>
          <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '20px' }}>Administrator Session</h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '12px', borderBottom: '1px solid var(--border)' }}>
              <span style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Email Address</span>
              <span style={{ fontWeight: 600, fontSize: '14px' }}>{user?.email}</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '12px', borderBottom: '1px solid var(--border)' }}>
              <span style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Firebase UID</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', color: 'var(--text-subtle)' }}>{user?.uid}</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Authorization Status</span>
              <span className={`badge ${isAdmin ? 'badge-published' : 'badge-draft'}`}>
                {isAdmin ? '✓ Verified Administrator' : 'Access Restricted'}
              </span>
            </div>
          </div>

          {statusMessage && (
            <div style={{
              marginTop: '16px',
              padding: '10px 14px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--primary-subtle)',
              color: 'var(--primary)',
              fontSize: '13px',
              fontWeight: 600
            }}>
              {statusMessage}
            </div>
          )}

          <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
            <button
              onClick={handleRefresh}
              className="btn btn-secondary"
              disabled={checking}
            >
              {checking ? 'Checking...' : '🔄 Force Refresh Token Claims'}
            </button>
            <button
              onClick={() => signOut()}
              className="btn btn-danger"
            >
              Sign Out
            </button>
          </div>
        </div>

        {/* GitHub Releases Integration Card */}
        <div style={{
          backgroundColor: 'var(--bg-surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          padding: '28px',
          marginBottom: '24px'
        }}>
          <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '8px' }}>GitHub Releases Architecture</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', lineHeight: '1.6', marginBottom: '16px' }}>
            AppVault distributes native Android APK files strictly through GitHub Releases.
            The server-side publishing API creates releases and uploads APK binary assets via the GitHub REST API.
          </p>

          <div style={{
            backgroundColor: 'var(--bg-primary)',
            padding: '16px',
            borderRadius: 'var(--radius-md)',
            fontFamily: 'var(--font-mono)',
            fontSize: '13px',
            lineHeight: '1.8',
            color: 'var(--text-muted)'
          }}>
            <div><span style={{ color: 'var(--primary)' }}>GITHUB_PAT</span>: [Configured securely on server]</div>
            <div><span style={{ color: 'var(--primary)' }}>GITHUB_OWNER</span>: Defaults to individual app repo or environment</div>
            <div><span style={{ color: 'var(--primary)' }}>GITHUB_REPO</span>: Configured per application in App Settings</div>
          </div>
        </div>

        {/* Media & Storage Notice Card */}
        <div style={{
          backgroundColor: 'var(--bg-surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          padding: '28px'
        }}>
          <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '8px' }}>Google Drive Media Storage</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', lineHeight: '1.6', marginBottom: '16px' }}>
            Application icons and screenshot gallery images are hosted securely in Google Drive.
            Uploaded media files are stored in your dedicated <code style={{ color: 'var(--primary)' }}>AppVault/icons/{'{appId}'}</code> and <code style={{ color: 'var(--primary)' }}>AppVault/screenshots/{'{appId}'}</code> folders, and served to the Android AppVault application via direct high-performance CDN URLs with cache-busting versioning.
          </p>

          <div style={{
            backgroundColor: 'var(--bg-primary)',
            padding: '16px',
            borderRadius: 'var(--radius-md)',
            fontFamily: 'var(--font-mono)',
            fontSize: '13px',
            lineHeight: '1.8',
            color: 'var(--text-muted)',
            marginBottom: '16px'
          }}>
            <div><span style={{ color: 'var(--primary)' }}>GOOGLE_CLIENT_ID</span>: [Server-side OAuth2 Client ID]</div>
            <div><span style={{ color: 'var(--primary)' }}>GOOGLE_CLIENT_SECRET</span>: [Server-side Client Secret]</div>
            <div><span style={{ color: 'var(--primary)' }}>GOOGLE_REFRESH_TOKEN</span>: [Server-side Persistent Refresh Token]</div>
            <div><span style={{ color: 'var(--primary)' }}>GOOGLE_DRIVE_FOLDER_ID</span>: [Optional - Auto-creates AppVault root folder]</div>
          </div>

          <p style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
            To configure Google Drive, obtain your OAuth credentials from the Google Cloud Console, generate a refresh token, and add them to <code style={{ color: 'var(--primary)' }}>admin-web/.env.local</code>.
          </p>
        </div>
      </div>
    </AdminGuard>
  );
}
