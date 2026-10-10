'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { collection, onSnapshot, query, orderBy, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/lib/auth-context';
import { AppItem, AppVersion } from '@/lib/types';
import AdminGuard from '@/components/AdminGuard';
import { ToastViewport, useToasts } from '@/components/Toast';
import type { ToastDetail } from '@/components/Toast';

/** Success payload of POST /api/releases/publish (HTTP 200). */
interface PublishReleaseSuccess {
  success: true;
  message: string;
  versionId: string;
  apkUrl: string;
  /** releaseData.html_url from the GitHub API; absent only if GitHub omits it. */
  releaseUrl?: string;
}

/** Failure payload of POST /api/releases/publish (HTTP 400/401/403/404/500/502). */
interface PublishReleaseFailure {
  success?: false;
  error: string;
  diagnostic?: {
    status: number;
    owner: string;
    repo: string;
    hasPAT: boolean;
    authenticatedUser?: string;
  };
}

type PublishReleaseResponse = PublishReleaseSuccess | PublishReleaseFailure;

function ReleasesContent() {
  const searchParams = useSearchParams();
  const initialAppId = searchParams.get('appId') || '';
  const { idToken } = useAuth();
  const { toasts, pushToast, dismissToast } = useToasts();

  const [apps, setApps] = useState<AppItem[]>([]);
  const [selectedAppId, setSelectedAppId] = useState(initialAppId);
  const [versions, setVersions] = useState<AppVersion[]>([]);
  const [loadingVersions, setLoadingVersions] = useState(false);

  // Modal / Form state
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [targetAppId, setTargetAppId] = useState(initialAppId);
  const [versionName, setVersionName] = useState('');
  const [versionCode, setVersionCode] = useState('');
  const [releaseTag, setReleaseTag] = useState('');
  const [releaseNotes, setReleaseNotes] = useState('');
  const [minAndroidVersion, setMinAndroidVersion] = useState('26');
  const [apkFile, setApkFile] = useState<File | null>(null);

  // Publishing progress state
  const [isPublishing, setIsPublishing] = useState(false);
  const [uploadStep, setUploadStep] = useState<string>('');
  const [publishProgress, setPublishProgress] = useState<number>(0);
  const [publishError, setPublishError] = useState<string | null>(null);

  // Load applications list
  useEffect(() => {
    const q = query(collection(db, 'apps'), orderBy('name', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items: AppItem[] = [];
      snapshot.forEach((d) => items.push({ ...(d.data() as AppItem), id: d.id }));
      setApps(items);
      if (!selectedAppId && items.length > 0) {
        setSelectedAppId(items[0].id);
        setTargetAppId(items[0].id);
      }
    });

    return () => unsubscribe();
  }, []);

  // Load versions for selected application
  useEffect(() => {
    if (!selectedAppId) return;

    setLoadingVersions(true);
    const vQuery = query(collection(db, 'apps', selectedAppId, 'versions'), orderBy('versionCode', 'desc'));
    const unsubscribe = onSnapshot(vQuery, (snapshot) => {
      const vItems: AppVersion[] = [];
      snapshot.forEach((d) => vItems.push({ ...(d.data() as AppVersion), id: d.id, appId: selectedAppId }));
      setVersions(vItems);
      setLoadingVersions(false);
    }, (err) => {
      console.error('Error fetching versions:', err);
      setLoadingVersions(false);
    });

    return () => unsubscribe();
  }, [selectedAppId]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.name.toLowerCase().endsWith('.apk')) {
        alert('Please select an APK file (.apk extension).');
        return;
      }
      setApkFile(file);
    }
  };

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    setPublishError(null);

    if (!targetAppId) {
      setPublishError('Please select a target application.');
      return;
    }
    if (!versionName.trim() || !versionCode.trim() || !releaseTag.trim()) {
      setPublishError('Version Name, Version Code, and Release Tag are required.');
      return;
    }

    const cleanTag = releaseTag.trim();
    if (/\s/.test(cleanTag) || !/^[a-zA-Z0-9._-]+$/.test(cleanTag)) {
      setPublishError('Release tag must not contain spaces or special characters (allowed: a-z, A-Z, 0-9, ., _, -). Example: v1.6.0');
      return;
    }

    if (!apkFile) {
      setPublishError('Please select a valid .apk file to upload.');
      return;
    }
    if (!idToken) {
      setPublishError('Authentication token missing. Please sign in again.');
      return;
    }

    setIsPublishing(true);
    setUploadStep('Preparing APK payload and verifying administrator privileges...');
    setPublishProgress(15);

    try {
      const selectedApp = apps.find((a) => a.id === targetAppId);

      const formData = new FormData();
      formData.append('appId', targetAppId);
      formData.append('versionName', versionName.trim());
      formData.append('versionCode', versionCode.trim());
      formData.append('releaseTag', releaseTag.trim());
      formData.append('releaseNotes', releaseNotes.trim());
      formData.append('minAndroidVersion', minAndroidVersion);
      formData.append('apk', apkFile);

      if (selectedApp?.githubOwner) {
        formData.append('githubOwner', selectedApp.githubOwner);
      }
      if (selectedApp?.githubRepository) {
        formData.append('githubRepository', selectedApp.githubRepository);
      }

      setUploadStep('Uploading APK to server & communicating with GitHub API...');
      setPublishProgress(45);

      const res = await fetch('/api/releases/publish', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${idToken}`
        },
        body: formData
      });

      setPublishProgress(80);
      setUploadStep('Creating GitHub Release & updating Firestore version catalog...');

      const result: PublishReleaseResponse = await res.json();

      if (!res.ok || !result.success) {
        throw new Error('error' in result ? result.error : 'Failed to publish APK release.');
      }

      setPublishProgress(100);
      setUploadStep('✓ Version successfully published to GitHub Releases & Firestore!');

      const successDetails: ToastDetail[] = [
        { label: 'App', value: selectedApp?.name || targetAppId },
        { label: 'Version', value: versionName.trim() },
        { label: 'Release tag', value: releaseTag.trim() },
        {
          label: 'Release',
          value: result.releaseUrl || 'Not returned by GitHub',
          href: result.releaseUrl || undefined
        },
        { label: 'APK asset', value: result.apkUrl, href: result.apkUrl }
      ];

      pushToast({
        variant: 'success',
        title: 'Version published successfully',
        message: result.message,
        details: successDetails
      });

      // Reset form
      setTimeout(() => {
        setIsPublishing(false);
        setShowPublishModal(false);
        setVersionName('');
        setVersionCode('');
        setReleaseTag('');
        setReleaseNotes('');
        setApkFile(null);
        setPublishProgress(0);
        setUploadStep('');
      }, 2000);

    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'An error occurred during release publishing.';
      console.error('Publish error:', err);
      setPublishError(message);
      pushToast({
        variant: 'error',
        title: 'Failed to publish version',
        message
      });
      setIsPublishing(false);
    }
  };

  const selectedAppObj = apps.find((a) => a.id === selectedAppId);

  return (
    <AdminGuard>
      <header className="top-header">
        <h1 className="header-title">Releases & GitHub APK Hosting</h1>
        <button
          onClick={() => {
            setTargetAppId(selectedAppId || (apps[0]?.id || ''));
            setShowPublishModal(true);
          }}
          className="btn btn-primary"
        >
          <span>🚀</span> Publish New Version
        </button>
      </header>

      <div className="content-body">
        {/* App Selector Banner */}
        <div style={{
          backgroundColor: 'var(--bg-surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          padding: '20px 24px',
          marginBottom: '24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '20px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <label className="form-label" style={{ marginBottom: 0, whiteSpace: 'nowrap' }}>
              Select Application:
            </label>
            <select
              className="form-select"
              value={selectedAppId}
              onChange={(e) => setSelectedAppId(e.target.value)}
              style={{ minWidth: '240px' }}
            >
              {apps.map((app) => (
                <option key={app.id} value={app.id}>
                  {app.name} ({app.packageName})
                </option>
              ))}
            </select>
          </div>

          {selectedAppObj && (
            <div style={{ display: 'flex', gap: '20px', fontSize: '13px', color: 'var(--text-muted)' }}>
              <div>
                GitHub Repo: <strong style={{ color: 'var(--text-main)', fontFamily: 'var(--font-mono)' }}>
                  {selectedAppObj.githubOwner ? `${selectedAppObj.githubOwner}/${selectedAppObj.githubRepository}` : '(Default Environment Repo)'}
                </strong>
              </div>
              <div>
                Latest Version: <strong style={{ color: 'var(--primary)', fontFamily: 'var(--font-mono)' }}>
                  v{selectedAppObj.latestVersionName || '1.0.0'} ({selectedAppObj.latestVersionCode || 1})
                </strong>
              </div>
            </div>
          )}
        </div>

        {/* Versions Table */}
        <div className="table-container">
          {loadingVersions ? (
            <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>
              Loading versions for selected app...
            </div>
          ) : versions.length === 0 ? (
            <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>
              No releases published for this application yet.<br />
              Click &quot;Publish New Version&quot; above to select an APK from your desktop and publish it directly to GitHub Releases.
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Release Tag</th>
                  <th>Version</th>
                  <th>Version Code</th>
                  <th>Size</th>
                  <th>Release Notes</th>
                  <th>Status</th>
                  <th>GitHub Release Asset</th>
                </tr>
              </thead>
              <tbody>
                {versions.map((ver) => (
                  <tr key={ver.id}>
                    <td>
                      <span className="badge badge-published" style={{ fontFamily: 'var(--font-mono)' }}>
                        {ver.releaseTag || `v${ver.versionName}`}
                      </span>
                    </td>
                    <td style={{ fontWeight: 600 }}>{ver.versionName}</td>
                    <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                      {ver.versionCode}
                    </td>
                    <td style={{ color: 'var(--text-muted)' }}>
                      {ver.apkSize > 0 ? `${(ver.apkSize / (1024 * 1024)).toFixed(1)} MB` : '—'}
                    </td>
                    <td style={{ maxWidth: '280px', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', color: 'var(--text-muted)' }}>
                      {ver.releaseNotes || ver.changelog || 'No notes provided'}
                    </td>
                    <td>
                      <span className="badge badge-published">● Published</span>
                    </td>
                    <td>
                      {ver.apkUrl ? (
                        <a
                          href={ver.apkUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="btn btn-secondary"
                          style={{ padding: '6px 12px', fontSize: '12px' }}
                        >
                          ⬇ Download APK ↗
                        </a>
                      ) : (
                        <span style={{ color: 'var(--text-subtle)', fontSize: '12px' }}>No APK URL</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Publish Modal */}
        {showPublishModal && (
          <div className="modal-overlay" onClick={() => !isPublishing && setShowPublishModal(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h2 style={{ fontSize: '20px', fontWeight: 800 }}>Publish New APK Release</h2>
                {!isPublishing && (
                  <button
                    onClick={() => setShowPublishModal(false)}
                    style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '20px', cursor: 'pointer' }}
                  >
                    ✕
                  </button>
                )}
              </div>

              {publishError && (
                <div style={{
                  backgroundColor: 'rgba(239, 68, 68, 0.12)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  borderRadius: 'var(--radius-md)',
                  padding: '12px 16px',
                  color: 'var(--danger)',
                  fontSize: '13px',
                  marginBottom: '16px'
                }}>
                  {publishError}
                </div>
              )}

              <form onSubmit={handlePublish}>
                <div className="form-group">
                  <label className="form-label">Application *</label>
                  <select
                    className="form-select"
                    value={targetAppId}
                    onChange={(e) => setTargetAppId(e.target.value)}
                    disabled={isPublishing}
                    required
                  >
                    {apps.map((app) => (
                      <option key={app.id} value={app.id}>
                        {app.name} ({app.packageName})
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div className="form-group">
                    <label className="form-label">Version Name *</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. 1.2.0"
                      value={versionName}
                      onChange={(e) => {
                        const val = e.target.value;
                        const oldVal = versionName;
                        setVersionName(val);
                        // Auto-fill or sync release tag if it was empty or mirrored the old version name
                        if (!releaseTag || releaseTag === `v${oldVal.trim()}`) {
                          setReleaseTag(val ? `v${val.trim()}` : '');
                        }
                      }}
                      disabled={isPublishing}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Version Code *</label>
                    <input
                      type="number"
                      className="form-input"
                      placeholder="e.g. 3"
                      value={versionCode}
                      onChange={(e) => setVersionCode(e.target.value)}
                      disabled={isPublishing}
                      required
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div className="form-group">
                    <label className="form-label">Release Tag *</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. v1.2.0"
                      value={releaseTag}
                      onChange={(e) => setReleaseTag(e.target.value.replace(/\s+/g, ''))}
                      disabled={isPublishing}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Min Android SDK</label>
                    <input
                      type="number"
                      className="form-input"
                      value={minAndroidVersion}
                      onChange={(e) => setMinAndroidVersion(e.target.value)}
                      disabled={isPublishing}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Release Notes</label>
                  <textarea
                    className="form-textarea"
                    placeholder="Describe fixes, updates, and new features included in this APK build..."
                    value={releaseNotes}
                    onChange={(e) => setReleaseNotes(e.target.value)}
                    disabled={isPublishing}
                    rows={3}
                  />
                </div>

                {/* APK File Selector */}
                <div className="form-group">
                  <label className="form-label">APK Binary File *</label>
                  <input
                    type="file"
                    id="apk-picker"
                    accept=".apk,application/vnd.android.package-archive"
                    onChange={handleFileChange}
                    style={{ display: 'none' }}
                    disabled={isPublishing}
                  />
                  <label htmlFor="apk-picker" className="dropzone" style={{ padding: '20px' }}>
                    <span style={{ fontSize: '28px' }}>📦</span>
                    <span style={{ fontWeight: 600 }}>
                      {apkFile ? apkFile.name : 'Click to Select APK File from Desktop'}
                    </span>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                      {apkFile ? `${(apkFile.size / (1024 * 1024)).toFixed(2)} MB` : 'Must be a compiled Android .apk file'}
                    </span>
                  </label>
                </div>

                {/* Progress bar during publishing */}
                {isPublishing && (
                  <div style={{ margin: '20px 0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '6px' }}>
                      <span style={{ color: 'var(--primary)', fontWeight: 600 }}>{uploadStep}</span>
                      <span style={{ color: 'var(--text-muted)' }}>{publishProgress}%</span>
                    </div>
                    <div className="progress-container">
                      <div className="progress-bar" style={{ width: `${publishProgress}%` }} />
                    </div>
                  </div>
                )}

                <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '24px' }}>
                  <button
                    type="button"
                    onClick={() => setShowPublishModal(false)}
                    className="btn btn-secondary"
                    disabled={isPublishing}
                  >
                    Cancel
                  </button>
                    <button
                      type="submit"
                      className="btn btn-primary"
                      disabled={isPublishing || !apkFile}
                    >
                      {isPublishing ? 'Publishing to GitHub...' : 'Publish Version'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>

        {/* Publish result notifications (success auto-dismisses, errors stay until dismissed) */}
        <ToastViewport toasts={toasts} onDismiss={dismissToast} />
      </AdminGuard>
    );
  }

  export default function ReleasesPage() {
    return (
      <Suspense fallback={
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'var(--bg-primary)',
          color: 'var(--text-muted)'
        }}>
          Loading releases...
        </div>
      }>
        <ReleasesContent />
      </Suspense>
    );
  }
