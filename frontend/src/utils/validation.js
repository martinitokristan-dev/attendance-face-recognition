/**
 * Validation utilities for Philippine phone numbers and password strength.
 */

/**
 * Strips all non-digit characters and truncates to maximum 11 digits.
 */
export function cleanPhPhoneNumber(value) {
  if (!value) return '';
  return String(value).replace(/\D/g, '').slice(0, 11);
}

/**
 * Validates whether a phone number matches the 11-digit Philippine mobile format (09XXXXXXXXX).
 */
export function isValidPhPhoneNumber(phone) {
  if (!phone) return false;
  const digits = String(phone).replace(/\D/g, '');
  return /^09\d{9}$/.test(digits);
}

/**
 * Returns a human-friendly error message if invalid, or null if valid.
 */
export function getPhPhoneValidationMessage(phone, required = false) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) {
    return required ? 'Phone number is required.' : null;
  }
  if (!digits.startsWith('09')) {
    return 'Philippine mobile numbers must start with 09 (e.g. 09123456789).';
  }
  if (digits.length !== 11) {
    return `Phone number must be exactly 11 digits (${digits.length}/11 entered).`;
  }
  return null;
}

/**
 * Evaluates password against 5 security criteria:
 * 1. At least 8 characters
 * 2. At least 1 number
 * 3. At least 1 lowercase letter
 * 4. At least 1 uppercase letter
 * 5. At least 1 special character
 */
export function checkPasswordCriteria(password = '') {
  const p = String(password || '');
  const criteria = [
    { id: 'length', label: 'At least 8 characters', met: p.length >= 8 },
    { id: 'number', label: 'At least 1 number', met: /\d/.test(p) },
    { id: 'lowercase', label: 'At least 1 lowercase letter', met: /[a-z]/.test(p) },
    { id: 'uppercase', label: 'At least 1 uppercase letter', met: /[A-Z]/.test(p) },
    { id: 'special', label: 'At least 1 special character', met: /[!@#$%^&*(),.?":{}|<>_~`\-+=\\[\]]/.test(p) },
  ];

  const passedCount = criteria.filter((c) => c.met).length;
  const isStrong = passedCount === 5;
  const isMedium = passedCount >= 3 && passedCount < 5;
  const isWeak = passedCount < 3;
  const label = isStrong ? 'Strong' : isMedium ? 'Medium' : 'Weak';

  return {
    criteria,
    passedCount,
    isStrong,
    isMedium,
    isWeak,
    label,
    isValid: isStrong,
  };
}
