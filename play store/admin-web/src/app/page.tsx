'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { collection, onSnapshot, query, orderBy, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { AppItem, AppVersion, AdminStats } from '@/lib/types';
import AdminGuard from '@/components/AdminGuard';

export default function DashboardPage() {
  const [apps, setApps] = useState<AppItem[]>([]);
  const [stats, setStats] = useState<AdminStats>({
    totalApps: 0,
    publishedApps: 0,
    draftApps: 0,
    totalDownloads: 0,
    totalVersions: 0
  });
  const [recentReleases, setRecentReleases] = useState<{ app: AppItem; version: AppVersion }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. Subscribe to Applications
    const q = query(collection(db, 'apps'), orderBy('updatedAt', 'desc'));
    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const items: AppItem[] = [];
      let pubCount = 0;
      let draftCount = 0;
      let downloads = 0;

      snapshot.forEach((doc) => {
        const data = doc.data() as AppItem;
        const appItem: AppItem = { ...data, id: doc.id };
        items.push(appItem);

        if (appItem.published) pubCount++;
        else draftCount++;

        downloads += appItem.downloadCount || 0;
      });

      setApps(items);

      // 2. Fetch recent versions across apps
      let versionCount = 0;
      const recentList: { app: AppItem; version: AppVersion }[] = [];

      for (const app of items.slice(0, 10)) {
        try {
          const versionsSnap = await getDocs(
            query(collection(db, 'apps', app.id, 'versions'), orderBy('versionCode', 'desc'))
          );
          versionCount += versionsSnap.size;
          versionsSnap.forEach((vDoc) => {
            const vData = vDoc.data() as AppVersion;
            if (recentList.length < 5) {
              recentList.push({
                app,
                version: { ...vData, id: vDoc.id, appId: app.id }
              });
            }
          });
        } catch (e) {
          console.warn(`Could not load versions for ${app.id}`, e);
        }
      }

      setStats({
        totalApps: items.length,
        publishedApps: pubCount,
        draftApps: draftCount,
        totalDownloads: downloads,
        totalVersions: versionCount
      });
      setRecentReleases(recentList);
      setLoading(false);
    }, (err) => {
      console.error('Error listening to apps:', err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return (
    <AdminGuard>
      <header className="top-header">
        <h1 className="header-title">Dashboard Overview</h1>
        <div style={{ display: 'flex', gap: '12px' }}>
          <Link href="/apps/create" className="btn btn-primary">
            <span>➕</span> Create Application
          </Link>
          <Link href="/releases" className="btn btn-secondary">
            <span>🚀</span> Publish Release
          </Link>
        </div>
      </header>

      <div className="content-body">
        {/* Metric Cards */}
        <div className="stats-grid">
          <div className="stat-card">
            <span className="stat-label">Total Applications</span>
            <div className="stat-value">{stats.totalApps}</div>
            <span className="stat-meta">In AppVault Catalog</span>
          </div>

          <div className="stat-card">
            <span className="stat-label">Published Apps</span>
            <div className="stat-value" style={{ color: 'var(--success)' }}>
              {stats.publishedApps}
            </div>
            <span className="stat-meta">Live for Android clients</span>
          </div>

          <div className="stat-card">
            <span className="stat-label">Draft Apps</span>
            <div className="stat-value" style={{ color: 'var(--warning)' }}>
              {stats.draftApps}
            </div>
            <span className="stat-meta">Internal / Admin only</span>
          </div>

          <div className="stat-card">
            <span className="stat-label">Total Downloads</span>
            <div className="stat-value" style={{ color: 'var(--info)' }}>
              {stats.totalDownloads.toLocaleString()}
            </div>
            <span className="stat-meta">Across all releases</span>
          </div>
        </div>

        {/* Two Column Section */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px' }}>
          {/* Applications Table */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 700 }}>Applications</h2>
              <Link href="/apps" style={{ fontSize: '13px', color: 'var(--primary)', fontWeight: 600 }}>
                View All →
              </Link>
            </div>

            <div className="table-container">
              {apps.length === 0 ? (
                <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  {loading ? 'Loading catalog from Firestore...' : 'No applications found. Click "Create Application" to add your first app.'}
                </div>
              ) : (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>App</th>
                      <th>Category</th>
                      <th>Version</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {apps.slice(0, 6).map((app) => (
                      <tr key={app.id}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            {app.iconUrl ? (
                              <img
                                src={app.iconUrl}
                                alt={app.name}
                                style={{ width: '40px', height: '40px', borderRadius: '10px', objectFit: 'cover' }}
                              />
                            ) : (
                              <div style={{
                                width: '40px',
                                height: '40px',
                                borderRadius: '10px',
                                backgroundColor: 'var(--bg-surface-elevated)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '20px'
                              }}>
                                📱
                              </div>
                            )}
                            <div>
                              <div style={{ fontWeight: 700, fontSize: '14px' }}>{app.name}</div>
                              <div style={{ fontSize: '12px', color: 'var(--text-subtle)', fontFamily: 'var(--font-mono)' }}>
                                {app.packageName}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td style={{ textTransform: 'capitalize', color: 'var(--text-muted)' }}>
                          {app.categoryId || 'Other'}
                        </td>
                        <td>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', color: 'var(--text-main)' }}>
                            v{app.latestVersionName || '1.0.0'}
                          </span>
                        </td>
                        <td>
                          <span className={`badge ${app.published ? 'badge-published' : 'badge-draft'}`}>
                            {app.published ? '● Published' : '○ Draft'}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <Link href={`/apps/${app.id}/edit`} className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '12px' }}>
                              Edit
                            </Link>
                            <Link href={`/releases?appId=${app.id}`} className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '12px' }}>
                              Versions
                            </Link>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Recent Releases Sidebar */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 700 }}>Recent Releases</h2>
              <Link href="/releases" style={{ fontSize: '13px', color: 'var(--primary)', fontWeight: 600 }}>
                Manage →
              </Link>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {recentReleases.length === 0 ? (
                <div style={{
                  padding: '30px',
                  backgroundColor: 'var(--bg-surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-lg)',
                  textAlign: 'center',
                  color: 'var(--text-muted)',
                  fontSize: '13px'
                }}>
                  No published APK releases yet.
                </div>
              ) : (
                recentReleases.map(({ app, version }) => (
                  <div
                    key={version.id}
                    style={{
                      padding: '16px',
                      backgroundColor: 'var(--bg-surface)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-lg)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 700, fontSize: '14px' }}>{app.name}</span>
                      <span className="badge badge-published" style={{ fontSize: '11px', padding: '2px 8px' }}>
                        {version.releaseTag || `v${version.versionName}`}
                      </span>
                    </div>

                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                      Code: {version.versionCode} • {(version.apkSize / (1024 * 1024)).toFixed(1)} MB
                    </div>

                    {version.apkUrl && (
                      <a
                        href={version.apkUrl}
                        target="_blank"
                        rel="noreferrer"
                        style={{
                          fontSize: '12px',
                          color: 'var(--primary)',
                          fontWeight: 600,
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          marginTop: '4px'
                        }}
                      >
                        ⬇ Download GitHub Release APK ↗
                      </a>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </AdminGuard>
  );
}
