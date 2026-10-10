'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';

export type ToastVariant = 'success' | 'error';

/** Key/value row rendered inside a toast (e.g. app name, release tag, asset URL). */
export interface ToastDetail {
  label: string;
  value: string;
  /** When set, the value is rendered as an external link. */
  href?: string;
}

export interface ToastOptions {
  variant: ToastVariant;
  title: string;
  message?: string;
  details?: ToastDetail[];
  /**
   * Milliseconds before the toast dismisses itself.
   * Defaults per variant: success auto-dismisses, errors stay until dismissed.
   */
  autoDismissMs?: number;
}

export interface ToastMessage extends ToastOptions {
  id: number;
}

interface ToastProps extends ToastMessage {
  onDismiss: (id: number) => void;
}

export interface ToastController {
  toasts: ToastMessage[];
  pushToast: (options: ToastOptions) => number;
  dismissToast: (id: number) => void;
}

const MAX_VISIBLE_TOASTS = 4;

const DEFAULT_AUTO_DISMISS_MS: Record<ToastVariant, number> = {
  success: 6000,
  error: 0
};

const VARIANT_PALETTE: Record<ToastVariant, { accent: string; tint: string; icon: string; heading: string }> = {
  success: {
    accent: 'var(--success)',
    tint: 'rgba(16, 185, 129, 0.14)',
    icon: '✓',
    heading: 'Success'
  },
  error: {
    accent: 'var(--danger)',
    tint: 'rgba(239, 68, 68, 0.14)',
    icon: '✕',
    heading: 'Error'
  }
};

export function Toast({ id, variant, title, message, details, autoDismissMs, onDismiss }: ToastProps) {
  const palette = VARIANT_PALETTE[variant];
  const dismissAfter = autoDismissMs ?? DEFAULT_AUTO_DISMISS_MS[variant];
  const isError = variant === 'error';

  useEffect(() => {
    if (dismissAfter <= 0) return;
    const timer = window.setTimeout(() => onDismiss(id), dismissAfter);
    return () => window.clearTimeout(timer);
  }, [dismissAfter, id, onDismiss]);

  return (
    <div
      role={isError ? 'alert' : 'status'}
      aria-live={isError ? 'assertive' : 'polite'}
      className="toast-card"
      style={{
        pointerEvents: 'auto',
        display: 'flex',
        alignItems: 'flex-start',
        gap: '14px',
        width: '100%',
        backgroundColor: 'var(--bg-surface)',
        border: '1px solid var(--border)',
        borderLeft: `3px solid ${palette.accent}`,
        borderRadius: 'var(--radius-lg)',
        padding: '16px 18px',
        boxShadow: '0 18px 36px rgba(0, 0, 0, 0.45)'
      }}
    >
      <div
        aria-hidden
        style={{
          width: '30px',
          height: '30px',
          flexShrink: 0,
          borderRadius: '50%',
          backgroundColor: palette.tint,
          color: palette.accent,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '15px',
          fontWeight: 800
        }}
      >
        {palette.icon}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <span
          style={{
            display: 'block',
            fontSize: '11px',
            fontWeight: 700,
            letterSpacing: '0.5px',
            textTransform: 'uppercase',
            color: palette.accent
          }}
        >
          {palette.heading}
        </span>
        <p style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-main)', lineHeight: 1.4, marginTop: '4px' }}>
          {title}
        </p>

        {message && (
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.5, marginTop: '4px' }}>
            {message}
          </p>
        )}

        {details && details.length > 0 && (
          <dl style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {details.map((detail) => (
              <div
                key={detail.label}
                style={{ display: 'grid', gridTemplateColumns: '92px 1fr', gap: '8px', alignItems: 'baseline' }}
              >
                <dt
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    letterSpacing: '0.4px',
                    textTransform: 'uppercase',
                    color: 'var(--text-subtle)'
                  }}
                >
                  {detail.label}
                </dt>
                <dd
                  style={{
                    margin: 0,
                    fontSize: '12px',
                    color: 'var(--text-main)',
                    fontFamily: detail.href ? 'var(--font-mono)' : 'inherit',
                    overflowWrap: 'anywhere'
                  }}
                >
                  {detail.href ? (
                    <a
                      href={detail.href}
                      target="_blank"
                      rel="noreferrer"
                      style={{ color: 'var(--primary)', textDecoration: 'underline' }}
                    >
                      {detail.value}
                    </a>
                  ) : (
                    detail.value
                  )}
                </dd>
              </div>
            ))}
          </dl>
        )}
      </div>

      <button
        type="button"
        onClick={() => onDismiss(id)}
        aria-label="Dismiss notification"
        title="Dismiss"
        style={{
          flexShrink: 0,
          background: 'none',
          border: 'none',
          color: 'var(--text-muted)',
          fontSize: '18px',
          lineHeight: 1,
          cursor: 'pointer',
          padding: 0
        }}
      >
        ✕
      </button>

      <style jsx>{`
        .toast-card {
          animation: toast-in 0.22s ease-out;
        }
        @keyframes toast-in {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}

export function ToastViewport({ toasts, onDismiss }: { toasts: ToastMessage[]; onDismiss: (id: number) => void }) {
  if (toasts.length === 0) return null;

  return (
    <div
      style={{
        position: 'fixed',
        right: '24px',
        bottom: '24px',
        zIndex: 1100,
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        width: 'min(400px, calc(100vw - 32px))',
        pointerEvents: 'none'
      }}
    >
      {toasts.map((toast) => (
        <Toast key={toast.id} {...toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

/** Minimal toast queue: push notifications from any client component. */
export function useToasts(): ToastController {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const nextIdRef = useRef(0);

  const dismissToast = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const pushToast = useCallback((options: ToastOptions) => {
    nextIdRef.current += 1;
    const id = nextIdRef.current;
    setToasts((current) => [...current, { ...options, id }].slice(-MAX_VISIBLE_TOASTS));
    return id;
  }, []);

  return { toasts, pushToast, dismissToast };
}
