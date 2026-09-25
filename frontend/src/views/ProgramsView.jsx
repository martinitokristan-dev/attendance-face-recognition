import React, { useState, useEffect } from 'react';
import { Award, Plus, X, Check, BookOpen, Trash2, Edit2 } from 'lucide-react';
import { Api } from '../api';
import ActionPopover from '../components/ActionPopover';
import Toast from '../components/Toast';

export default function ProgramsView({ user, onSetHeaderInfo }) {
  const [programs, setPrograms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    college: '',
    description: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Edit state
  const [editingProgram, setEditingProgram] = useState(null);
  const [editFormData, setEditFormData] = useState({ code: '', name: '', college: '', description: '' });
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editErrorMsg, setEditErrorMsg] = useState('');

  const loadPrograms = async () => {
    try {
      setLoading(true);
      const data = await Api.getPrograms();
      setPrograms(data);
    } catch (err) {
      console.error('Failed to load programs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPrograms();
  }, []);

  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    if (onSetHeaderInfo) {
      onSetHeaderInfo({
        title: 'Academic Programs',
        subtitle: 'Father Saturnino Urios University (FSUU) Academic Programs',
        headerActions: isAdmin ? (
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setShowAddModal(true)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <Plus size={16} />
            <span>Add Program</span>
          </button>
        ) : null,
      });
    }
  }, [isAdmin]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.code || !formData.name || !formData.college) {
      setErrorMsg('Please fill in all required fields (Code, Name, College).');
      return;
    }

    try {
      setSubmitting(true);
      setErrorMsg('');
      await Api.createProgram(formData);
      setSuccessMsg(`Program ${formData.code} created successfully!`);
      setShowAddModal(false);
      setFormData({ code: '', name: '', college: '', description: '' });
      await loadPrograms();
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to create program.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenEdit = (prog) => {
    setEditingProgram(prog);
    setEditErrorMsg('');
    setEditFormData({
      code: prog.code || '',
      name: prog.name || '',
      college: prog.college || '',
      description: prog.description || '',
    });
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editFormData.code || !editFormData.name || !editFormData.college) {
      setEditErrorMsg('Please fill in all required fields.');
      return;
    }
    try {
      setEditSubmitting(true);
      setEditErrorMsg('');
      await Api.updateProgram(editingProgram.id, editFormData);
      setSuccessMsg(`Program "${editFormData.code}" updated successfully!`);
      setEditingProgram(null);
      await loadPrograms();
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      setEditErrorMsg(err.message || 'Failed to update program.');
    } finally {
      setEditSubmitting(false);
    }
  };

  return (
    <div className="page-content">
      <Toast message={successMsg} type="success" onClose={() => setSuccessMsg('')} />
      <Toast message={errorMsg} type="error" onClose={() => setErrorMsg('')} />

      {/* Programs Table */}
      <div className="card">
        <div className="table-container" style={{ border: 'none', margin: 0 }}>
          <table>
            <thead>
              <tr>
                <th>Code</th>
                <th>Program Name</th>
                <th>College / Department</th>
                <th>Sections</th>
                <th>Subjects</th>
                {isAdmin && <th style={{ textAlign: 'right' }}>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={isAdmin ? 6 : 5} className="text-center text-muted" style={{ padding: '32px' }}>
                    Loading programs...
                  </td>
                </tr>
              ) : programs.length === 0 ? (
                <tr>
                  <td colSpan={isAdmin ? 6 : 5} className="text-center text-muted" style={{ padding: '36px' }}>
                    No academic programs found.{' '}
                    {isAdmin && (
                      <button
                        type="button"
                        className="btn-link"
                        onClick={() => setShowAddModal(true)}
                        style={{ color: 'var(--primary)', cursor: 'pointer', background: 'none', border: 'none', textDecoration: 'underline' }}
                      >
                        Create one
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                programs.map((prog) => (
                  <tr key={prog.id}>
                    <td>
                      <span className="badge badge-accent" style={{ fontSize: '13px', fontWeight: '700' }}>
                        {prog.code}
                      </span>
                    </td>
                    <td><strong>{prog.name}</strong></td>
                    <td><span className="text-muted">{prog.college || '—'}</span></td>
                    <td>
                      <span className="badge badge-info" style={{ fontWeight: '600' }}>
                        {prog.section_count || 0}
                      </span>
                    </td>
                    <td>
                      <span className="badge badge-outline" style={{ fontWeight: '600' }}>
                        {prog.subject_count || 0}
                      </span>
                    </td>
                    {isAdmin && (
                      <td style={{ textAlign: 'right' }}>
                        <ActionPopover
                          items={[
                            {
                              label: 'Edit Program',
                              icon: Edit2,
                              onClick: () => handleOpenEdit(prog),
                            },
                            { isDivider: true },
                            {
                              label: 'Delete Program',
                              icon: Trash2,
                              isDanger: true,
                              onClick: async () => {
                                if (!window.confirm(`Are you sure you want to delete program "${prog.code}"?`)) return;
                                try {
                                  await Api.deleteProgram(prog.id);
                                  setSuccessMsg(`Program ${prog.code} deleted.`);
                                  loadPrograms();
                                  setTimeout(() => setSuccessMsg(''), 4000);
                                } catch (err) {
                                  setErrorMsg(err.message || 'Failed to delete program.');
                                }
                              },
                            },
                          ]}
                        />
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Program Modal */}
      {showAddModal && (
        <div
          className="modal-backdrop open"
          style={{ display: 'flex', opacity: 1, zIndex: 1200 }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowAddModal(false);
          }}
        >
          <div className="modal-card modal-md">
            <div className="modal-header">
              <h3 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <BookOpen size={18} style={{ color: 'var(--primary)' }} />
                <span>Add Academic Program</span>
              </h3>
              <button
                type="button"
                className="btn btn-outline btn-sm modal-close-btn"
                onClick={() => setShowAddModal(false)}
                style={{ padding: '4px', border: 'none', background: 'none', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="modal-body" style={{ padding: '22px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {errorMsg && (
                  <div className="alert alert-danger" style={{ fontSize: '13px', padding: '10px 14px' }}>
                    {errorMsg}
                  </div>
                )}

                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">Program Code *</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g. BSCS, BSIT, BSEMC"
                      value={formData.code}
                      onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                      required
                    />
                    <span className="form-text">e.g. BSCS, BSIT, BSEMC</span>
                  </div>

                  <div className="form-group">
                    <label className="form-label">College / Department *</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g. CITEC, CCJE, CAS"
                      value={formData.college}
                      onChange={(e) => setFormData({ ...formData, college: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Full Program Name *</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. Bachelor of Science in Computer Science"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Description (Optional)</label>
                  <textarea
                    className="form-control"
                    rows="2"
                    placeholder="Overview of program competencies and objectives..."
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  />
                </div>
              </div>

              <div className="modal-footer" style={{ padding: '14px 22px', background: 'var(--bg-secondary)', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" className="btn btn-outline" onClick={() => setShowAddModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  <Check size={16} />
                  <span>{submitting ? 'Creating...' : 'Create Program'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Program Modal */}
      {editingProgram && (
        <div
          className="modal-backdrop open"
          style={{ display: 'flex', opacity: 1, zIndex: 1200 }}
          onClick={(e) => { if (e.target === e.currentTarget) setEditingProgram(null); }}
        >
          <div className="modal-card modal-md">
            <div className="modal-header">
              <h3 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Edit2 size={18} style={{ color: 'var(--primary)' }} />
                <span>Edit Program</span>
              </h3>
              <button type="button" className="btn btn-outline btn-sm modal-close-btn" onClick={() => setEditingProgram(null)} style={{ padding: '4px', border: 'none', background: 'none', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleEditSubmit}>
              <div className="modal-body" style={{ padding: '22px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {editErrorMsg && (
                  <div className="alert alert-danger" style={{ fontSize: '13px', padding: '10px 14px' }}>{editErrorMsg}</div>
                )}
                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">Program Code *</label>
                    <input type="text" className="form-control" value={editFormData.code} onChange={(e) => setEditFormData({ ...editFormData, code: e.target.value })} required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">College / Department *</label>
                    <input type="text" className="form-control" value={editFormData.college} onChange={(e) => setEditFormData({ ...editFormData, college: e.target.value })} required />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Full Program Name *</label>
                  <input type="text" className="form-control" value={editFormData.name} onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Description (Optional)</label>
                  <textarea className="form-control" rows="2" value={editFormData.description} onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })} />
                </div>
              </div>
              <div className="modal-footer" style={{ padding: '14px 22px', background: 'var(--bg-secondary)', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" className="btn btn-outline" onClick={() => setEditingProgram(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={editSubmitting}>
                  <Check size={16} />
                  <span>{editSubmitting ? 'Saving...' : 'Save Changes'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
