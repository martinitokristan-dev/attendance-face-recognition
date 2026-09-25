import React, { useState, useEffect } from 'react';
import { User, Save, Info, Check, AlertCircle } from 'lucide-react';
import { Api } from '../api';
import Toast from '../components/Toast';
import PhoneInput from '../components/PhoneInput';
import { getPhPhoneValidationMessage } from '../utils/validation';

export default function ProfileView({ user, onUserUpdated, onSetHeaderInfo }) {
  const [formData, setFormData] = useState({
    first_name: user?.first_name || '',
    last_name: user?.last_name || '',
    email: user?.email || '',
    phone: user?.phone || '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (onSetHeaderInfo) {
      onSetHeaderInfo({
        title: 'My Profile',
        subtitle: 'Account settings and user information',
        headerActions: null,
      });
    }
  }, [onSetHeaderInfo]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (formData.phone) {
      const phoneErr = getPhPhoneValidationMessage(formData.phone);
      if (phoneErr) {
        setErrorMsg(phoneErr);
        return;
      }
    }
    try {
      setSubmitting(true);
      setErrorMsg('');
      const updated = await Api.updateProfile(formData);
      setSuccessMsg('Profile updated successfully!');
      if (onUserUpdated) onUserUpdated(updated);
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to update profile.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="page-content">
      <Toast message={successMsg} type="success" onClose={() => setSuccessMsg('')} />
      <Toast message={errorMsg} type="error" onClose={() => setErrorMsg('')} />

      <div className="grid-2" style={{ alignItems: 'start', gap: '24px' }}>
        {/* Left Card: Profile Settings */}
        <div className="card" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
          <div className="card-header" style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
            <span className="card-title" style={{ fontWeight: '700', fontSize: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <User size={18} style={{ color: 'var(--primary)' }} /> Profile Settings
            </span>
          </div>
          <div className="card-body" style={{ padding: '20px' }}>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label" style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '6px' }}>
                    First Name
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    value={formData.first_name}
                    onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '6px' }}>
                    Last Name
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    value={formData.last_name}
                    onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label" style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '6px' }}>
                  Email Address
                </label>
                <input
                  type="email"
                  className="form-control"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label" style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '6px' }}>
                  Phone Number
                </label>
                <PhoneInput
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="e.g. 09123456789"
                />
              </div>

              <button
                type="submit"
                className="btn btn-primary"
                disabled={submitting}
                style={{ alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: '6px', marginTop: '6px' }}
              >
                <Save size={16} />
                <span>{submitting ? 'Saving...' : 'Save Changes'}</span>
              </button>
            </form>
          </div>
        </div>

        {/* Right Card: Account Info */}
        <div className="card" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
          <div className="card-header" style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
            <span className="card-title" style={{ fontWeight: '700', fontSize: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Info size={18} style={{ color: 'var(--primary)' }} /> Account Info
            </span>
          </div>
          <div className="card-body" style={{ padding: '24px' }}>
            <div style={{ textAlign: 'center', marginBottom: '20px' }}>
              <div
                style={{
                  width: '80px',
                  height: '80px',
                  borderRadius: '50%',
                  background: 'var(--bg-secondary)',
                  color: 'var(--primary)',
                  fontSize: '28px',
                  fontWeight: '800',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 12px auto',
                  border: '2px solid var(--border)',
                }}
              >
                {(user?.first_name?.[0] || user?.username?.[0] || 'U').toUpperCase()}
              </div>
              <h3 style={{ margin: '0 0 4px 0', fontSize: '18px', fontWeight: '700' }}>
                {user?.first_name} {user?.last_name}
              </h3>
              <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-muted)' }}>
                {user?.email}
              </p>
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <tbody>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '10px 0', color: 'var(--text-muted)' }}>Username</td>
                  <td style={{ padding: '10px 0', fontWeight: '600', textAlign: 'right' }}>{user?.username}</td>
                </tr>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '10px 0', color: 'var(--text-muted)' }}>Role</td>
                  <td style={{ padding: '10px 0', textAlign: 'right' }}>
                    <span className="badge badge-accent" style={{ textTransform: 'capitalize' }}>
                      {user?.role}
                    </span>
                  </td>
                </tr>
                <tr>
                  <td style={{ padding: '10px 0', color: 'var(--text-muted)' }}>System Status</td>
                  <td style={{ padding: '10px 0', textAlign: 'right', color: 'var(--success)', fontWeight: '600' }}>
                    Active
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
