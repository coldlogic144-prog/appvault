'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { collection, onSnapshot, query, orderBy, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { AppItem } from '@/lib/types';
import AdminGuard from '@/components/AdminGuard';

export default function AppsPage() {
  const [apps, setApps] = useState<AppItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'apps'), orderBy('updatedAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items: AppItem[] = [];
      snapshot.forEach((d) => {
        items.push({ ...(d.data() as AppItem), id: d.id });
      });
      setApps(items);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const togglePublish = async (app: AppItem) => {
    try {
      const appRef = doc(db, 'apps', app.id);
      await updateDoc(appRef, {
        published: !app.published,
        updatedAt: new Date()
      });
    } catch (err: any) {
      alert(`Failed to update status: ${err.message}`);
    }
  };

  const handleDelete = async (app: AppItem) => {
    if (!confirm(`Are you sure you want to permanently delete "${app.name}" (${app.packageName})?`)) {
      return;
    }
    try {
      await deleteDoc(doc(db, 'apps', app.id));
    } catch (err: any) {
      alert(`Delete failed: ${err.message}`);
    }
  };

  const filteredApps = apps.filter((app) => {
    const matchesSearch = app.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      app.packageName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      app.developer.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || app.categoryId.toLowerCase() === categoryFilter.toLowerCase();
    return matchesSearch && matchesCategory;
  });

  return (
    <AdminGuard>
      <header className="top-header">
        <h1 className="header-title">Applications ({apps.length})</h1>
        <Link href="/apps/create" className="btn btn-primary">
          <span>➕</span> New Application
        </Link>
      </header>

      <div className="content-body">
        {/* Filters */}
        <div style={{
          display: 'flex',
          gap: '16px',
          marginBottom: '24px',
          alignItems: 'center'
        }}>
          <input
            type="text"
            className="form-input"
            placeholder="Search by name, package name, or developer..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ maxWidth: '400px', width: '100%' }}
          />

          <select
            className="form-select"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            style={{ width: '180px' }}
          >
            <option value="all">All Categories</option>
            <option value="education">Education</option>
            <option value="productivity">Productivity</option>
            <option value="utilities">Utilities</option>
            <option value="tools">Tools</option>
            <option value="entertainment">Entertainment</option>
            <option value="other">Other</option>
          </select>
        </div>

        {/* Apps Table */}
        <div className="table-container">
          {filteredApps.length === 0 ? (
            <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>
              {loading ? 'Loading applications from Firestore...' : 'No applications match your filter.'}
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Application</th>
                  <th>Category</th>
                  <th>Developer</th>
                  <th>Latest Version</th>
                  <th>Downloads</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredApps.map((app) => (
                  <tr key={app.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                        {app.iconUrl ? (
                          <img
                            src={app.iconUrl}
                            alt={app.name}
                            style={{ width: '44px', height: '44px', borderRadius: '12px', objectFit: 'cover' }}
                          />
                        ) : (
                          <div style={{
                            width: '44px',
                            height: '44px',
                            borderRadius: '12px',
                            backgroundColor: 'var(--bg-surface-elevated)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '22px'
                          }}>
                            📱
                          </div>
                        )}
                        <div>
                          <div style={{ fontWeight: 700, fontSize: '15px' }}>{app.name}</div>
                          <div style={{ fontSize: '12px', color: 'var(--text-subtle)', fontFamily: 'var(--font-mono)' }}>
                            {app.packageName}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td style={{ textTransform: 'capitalize', color: 'var(--text-muted)' }}>
                      {app.categoryId || 'Other'}
                    </td>
                    <td style={{ color: 'var(--text-muted)' }}>
                      {app.developer || '—'}
                    </td>
                    <td>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '13px' }}>
                        v{app.latestVersionName || '1.0.0'} ({app.latestVersionCode || 1})
                      </span>
                    </td>
                    <td style={{ color: 'var(--text-muted)' }}>
                      {(app.downloadCount || 0).toLocaleString()}
                    </td>
                    <td>
                      <button
                        onClick={() => togglePublish(app)}
                        className={`badge ${app.published ? 'badge-published' : 'badge-draft'}`}
                        style={{ cursor: 'pointer', border: 'none' }}
                        title="Click to toggle publish status"
                      >
                        {app.published ? '● Published' : '○ Draft'}
                      </button>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '8px' }}>
                        <Link href={`/apps/${app.id}/edit`} className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '12px' }}>
                          Edit
                        </Link>
                        <Link href={`/releases?appId=${app.id}`} className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '12px' }}>
                          Versions
                        </Link>
                        <button
                          onClick={() => handleDelete(app)}
                          className="btn btn-danger"
                          style={{ padding: '6px 10px', fontSize: '12px' }}
                          title="Delete App"
                        >
                          🗑️
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </AdminGuard>
  );
}
