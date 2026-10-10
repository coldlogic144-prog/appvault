'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';

export default function Sidebar() {
  const pathname = usePathname();
  const { user, signOut } = useAuth();

  const navLinks = [
    { href: '/', label: 'Dashboard', icon: '📊' },
    { href: '/apps', label: 'Applications', icon: '📱' },
    { href: '/apps/create', label: 'Create App', icon: '➕' },
    { href: '/releases', label: 'Releases & APKs', icon: '🚀' },
    { href: '/settings', label: 'Settings', icon: '⚙️' },
  ];

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="brand-badge">A</div>
        <div className="brand-title">
          AppVault <span>Admin</span>
        </div>
      </div>

      <nav className="sidebar-nav">
        {navLinks.map((link) => {
          const isActive = pathname === link.href || (link.href !== '/' && pathname.startsWith(link.href));
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`nav-item ${isActive ? 'active' : ''}`}
            >
              <span style={{ fontSize: '16px' }}>{link.icon}</span>
              <span>{link.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="sidebar-footer">
        <div className="user-profile">
          <div className="user-info">
            <span className="user-email">{user?.email || 'Administrator'}</span>
            <span className="user-role">Verified Admin</span>
          </div>
          <button
            onClick={() => signOut()}
            className="btn btn-secondary"
            style={{ padding: '6px 10px', fontSize: '12px' }}
            title="Sign Out"
          >
            Logout
          </button>
        </div>
      </div>
    </aside>
  );
}
