'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import Sidebar from './Sidebar';

export default function AdminGuard({ children }: { children: React.ReactNode }) {
  const { user, isAdmin, loading, signOut, refreshAdminStatus } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [loading, user, router]);

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--bg-primary)',
        gap: '16px'
      }}>
        <div style={{
          width: '40px',
          height: '40px',
          border: '3px solid var(--border)',
          borderTopColor: 'var(--primary)',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite'
        }} />
        <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Verifying Administrator Authorization...</p>
        <style jsx>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  if (!user) {
    return null; // Will redirect via useEffect
  }

  if (!isAdmin) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        backgroundColor: 'var(--bg-primary)'
      }}>
        <div style={{
          maxWidth: '480px',
          width: '100%',
          backgroundColor: 'var(--bg-surface)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          borderRadius: 'var(--radius-xl)',
          padding: '36px',
          textAlign: 'center',
          boxShadow: '0 20px 40px rgba(0,0,0,0.5)'
        }}>
          <div style={{
            width: '64px',
            height: '64px',
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 20px auto',
            fontSize: '28px'
          }}>
            🚫
          </div>
          <h2 style={{ fontSize: '22px', fontWeight: 800, marginBottom: '12px' }}>Access Denied</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', lineHeight: '1.6', marginBottom: '8px' }}>
            Account <strong style={{ color: 'var(--text-main)' }}>{user.email}</strong> is authenticated but does not possess administrator privileges.
          </p>
          <p style={{ color: 'var(--text-subtle)', fontSize: '13px', marginBottom: '24px' }}>
            Store administration requires a server-side custom claim (<code>admin: true</code>) or authorization record under <code>/admins/{user.uid}</code>.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <button
              onClick={() => refreshAdminStatus()}
              className="btn btn-primary"
              style={{ width: '100%' }}
            >
              🔄 Recheck Administrator Privileges
            </button>
            <button
              onClick={() => signOut()}
              className="btn btn-secondary"
              style={{ width: '100%' }}
            >
              Sign Out & Switch Account
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        {children}
      </main>
    </div>
  );
}
