import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';

/**
 * Reusable Floating Toast Notification Component
 * 
 * Props:
 * - message: string (The notification text)
 * - type: 'success' | 'error' | 'warning' | 'info' (default: 'success')
 * - title: optional title string
 * - duration: auto-close time in ms (default: 4000ms, set 0 to disable)
 * - onClose: callback when toast closes
 */
export default function Toast({
  message,
  type = 'success',
  title,
  duration = 4000,
  onClose,
}) {
  const [visible, setVisible] = useState(false);
  const [animatingOut, setAnimatingOut] = useState(false);

  useEffect(() => {
    if (message) {
      setVisible(true);
      setAnimatingOut(false);

      if (duration > 0) {
        const timer = setTimeout(() => {
          handleClose();
        }, duration);
        return () => clearTimeout(timer);
      }
    } else {
      setVisible(false);
    }
  }, [message, duration]);

  const handleClose = () => {
    setAnimatingOut(true);
    setTimeout(() => {
      setVisible(false);
      setAnimatingOut(false);
      if (onClose) onClose();
    }, 250);
  };

  if (!visible || !message) return null;

  const config = {
    success: {
      icon: CheckCircle2,
      color: '#10b981',
      bgLight: 'rgba(16, 185, 129, 0.12)',
      border: 'rgba(16, 185, 129, 0.3)',
      defaultTitle: 'Success',
    },
    error: {
      icon: AlertCircle,
      color: '#ef4444',
      bgLight: 'rgba(239, 68, 68, 0.12)',
      border: 'rgba(239, 68, 68, 0.3)',
      defaultTitle: 'Error',
    },
    warning: {
      icon: AlertTriangle,
      color: '#f59e0b',
      bgLight: 'rgba(245, 158, 11, 0.12)',
      border: 'rgba(245, 158, 11, 0.3)',
      defaultTitle: 'Notice',
    },
    info: {
      icon: Info,
      color: '#3b82f6',
      bgLight: 'rgba(59, 130, 246, 0.12)',
      border: 'rgba(59, 130, 246, 0.3)',
      defaultTitle: 'Information',
    },
  }[type] || config.success;

  const IconComponent = config.icon;

  const toastContent = (
    <div
      style={{
        position: 'fixed',
        top: '24px',
        right: '24px',
        zIndex: 99999,
        minWidth: '320px',
        maxWidth: '440px',
        background: 'var(--bg-card, #1e293b)',
        color: 'var(--text-primary, #f8fafc)',
        borderRadius: '12px',
        border: `1px solid ${config.border}`,
        boxShadow: '0 12px 28px -4px rgba(0, 0, 0, 0.45), 0 6px 12px -2px rgba(0, 0, 0, 0.25)',
        backdropFilter: 'blur(12px)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        animation: animatingOut
          ? 'toastSlideOut 0.25s cubic-bezier(0.4, 0, 0.2, 1) forwards'
          : 'toastSlideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', padding: '14px 16px', gap: '12px' }}>
        {/* Left Icon Badge */}
        <div
          style={{
            width: '32px',
            height: '32px',
            borderRadius: '8px',
            background: config.bgLight,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            marginTop: '1px',
          }}
        >
          <IconComponent size={18} style={{ color: config.color }} />
        </div>

        {/* Message body */}
        <div style={{ flex: 1, minWidth: 0, paddingRight: '4px' }}>
          <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '2px' }}>
            {title || config.defaultTitle}
          </div>
          <div style={{ fontSize: '12.5px', color: 'var(--text-secondary, #94a3b8)', lineHeight: 1.45, wordBreak: 'break-word' }}>
            {message}
          </div>
        </div>

        {/* Dismiss Button */}
        <button
          type="button"
          onClick={handleClose}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-muted, #64748b)',
            cursor: 'pointer',
            padding: '4px',
            borderRadius: '6px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            transition: 'color 0.15s, background 0.15s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = 'var(--text-primary)';
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = 'var(--text-muted)';
            e.currentTarget.style.background = 'none';
          }}
          title="Dismiss"
        >
          <X size={15} />
        </button>
      </div>

      {/* Countdown progress bar */}
      {duration > 0 && (
        <div
          style={{
            height: '3px',
            width: '100%',
            background: 'rgba(255, 255, 255, 0.08)',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              height: '100%',
              background: config.color,
              animation: `toastProgress ${duration}ms linear forwards`,
            }}
          />
        </div>
      )}

      <style>{`
        @keyframes toastSlideIn {
          from {
            opacity: 0;
            transform: translateY(-20px) scale(0.95);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        @keyframes toastSlideOut {
          from {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
          to {
            opacity: 0;
            transform: translateY(-16px) scale(0.95);
          }
        }
        @keyframes toastProgress {
          from {
            width: 100%;
          }
          to {
            width: 0%;
          }
        }
      `}</style>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(toastContent, document.body) : toastContent;
}
