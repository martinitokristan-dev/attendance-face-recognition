import React from 'react';
import { Check, AlertCircle } from 'lucide-react';
import { cleanPhPhoneNumber, isValidPhPhoneNumber } from '../utils/validation';

export default function PhoneInput({
  value = '',
  onChange,
  placeholder = 'e.g. 09123456789',
  name = 'phone',
  id,
  required = false,
  disabled = false,
  floatingLabel,
  style = {},
}) {
  const digits = String(value || '').replace(/\D/g, '');
  const isValid = isValidPhPhoneNumber(digits);
  const startsWith09 = digits.length === 0 || digits.startsWith('09');
  const isComplete = digits.length === 11;

  const handleChange = (e) => {
    // Only accept numeric characters and clamp to 11 digits
    const cleaned = cleanPhPhoneNumber(e.target.value);
    if (onChange) {
      onChange({
        ...e,
        target: {
          ...e.target,
          name: name,
          value: cleaned,
        },
      });
    }
  };

  // Determine helper message and styling
  let helperText = 'PH format: 11 digits starting with 09 (e.g. 09123456789)';
  let helperColor = 'var(--text-muted)';
  let icon = null;

  if (digits.length > 0) {
    if (!startsWith09) {
      helperText = 'Philippine mobile numbers must start with 09';
      helperColor = '#dc2626';
      icon = <AlertCircle size={11} style={{ color: '#dc2626', flexShrink: 0 }} />;
    } else if (!isComplete) {
      helperText = `Must be 11 digits (${digits.length}/11 digits entered)`;
      helperColor = 'var(--text-muted)';
    } else {
      helperText = 'Valid 11-digit Philippine mobile number';
      helperColor = '#16a34a';
      icon = <Check size={11} style={{ color: '#16a34a', strokeWidth: 2.5, flexShrink: 0 }} />;
    }
  }

  return (
    <div style={{ width: '100%', ...style }}>
      {floatingLabel ? (
        <div className="floating-field">
          <input
            type="tel"
            id={id || name}
            name={name}
            className="floating-input"
            placeholder=" "
            value={digits}
            onChange={handleChange}
            maxLength={11}
            required={required}
            disabled={disabled}
            autoComplete="tel"
            inputMode="numeric"
            pattern="09[0-9]{9}"
            style={{ paddingRight: isValid ? '36px' : '14px' }}
          />
          <label htmlFor={id || name} className="floating-label">
            {floatingLabel} {required && <span style={{ color: '#dc2626' }}>*</span>}
          </label>
          {isValid && (
            <div className="floating-adornment-icon" style={{ color: '#16a34a' }}>
              <Check size={16} style={{ strokeWidth: 2.5 }} />
            </div>
          )}
        </div>
      ) : (
        <div style={{ position: 'relative' }}>
          <input
            type="tel"
            id={id || name}
            name={name}
            className="form-control"
            placeholder={placeholder}
            value={digits}
            onChange={handleChange}
            maxLength={11}
            required={required}
            disabled={disabled}
            autoComplete="tel"
            inputMode="numeric"
            pattern="09[0-9]{9}"
            style={{
              width: '100%',
              paddingRight: isValid ? '32px' : '12px',
            }}
          />
          {isValid && (
            <div
              style={{
                position: 'absolute',
                right: '10px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: '#16a34a',
                display: 'flex',
                alignItems: 'center',
                pointerEvents: 'none',
              }}
            >
              <Check size={14} style={{ strokeWidth: 2.5 }} />
            </div>
          )}
        </div>
      )}

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          fontSize: '10.5px',
          color: helperColor,
          marginTop: '4px',
          lineHeight: 1.25,
          transition: 'color 0.15s ease',
        }}
      >
        {icon}
        <span>{helperText}</span>
      </div>
    </div>
  );
}
