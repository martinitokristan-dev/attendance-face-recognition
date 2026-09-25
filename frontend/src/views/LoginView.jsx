import React, { useState } from 'react';
import { GraduationCap, Lock, AlertCircle, Loader2 } from 'lucide-react';
import { Api } from '../api';
import PasswordInput from '../components/PasswordInput';

export default function LoginView({ onLoginSuccess }) {
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('admin123');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username || !password) {
      setError('Please enter both username and password.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const { user } = await Api.login(username, password);
      onLoginSuccess(user);
    } catch (err) {
      setError(err.message || 'Login failed. Please check credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">
          <div className="login-logo-icon">
            <GraduationCap size={28} />
          </div>
          <h1>AttendFR</h1>
          <p>Facial Recognition Attendance System</p>
        </div>

        {error && (
          <div
            className="alert alert-danger"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '16px',
              padding: '10px 14px',
              fontSize: '13px',
            }}
          >
            <AlertCircle size={16} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} id="login-form">
          <div className="form-group">
            <div className="floating-field">
              <input
                type="text"
                id="id_username"
                className="floating-input"
                placeholder=" "
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoFocus
              />
              <label className="floating-label" htmlFor="id_username">
                Username or Student ID
              </label>
            </div>
          </div>

          <div className="form-group">
            <PasswordInput
              id="id_password"
              floatingLabel="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              showStrength={false}
              autoComplete="current-password"
            />
          </div>

          <button
            type="submit"
            id="btn-login"
            className="btn btn-primary w-full btn-lg"
            disabled={loading}
            style={{
              justifyContent: 'center',
              marginTop: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            {loading ? (
              <>
                <Loader2 size={18} className="spin" />
                <span>Signing In...</span>
              </>
            ) : (
              <>
                <Lock size={16} />
                <span>Sign In</span>
              </>
            )}
          </button>
        </form>

        <div style={{ marginTop: '20px', padding: '12px', background: 'var(--bg-primary)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', fontSize: '12px' }}>
          <div style={{ fontWeight: '600', color: 'var(--text-primary)', marginBottom: '4px' }}>Demo Admin Login:</div>
          <div style={{ color: 'var(--text-secondary)' }}>Username: <code>admin</code> &bull; Password: <code>admin123</code></div>
        </div>

        <p className="text-center mt-2" style={{ color: 'var(--text-muted)', fontSize: '12px', marginTop: '16px' }}>
          Attendance Face Recognition System &bull; TiDB Cloud Connected
        </p>
      </div>
    </div>
  );
}
