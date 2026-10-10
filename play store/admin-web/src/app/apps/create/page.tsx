'use client';

import React from 'react';
import Link from 'next/link';
import AdminGuard from '@/components/AdminGuard';
import AppForm from '@/components/AppForm';

export default function CreateAppPage() {
  return (
    <AdminGuard>
      <header className="top-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Link href="/apps" style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
            ← Applications
          </Link>
          <span style={{ color: 'var(--border)' }}>/</span>
          <h1 className="header-title">Create Application</h1>
        </div>
      </header>

      <div className="content-body">
        <AppForm isEdit={false} />
      </div>
    </AdminGuard>
  );
}
