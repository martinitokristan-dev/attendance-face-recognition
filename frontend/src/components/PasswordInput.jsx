import React, { useState } from 'react';
import { Eye, EyeOff, Check, X } from 'lucide-react';
import { checkPasswordCriteria } from '../utils/validation';

export default function PasswordInput({
  value = '',
  onChange,
  placeholder = 'Enter password',
  name = 'password',
  id,
  required = false,
  showStrength = true,
  disabled = false,
  autoComplete = 'current-password',
  floatingLabel,
  style = {},
}) {
  const [showPassword, setShowPassword] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  const { criteria, label, isStrong } = checkPasswordCriteria(value);

  // Show indicator checklist if showStrength is enabled and user has focused or typed
  const displayIndicator = showStrength && (value.length > 0 || isFocused);

  return (
    <div style={{ width: '100%', ...style }}>
      {/* Password Input with Show/Hide toggle */}
      {floatingLabel ? (
        <div className="floating-field">
          <input
            type={showPassword ? 'text' : 'password'}
            id={id || name}
            name={name}
            className="floating-input"
            placeholder=" "
            value={value}
            onChange={onChange}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            required={required}
            disabled={disabled}
            autoComplete={autoComplete}
            style={{ paddingRight: '42px' }}
          />
          <label htmlFor={id || name} className="floating-label">
            {floatingLabel} {required && <span style={{ color: '#dc2626' }}>*</span>}
          </label>
          <button
            type="button"
            className="floating-adornment-btn"
            onClick={() => setShowPassword((prev) => !prev)}
            tabIndex={-1}
            title={showPassword ? 'Hide password' : 'Show password'}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
      ) : (
        <div style={{ position: 'relative', width: '100%' }}>
          <input
            type={showPassword ? 'text' : 'password'}
            id={id || name}
            name={name}
            className="form-control"
            placeholder={placeholder}
            value={value}
            onChange={onChange}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            required={required}
            disabled={disabled}
            autoComplete={autoComplete}
            style={{
              width: '100%',
              paddingRight: '40px',
              transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
            }}
          />
          <button
            type="button"
            onClick={() => setShowPassword((prev) => !prev)}
            tabIndex={-1}
            style={{
              position: 'absolute',
              right: '8px',
              top: '50%',
              transform: 'translateY(-50%)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '6px',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-muted)',
              borderRadius: '4px',
              outline: 'none',
              transition: 'color 0.15s ease',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-primary)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; }}
            title={showPassword ? 'Hide password' : 'Show password'}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
      )}

      {/* Password Validation Criteria Checklist (Subtle & Compact, No Progress Bar) */}
      {displayIndicator && (
        <div style={{ marginTop: '6px' }}>
          {/* Validation Header */}
          <div
            style={{
              fontSize: '11px',
              fontWeight: '600',
              color: 'var(--text-secondary)',
              marginBottom: '4px',
            }}
          >
            {isStrong ? 'Strong password. All criteria met:' : `${label} password. Must contain:`}
          </div>

          {/* 5 Validation Criteria Checklist (Compact Font Size) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
            {criteria.map((c) => (
              <div
                key={c.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '11px',
                  color: c.met ? '#16a34a' : 'var(--text-muted)',
                  fontWeight: c.met ? '600' : '400',
                  lineHeight: 1.25,
                  transition: 'color 0.15s ease',
                }}
              >
                {c.met ? (
                  <Check size={11} style={{ color: '#16a34a', strokeWidth: 2.6, flexShrink: 0 }} />
                ) : (
                  <X size={11} style={{ color: '#94a3b8', strokeWidth: 2, flexShrink: 0 }} />
                )}
                <span>{c.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
