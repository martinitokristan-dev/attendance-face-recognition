import React, { useState, useEffect } from 'react';
import {
  Users,
  Search,
  Plus,
  UserCheck,
  UserX,
  Shield,
  GraduationCap,
  UserPlus,
  X,
  Check,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Edit2,
  Trash2,
} from 'lucide-react';
import { Api, apiRequest } from '../api';
import ActionPopover from '../components/ActionPopover';
import Toast from '../components/Toast';
import PasswordInput from '../components/PasswordInput';
import PhoneInput from '../components/PhoneInput';
import { getPhPhoneValidationMessage, checkPasswordCriteria } from '../utils/validation';

export default function UsersView({ user, onNavigate, onSetHeaderInfo }) {
  const [users, setUsers] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [showAddModal, setShowAddModal] = useState(false);

  // Edit User State
  const [editingUser, setEditingUser] = useState(null);
  const [editFormData, setEditFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    is_active: true,
    department: '',
    specialization: '',
    employee_id: '',
    course: '',
    year_level: 1,
    student_id: '',
    password: '',
  });
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState('');

  // Form State
  const [formData, setFormData] = useState({
    username: '',
    role: 'teacher',
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    password: '',
    confirm_password: '',
    employee_id: '',
    department: '',
    specialization: '',
  });
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    loadUsers();
    loadPrograms();
  }, []);

  useEffect(() => {
    if (onSetHeaderInfo) {
      onSetHeaderInfo({
        title: 'Users',
        subtitle: 'System users, faculty, staff and students',
        headerActions: (
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => onNavigate && onNavigate('student_enrollment')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <UserPlus size={16} />
              <span>Enroll Student (FSUU)</span>
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setShowAddModal(true)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <Plus size={16} />
              <span>Add Staff/Teacher</span>
            </button>
          </div>
        ),
      });
    }
  }, [onSetHeaderInfo]);

  async function loadUsers() {
    try {
      setLoading(true);
      const data = await Api.getUsers();
      setUsers(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function loadPrograms() {
    try {
      const res = await apiRequest('/api/programs/');
      if (res.ok) {
        const data = await res.json();
        setPrograms(data);
      }
    } catch {
      // Fallback official programs if API is not yet loaded
      setPrograms([
        { id: 1, code: 'CITEC', name: 'College of Information, Technology, Entertainment, and Computing' },
        { id: 2, code: 'CCJE', name: 'College of Criminal Justice Education' },
        { id: 3, code: 'CTE', name: 'College of Teacher Education' },
        { id: 4, code: 'CoA', name: 'College of Accountancy' },
        { id: 5, code: 'CoN', name: 'College of Nursing' },
        { id: 6, code: 'CAS', name: 'College of Arts and Sciences' },
        { id: 7, code: 'CORE', name: 'College of Operations, Resources, and Entrepreneurship' },
        { id: 8, code: 'CEnTech', name: 'College of Engineering and Technology' },
        { id: 9, code: 'CIHT', name: 'College of Innovative Hospitality and Tourism' },
      ]);
    }
  }

  const handleCreateUser = async (e) => {
    e.preventDefault();
    if (!formData.username || !formData.first_name || !formData.last_name || !formData.email || !formData.password) {
      setFormError('Please fill in all required fields.');
      return;
    }

    if (formData.phone) {
      const phoneErr = getPhPhoneValidationMessage(formData.phone);
      if (phoneErr) {
        setFormError(phoneErr);
        return;
      }
    }

    const pwdCheck = checkPasswordCriteria(formData.password);
    if (!pwdCheck.isStrong) {
      const missing = pwdCheck.criteria.filter((c) => !c.met).map((c) => c.label).join(', ');
      setFormError(`Password does not meet requirements: ${missing}`);
      return;
    }

    if (formData.password !== formData.confirm_password) {
      setFormError('Passwords do not match.');
      return;
    }

    setFormLoading(true);
    setFormError('');

    try {
      await Api.createUser(formData);
      setSuccessMsg(`User ${formData.first_name} ${formData.last_name} (${formData.role}) created successfully!`);
      setShowAddModal(false);
      setFormData({
        username: '',
        role: 'teacher',
        first_name: '',
        last_name: '',
        email: '',
        phone: '',
        password: '',
        confirm_password: '',
        employee_id: '',
        department: '',
        specialization: '',
      });
      await loadUsers();
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      setFormError(err.message || 'Failed to create user');
    } finally {
      setFormLoading(false);
    }
  };

  const handleOpenEditModal = (u) => {
    setEditingUser(u);
    setEditError('');
    setEditFormData({
      first_name: u.first_name || '',
      last_name: u.last_name || '',
      email: u.email || '',
      phone: u.phone || '',
      is_active: u.is_active !== undefined ? Boolean(u.is_active) : true,
      department: u.teacher_profile?.department || '',
      specialization: u.teacher_profile?.specialization || '',
      employee_id: u.teacher_profile?.employee_id || '',
      course: u.student_profile?.course || '',
      year_level: u.student_profile?.year_level || 1,
      student_id: u.student_profile?.student_id || '',
      password: '',
    });
  };

  const handleUpdateUser = async (e) => {
    e.preventDefault();
    if (!editingUser) return;

    if (editFormData.phone) {
      const phoneErr = getPhPhoneValidationMessage(editFormData.phone);
      if (phoneErr) {
        setEditError(phoneErr);
        return;
      }
    }

    if (editFormData.password) {
      const pwdCheck = checkPasswordCriteria(editFormData.password);
      if (!pwdCheck.isStrong) {
        const missing = pwdCheck.criteria.filter((c) => !c.met).map((c) => c.label).join(', ');
        setEditError(`New password does not meet requirements: ${missing}`);
        return;
      }
    }

    try {
      setEditLoading(true);
      setEditError('');
      await Api.updateUser(editingUser.id, editFormData);
      setSuccessMsg(`User ${editingUser.username} updated successfully!`);
      setEditingUser(null);
      await loadUsers();
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      setEditError(err.message || 'Failed to update user.');
    } finally {
      setEditLoading(false);
    }
  };

  const handleDeleteUser = async (u) => {
    const displayName = u.first_name ? `${u.first_name} ${u.last_name || ''}`.trim() : u.username;
    if (!window.confirm(`Are you sure you want to permanently delete user "${displayName}" (@${u.username})?`)) return;
    try {
      await Api.deleteUser(u.id);
      setSuccessMsg(`User "${displayName}" deleted.`);
      await loadUsers();
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to delete user.');
    }
  };

  const handleToggleStatus = async (u, nextActive) => {
    const displayName = u.first_name ? `${u.first_name} ${u.last_name || ''}`.trim() : u.username;
    if (!nextActive && (u.id === user?.id || u.username === user?.username)) {
      setErrorMsg('You cannot deactivate your own administrative account.');
      setTimeout(() => setErrorMsg(''), 4000);
      return;
    }

    try {
      await Api.updateUser(u.id, { is_active: nextActive });
      setSuccessMsg(`User "${displayName}" (@${u.username}) is now ${nextActive ? 'Active' : 'Inactive'}.`);
      await loadUsers();
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to update user status.');
      setTimeout(() => setErrorMsg(''), 4000);
    }
  };

  const filteredUsers = users.filter((u) => {
    const q = search.toLowerCase();
    const matchesSearch =
      !q ||
      u.username?.toLowerCase().includes(q) ||
      u.first_name?.toLowerCase().includes(q) ||
      u.last_name?.toLowerCase().includes(q) ||
      u.email?.toLowerCase().includes(q);
    const matchesRole = roleFilter === 'all' || u.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  return (
    <div className="page-content">
      <Toast message={successMsg} type="success" onClose={() => setSuccessMsg('')} />
      <Toast message={errorMsg} type="error" onClose={() => setErrorMsg('')} />

      {/* Filter Tabs & Search Bar */}
      <div className="card" style={{ padding: '16px', border: '1px solid var(--border)', background: 'var(--bg-card)', borderRadius: 'var(--radius)', marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', gap: '6px' }}>
            {['all', 'admin', 'teacher', 'student'].map((r) => (
              <button
                key={r}
                type="button"
                className={`btn btn-sm ${roleFilter === r ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => setRoleFilter(r)}
                style={{ textTransform: 'capitalize', padding: '6px 12px' }}
              >
                {r === 'all' ? 'All Roles' : `${r}s`}
              </button>
            ))}
          </div>

          <div style={{ position: 'relative', width: '280px' }}>
            <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              className="form-control"
              placeholder="Search user by name, email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ paddingLeft: '34px', width: '100%' }}
            />
          </div>
        </div>
      </div>

      {/* Users Table */}
      <div className="card" style={{ border: '1px solid var(--border)', background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>User</th>
                <th>Role</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Profile Info</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                    No users match your filter.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => (
                  <tr key={u.id || u.username}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div className="user-avatar" style={{ width: '34px', height: '34px', borderRadius: '50%', background: 'var(--accent-light)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700', fontSize: '13px' }}>
                          {(u.first_name?.[0] || u.username?.[0] || 'U').toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontWeight: '600' }}>{u.first_name ? `${u.first_name} ${u.last_name || ''}` : u.username}</div>
                          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>@{u.username}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className={`badge ${u.role === 'admin' ? 'badge-danger' : u.role === 'teacher' ? 'badge-info' : 'badge-neutral'}`} style={{ textTransform: 'capitalize' }}>
                        {u.role}
                      </span>
                    </td>
                    <td>{u.email || '—'}</td>
                    <td>{u.phone || '—'}</td>
                    <td style={{ fontSize: '12.5px', color: 'var(--text-secondary)' }}>
                      {u.teacher_profile?.department || u.student_profile?.course || 'Standard Access'}
                    </td>
                    <td>
                      {u.is_active ? (
                        <button
                          type="button"
                          onClick={() => {
                            if (window.confirm(`Deactivate user "${u.first_name || u.username}"?`)) {
                              handleToggleStatus(u, false);
                            }
                          }}
                          className="badge badge-success"
                          title="Account is Active. Click to deactivate."
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            fontSize: '11px',
                            cursor: 'pointer',
                            border: '1px solid rgba(34, 197, 94, 0.35)',
                            background: 'rgba(34, 197, 94, 0.1)',
                            padding: '4px 9px',
                            borderRadius: '5px',
                            fontWeight: '600',
                            transition: 'all 0.15s ease',
                          }}
                        >
                          <CheckCircle2 size={11} /> Active
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleToggleStatus(u, true)}
                          className="badge badge-danger"
                          title="Account is Inactive. Click to activate."
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            fontSize: '11px',
                            cursor: 'pointer',
                            border: '1px solid rgba(239, 68, 68, 0.35)',
                            background: 'rgba(239, 68, 68, 0.1)',
                            padding: '4px 9px',
                            borderRadius: '5px',
                            fontWeight: '600',
                            transition: 'all 0.15s ease',
                          }}
                        >
                          <AlertCircle size={11} /> Inactive
                        </button>
                      )}
                    </td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <ActionPopover
                        items={(() => {
                          const isSelf = u.id === user?.id || u.username === user?.username;
                          const items = [
                            {
                              label: 'Edit User',
                              icon: Edit2,
                              onClick: () => handleOpenEditModal(u),
                            },
                          ];
                          if (u.is_active) {
                            if (!isSelf) {
                              items.push({
                                label: 'Deactivate Account',
                                icon: UserX,
                                isDanger: true,
                                onClick: () => {
                                  if (window.confirm(`Deactivate user "${u.first_name || u.username}"?`)) {
                                    handleToggleStatus(u, false);
                                  }
                                },
                              });
                            }
                          } else {
                            items.push({
                              label: 'Activate Account',
                              icon: UserCheck,
                              isSuccess: true,
                              onClick: () => handleToggleStatus(u, true),
                            });
                          }
                          if (!isSelf) {
                            items.push({ isDivider: true });
                            items.push({
                              label: 'Delete User',
                              icon: Trash2,
                              isDanger: true,
                              onClick: () => handleDeleteUser(u),
                            });
                          }
                          return items;
                        })()}
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ─── ADD STAFF / FACULTY MODAL (Exact Copycat with Department Dropdown) ─── */}
      {showAddModal && (
        <div className="modal-backdrop open" style={{ display: 'flex' }} onClick={(e) => { if (e.target === e.currentTarget) setShowAddModal(false); }}>
          <div className="modal-card" style={{ maxWidth: '640px', width: '100%', borderRadius: 'var(--radius-lg)', background: 'var(--bg-card)', border: '1px solid var(--border)', overflow: 'hidden', boxShadow: 'var(--shadow-lg)' }}>
            <div className="modal-header" style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Shield size={18} color="var(--accent)" />
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700' }}>Add Staff / Faculty Account</h3>
              </div>
              <button type="button" onClick={() => setShowAddModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateUser}>
              <div className="modal-body" style={{ padding: '20px', maxHeight: '70vh', overflowY: 'auto' }}>
                {formError && (
                  <div className="alert alert-danger" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px', fontSize: '13px' }}>
                    <AlertCircle size={15} />
                    <span>{formError}</span>
                  </div>
                )}

                <div className="grid-2" style={{ gap: '14px', marginBottom: '14px' }}>
                  <div className="form-group">
                    <label className="form-label">Username *</label>
                    <input
                      type="text"
                      className="form-control"
                      value={formData.username}
                      onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                      placeholder="e.g. jdoe"
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Role *</label>
                    <select
                      className="form-select"
                      value={formData.role}
                      onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    >
                      <option value="teacher">Teacher</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">First Name *</label>
                    <input
                      type="text"
                      className="form-control"
                      value={formData.first_name}
                      onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                      placeholder="First Name"
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Last Name *</label>
                    <input
                      type="text"
                      className="form-control"
                      value={formData.last_name}
                      onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                      placeholder="Last Name"
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Email *</label>
                    <input
                      type="email"
                      className="form-control"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="e.g. jdoe@attendfr.edu"
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Phone</label>
                    <PhoneInput
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      placeholder="e.g. 09123456789"
                    />
                  </div>

                  <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                    <label className="form-label">Password *</label>
                    <PasswordInput
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      placeholder="Create secure password"
                      required
                      showStrength={true}
                    />
                  </div>

                  <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                    <label className="form-label">Confirm Password *</label>
                    <PasswordInput
                      value={formData.confirm_password}
                      onChange={(e) => setFormData({ ...formData, confirm_password: e.target.value })}
                      placeholder="Confirm your password"
                      required
                      showStrength={false}
                    />
                    {formData.confirm_password && (
                      <div
                        style={{
                          marginTop: '6px',
                          fontSize: '11.5px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '5px',
                          color: formData.password === formData.confirm_password ? '#16a34a' : '#dc2626',
                          fontWeight: '600',
                        }}
                      >
                        {formData.password === formData.confirm_password ? (
                          <>
                            <Check size={13} style={{ strokeWidth: 2.5 }} />
                            <span>Passwords match</span>
                          </>
                        ) : (
                          <>
                            <X size={13} style={{ strokeWidth: 2.5 }} />
                            <span>Passwords do not match</span>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Faculty Profile with Department DROPDOWN */}
                {formData.role === 'teacher' && (
                  <div style={{ borderTop: '1px solid var(--border)', paddingTop: '16px', marginTop: '8px' }}>
                    <h4 style={{ margin: '0 0 12px 0', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '.5px', color: 'var(--text-secondary)' }}>
                      Faculty Profile
                    </h4>
                    <div className="grid-2" style={{ gap: '14px' }}>
                      <div className="form-group">
                        <label className="form-label">Faculty ID (FAC-ID) *</label>
                        <input
                          type="text"
                          className="form-control"
                          value={formData.employee_id}
                          onChange={(e) => setFormData({ ...formData, employee_id: e.target.value })}
                          placeholder="e.g. FAC-2026-001"
                        />
                      </div>

                      {/* 🌟 Dynamic Department Dropdown populated with Program entities */}
                      <div className="form-group">
                        <label className="form-label">Department / Program *</label>
                        <select
                          className="form-select"
                          value={formData.department}
                          onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                          required
                        >
                          <option value="">Select Program / Department</option>
                          {programs.map((p) => (
                            <option key={p.id || p.code} value={p.name || p.code}>
                              {p.code} - {p.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                        <label className="form-label">Specialization</label>
                        <input
                          type="text"
                          className="form-control"
                          value={formData.specialization}
                          onChange={(e) => setFormData({ ...formData, specialization: e.target.value })}
                          placeholder="e.g. Software Engineering, AI & Robotics"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="modal-footer" style={{ padding: '14px 20px', background: 'var(--bg-secondary)', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" className="btn btn-outline" onClick={() => setShowAddModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={formLoading} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  {formLoading ? <Loader2 size={16} className="spin" /> : <CheckCircle2 size={16} />}
                  <span>Create Staff User</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── EDIT USER MODAL ─── */}
      {editingUser && (
        <div className="modal-backdrop open" style={{ display: 'flex' }} onClick={(e) => { if (e.target === e.currentTarget) setEditingUser(null); }}>
          <div className="modal-card" style={{ maxWidth: '640px', width: '100%', borderRadius: 'var(--radius-lg)', background: 'var(--bg-card)', border: '1px solid var(--border)', overflow: 'hidden', boxShadow: 'var(--shadow-lg)' }}>
            <div className="modal-header" style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Edit2 size={18} color="var(--primary)" />
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700' }}>
                  Edit User: <code style={{ color: 'var(--primary)' }}>@{editingUser.username}</code>
                </h3>
              </div>
              <button type="button" onClick={() => setEditingUser(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleUpdateUser}>
              <div className="modal-body" style={{ padding: '20px', maxHeight: '70vh', overflowY: 'auto' }}>
                {editError && (
                  <div className="alert alert-danger" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px', fontSize: '13px' }}>
                    <AlertCircle size={15} />
                    <span>{editError}</span>
                  </div>
                )}

                <div className="grid-2" style={{ gap: '14px', marginBottom: '14px' }}>
                  <div className="form-group">
                    <label className="form-label">First Name</label>
                    <input
                      type="text"
                      className="form-control"
                      value={editFormData.first_name}
                      onChange={(e) => setEditFormData({ ...editFormData, first_name: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Last Name</label>
                    <input
                      type="text"
                      className="form-control"
                      value={editFormData.last_name}
                      onChange={(e) => setEditFormData({ ...editFormData, last_name: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid-2" style={{ gap: '14px', marginBottom: '14px' }}>
                  <div className="form-group">
                    <label className="form-label">Email</label>
                    <input
                      type="email"
                      className="form-control"
                      value={editFormData.email}
                      onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Phone</label>
                    <PhoneInput
                      value={editFormData.phone}
                      onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid-2" style={{ gap: '14px', marginBottom: '14px' }}>
                  <div className="form-group">
                    <label className="form-label">Account Status</label>
                    <select
                      className="form-select"
                      value={editFormData.is_active ? 'active' : 'inactive'}
                      onChange={(e) => setEditFormData({ ...editFormData, is_active: e.target.value === 'active' })}
                    >
                      <option value="active">Active</option>
                      <option value="inactive">Inactive / Suspended</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">New Password (optional)</label>
                    <PasswordInput
                      placeholder="Leave blank to keep unchanged"
                      value={editFormData.password}
                      onChange={(e) => setEditFormData({ ...editFormData, password: e.target.value })}
                      showStrength={true}
                    />
                  </div>
                </div>

                {editingUser.role === 'teacher' && (
                  <div style={{ marginTop: '16px', paddingTop: '14px', borderTop: '1px solid var(--border)' }}>
                    <div style={{ fontSize: '13px', fontWeight: '700', marginBottom: '12px', color: 'var(--text-primary)' }}>
                      Faculty Details
                    </div>
                    <div className="grid-2" style={{ gap: '14px' }}>
                      <div className="form-group">
                        <label className="form-label">Employee ID</label>
                        <input
                          type="text"
                          className="form-control"
                          value={editFormData.employee_id}
                          onChange={(e) => setEditFormData({ ...editFormData, employee_id: e.target.value })}
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Department / Program</label>
                        <select
                          className="form-select"
                          value={editFormData.department}
                          onChange={(e) => setEditFormData({ ...editFormData, department: e.target.value })}
                        >
                          <option value="">Select Department</option>
                          {programs.map((p) => (
                            <option key={p.id || p.code} value={p.name || p.code}>
                              {p.code} - {p.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                        <label className="form-label">Specialization</label>
                        <input
                          type="text"
                          className="form-control"
                          value={editFormData.specialization}
                          onChange={(e) => setEditFormData({ ...editFormData, specialization: e.target.value })}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {editingUser.role === 'student' && (
                  <div style={{ marginTop: '16px', paddingTop: '14px', borderTop: '1px solid var(--border)' }}>
                    <div style={{ fontSize: '13px', fontWeight: '700', marginBottom: '12px', color: 'var(--text-primary)' }}>
                      Student Academic Profile
                    </div>
                    <div className="grid-2" style={{ gap: '14px' }}>
                      <div className="form-group">
                        <label className="form-label">Student ID</label>
                        <input
                          type="text"
                          className="form-control"
                          value={editFormData.student_id}
                          onChange={(e) => setEditFormData({ ...editFormData, student_id: e.target.value })}
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Course / Program</label>
                        <select
                          className="form-select"
                          value={editFormData.course}
                          onChange={(e) => setEditFormData({ ...editFormData, course: e.target.value })}
                        >
                          <option value="">Select Course</option>
                          {programs.map((p) => (
                            <option key={p.id || p.code} value={p.code}>
                              {p.code} - {p.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="form-group">
                        <label className="form-label">Year Level</label>
                        <select
                          className="form-select"
                          value={editFormData.year_level}
                          onChange={(e) => setEditFormData({ ...editFormData, year_level: Number(e.target.value) })}
                        >
                          <option value={1}>1st Year</option>
                          <option value={2}>2nd Year</option>
                          <option value={3}>3rd Year</option>
                          <option value={4}>4th Year</option>
                        </select>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="modal-footer" style={{ padding: '14px 20px', background: 'var(--bg-secondary)', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" className="btn btn-outline" onClick={() => setEditingUser(null)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={editLoading} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  {editLoading ? <Loader2 size={16} className="spin" /> : <CheckCircle2 size={16} />}
                  <span>Save Changes</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
