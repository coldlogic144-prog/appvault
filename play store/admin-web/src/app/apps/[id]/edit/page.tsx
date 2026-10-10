'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { AppItem } from '@/lib/types';
import AdminGuard from '@/components/AdminGuard';
import AppForm from '@/components/AppForm';

export default function EditAppPage() {
  const params = useParams();
  const appId = params.id as string;
  const [app, setApp] = useState<AppItem | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!appId) return;

    const fetchApp = async () => {
      try {
        const docSnap = await getDoc(doc(db, 'apps', appId));
        if (docSnap.exists()) {
          setApp({ ...(docSnap.data() as AppItem), id: docSnap.id });
        }
      } catch (err) {
        console.error('Failed to fetch app:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchApp();
  }, [appId]);

  return (
    <AdminGuard>
      <header className="top-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Link href="/apps" style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
            ← Applications
          </Link>
          <span style={{ color: 'var(--border)' }}>/</span>
          <h1 className="header-title">Edit Application</h1>
        </div>
      </header>

      <div className="content-body">
        {loading ? (
          <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>
            Loading application data...
          </div>
        ) : !app ? (
          <div style={{ padding: '60px', textAlign: 'center', color: 'var(--danger)' }}>
            Application not found in Firestore.
          </div>
        ) : (
          <AppForm initialApp={app} isEdit={true} />
        )}
      </div>
    </AdminGuard>
  );
}
