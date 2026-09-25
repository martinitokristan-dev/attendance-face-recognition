import React, { useState, useEffect, useMemo } from 'react';
import { Layers, Plus, Filter, X, Check, Building, Trash2, Calendar, RotateCcw } from 'lucide-react';
import { Api } from '../api';
import ActionPopover from '../components/ActionPopover';
import Toast from '../components/Toast';

export default function SectionCatalogView({ user, onNavigate, onSetHeaderInfo }) {
  const [sections, setSections] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [loading, setLoading] = useState(true);

  // 3 Unified Filter Dropdowns
  const [filterCollege, setFilterCollege] = useState('');
  const [filterCourse, setFilterCourse] = useState('');
  const [filterYear, setFilterYear] = useState('');

  const [showAddModal, setShowAddModal] = useState(false);
  const [formData, setFormData] = useState({
    program: '',
    course: 'BSIT',
    name: '',
    year_level: 1,
    description: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const loadData = async () => {
    try {
      setLoading(true);
      const [secList, progList] = await Promise.all([
        Api.getProgramSections(),
        Api.getPrograms(),
      ]);
      setSections(secList);
      setPrograms(progList);
    } catch (err) {
      console.error('Failed to load section catalog:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    if (onSetHeaderInfo) {
      onSetHeaderInfo({
        title: 'Section Catalog (Master List)',
        subtitle: 'Official section definitions grouped by College, Course, and Year Level',
        headerActions: isAdmin ? (
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setShowAddModal(true)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <Plus size={16} />
            <span>Add Section Definition</span>
          </button>
        ) : null,
      });
    }
  }, [isAdmin, onSetHeaderInfo]);

  // Derive unique courses dynamically from available sections
  const availableCourses = useMemo(() => {
    const set = new Set();
    // Common default options
    ['BSIT', 'BSCS', 'BSEMC', 'ACT', 'BSA', 'BSN', 'BSCrim', 'BSCE'].forEach((c) => set.add(c));
    sections.forEach((s) => {
      if (s.course) set.add(s.course);
    });
    return Array.from(set).sort();
  }, [sections]);

  // Client-side instant filtering across all 3 dimensions
  const filteredSections = useMemo(() => {
    return sections.filter((s) => {
      // 1. College filter
      if (filterCollege) {
        const progId = s.program || s.program_details?.id;
        const progCode = s.program_details?.code || '';
        if (String(progId) !== String(filterCollege) && progCode !== filterCollege) {
          return false;
        }
      }
      // 2. Course filter
      if (filterCourse) {
        if ((s.course || '').toUpperCase() !== filterCourse.toUpperCase()) {
          return false;
        }
      }
      // 3. Year Level filter
      if (filterYear) {
        if (String(s.year_level) !== String(filterYear)) {
          return false;
        }
      }
      return true;
    });
  }, [sections, filterCollege, filterCourse, filterYear]);

  const hasActiveFilters = Boolean(filterCollege || filterCourse || filterYear);

  const handleResetFilters = () => {
    setFilterCollege('');
    setFilterCourse('');
    setFilterYear('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.program) {
      setErrorMsg('College program and section name are required.');
      return;
    }

    try {
      setSubmitting(true);
      setErrorMsg('');
      await Api.createProgramSection({
        program: formData.program,
        course: formData.course.trim().toUpperCase(),
        name: formData.name.trim(),
        year_level: parseInt(formData.year_level, 10) || 1,
        description: formData.description || '',
      });
      setSuccessMsg(`Section definition "${formData.name}" created successfully!`);
      setShowAddModal(false);
      setFormData({ program: '', course: 'BSIT', name: '', year_level: 1, description: '' });
      await loadData();
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to create section definition.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="page-content">
      <Toast message={successMsg} type="success" onClose={() => setSuccessMsg('')} />
      <Toast message={errorMsg} type="error" onClose={() => setErrorMsg('')} />

      {/* Modern 3-Dropdown Filter Toolbar */}
      <div
        className="card mb-3"
        style={{
          padding: '16px 20px',
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Filter size={16} style={{ color: 'var(--primary)' }} />
            <span style={{ fontWeight: '700', fontSize: '13.5px', color: 'var(--text-primary)' }}>
              Filter Section Catalog
            </span>
            {hasActiveFilters && (
              <span className="badge badge-primary" style={{ fontSize: '11px', padding: '2px 8px' }}>
                Active Filters
              </span>
            )}
          </div>
          <div style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>
            Showing <strong>{filteredSections.length}</strong> of <strong>{sections.length}</strong> section definitions
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', alignItems: 'flex-end' }}>
          {/* Filter 1: College / Program */}
          <div className="form-group" style={{ margin: 0 }}>
            <label style={{ display: 'block', fontSize: '11.5px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '4px' }}>
              1. College / Department
            </label>
            <select
              className="form-select"
              value={filterCollege}
              onChange={(e) => setFilterCollege(e.target.value)}
              style={{ fontSize: '13px', height: '36px' }}
            >
              <option value="">All Colleges / Departments</option>
              {programs.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code} - {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* Filter 2: Course (BSIT, CS, etc.) */}
          <div className="form-group" style={{ margin: 0 }}>
            <label style={{ display: 'block', fontSize: '11.5px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '4px' }}>
              2. Degree Course (BSIT, CS, etc.)
            </label>
            <select
              className="form-select"
              value={filterCourse}
              onChange={(e) => setFilterCourse(e.target.value)}
              style={{ fontSize: '13px', height: '36px' }}
            >
              <option value="">All Courses / Majors</option>
              {availableCourses.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {/* Filter 3: Year Level */}
          <div className="form-group" style={{ margin: 0 }}>
            <label style={{ display: 'block', fontSize: '11.5px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '4px' }}>
              3. Year Level
            </label>
            <select
              className="form-select"
              value={filterYear}
              onChange={(e) => setFilterYear(e.target.value)}
              style={{ fontSize: '13px', height: '36px' }}
            >
              <option value="">All Year Levels</option>
              <option value="1">1st Year</option>
              <option value="2">2nd Year</option>
              <option value="3">3rd Year</option>
              <option value="4">4th Year</option>
            </select>
          </div>

          {/* Action: Clear Filters */}
          <div style={{ display: 'flex', gap: '8px' }}>
            {hasActiveFilters && (
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={handleResetFilters}
                style={{ height: '36px', display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}
              >
                <RotateCcw size={14} />
                <span>Reset</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="card" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
        <div className="table-container" style={{ border: 'none', margin: 0 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-secondary)' }}>
                <th style={{ padding: '12px 18px', fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>College</th>
                <th style={{ padding: '12px 18px', fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Course</th>
                <th style={{ padding: '12px 18px', fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Section Name</th>
                <th style={{ padding: '12px 18px', fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Year Level</th>
                <th style={{ padding: '12px 18px', fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Description / Track</th>
                <th style={{ padding: '12px 18px', fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Active Classes</th>
                {isAdmin && <th style={{ padding: '12px 18px', fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase', textAlign: 'right' }}>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={isAdmin ? 7 : 6} style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    Loading section catalog...
                  </td>
                </tr>
              ) : filteredSections.length === 0 ? (
                <tr>
                  <td colSpan={isAdmin ? 7 : 6} style={{ padding: '36px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    {hasActiveFilters ? (
                      <>
                        No section definitions match your filter criteria.{' '}
                        <button
                          type="button"
                          className="btn-link"
                          onClick={handleResetFilters}
                          style={{ color: 'var(--primary)', cursor: 'pointer', background: 'none', border: 'none', textDecoration: 'underline' }}
                        >
                          Clear filters
                        </button>
                      </>
                    ) : (
                      <>
                        No section definitions found.{' '}
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
                      </>
                    )}
                  </td>
                </tr>
              ) : (
                filteredSections.map((sec) => (
                  <tr key={sec.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '14px 18px' }}>
                      <span className="badge badge-accent" style={{ fontSize: '12px', fontWeight: '700' }}>
                        {sec.program_details?.code || 'CITEC'}
                      </span>
                    </td>
                    <td style={{ padding: '14px 18px' }}>
                      <span className="badge badge-primary" style={{ fontSize: '12px', fontWeight: '700' }}>
                        {sec.course || 'BSIT'}
                      </span>
                    </td>
                    <td style={{ padding: '14px 18px', fontWeight: '700', color: 'var(--text-primary)' }}>
                      {sec.name}
                    </td>
                    <td style={{ padding: '14px 18px' }}>
                      <span className="badge badge-info" style={{ fontWeight: '600' }}>
                        {sec.year_level_display || `${sec.year_level}th Year`}
                      </span>
                    </td>
                    <td style={{ padding: '14px 18px', color: 'var(--text-muted)', fontSize: '13px' }}>
                      {sec.description || '—'}
                    </td>
                    <td style={{ padding: '14px 18px' }}>
                      <span className="badge badge-outline">
                        {sec.active_classes_count || 1} active
                      </span>
                    </td>
                    {isAdmin && (
                      <td style={{ padding: '14px 18px', textAlign: 'right' }}>
                        <ActionPopover
                          items={[
                            {
                              label: 'Open Semester Class',
                              icon: Calendar,
                              isPrimary: true,
                              onClick: () => {
                                if (onNavigate) onNavigate('sections');
                              },
                            },
                            { isDivider: true },
                            {
                              label: 'Delete Definition',
                              icon: Trash2,
                              isDanger: true,
                              onClick: async () => {
                                if (!window.confirm(`Are you sure you want to delete definition "${sec.name}"?`)) return;
                                try {
                                  await Api.deleteProgramSection(sec.id);
                                  setSuccessMsg(`Section definition ${sec.name} deleted.`);
                                  loadData();
                                  setTimeout(() => setSuccessMsg(''), 4000);
                                } catch (err) {
                                  setErrorMsg(err.message || 'Failed to delete definition.');
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

      {/* Add Section Definition Modal */}
      {showAddModal && (
        <div
          className="modal-backdrop open"
          style={{ display: 'flex', opacity: 1, zIndex: 1200 }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowAddModal(false);
          }}
        >
          <div className="modal-card modal-md" style={{ width: '100%', maxWidth: '520px', background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-xl)', overflow: 'hidden', border: '1px solid var(--border)' }}>
            <div className="modal-header" style={{ padding: '18px 22px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 className="modal-title" style={{ fontSize: '16px', fontWeight: '700', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Layers size={18} style={{ color: 'var(--primary)' }} />
                <span>Add Section Definition</span>
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
                    <label className="form-label" style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '6px' }}>
                      1. College / Department *
                    </label>
                    <select
                      className="form-select"
                      value={formData.program}
                      onChange={(e) => setFormData({ ...formData, program: e.target.value })}
                      required
                    >
                      <option value="">Select college...</option>
                      {programs.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.code} - {p.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label" style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '6px' }}>
                      2. Course / Degree Program *
                    </label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g. BSIT, BSCS, BSA, ACT"
                      list="course-suggestions"
                      value={formData.course}
                      onChange={(e) => setFormData({ ...formData, course: e.target.value })}
                      required
                    />
                    <datalist id="course-suggestions">
                      <option value="BSIT">Information Technology</option>
                      <option value="BSCS">Computer Science</option>
                      <option value="BSEMC">Entertainment & Multimedia Computing</option>
                      <option value="ACT">Associate in Computer Tech</option>
                      <option value="BSA">Accountancy</option>
                      <option value="BSN">Nursing</option>
                      <option value="BSCrim">Criminology</option>
                      <option value="BSCE">Civil Engineering</option>
                    </datalist>
                  </div>
                </div>

                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label" style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '6px' }}>
                      3. Section Name *
                    </label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g. IT-43, IT 41, BSCS-2A"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label" style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '6px' }}>
                      4. Year Level
                    </label>
                    <select
                      className="form-select"
                      value={formData.year_level}
                      onChange={(e) => setFormData({ ...formData, year_level: parseInt(e.target.value, 10) })}
                    >
                      <option value="1">1st Year</option>
                      <option value="2">2nd Year</option>
                      <option value="3">3rd Year</option>
                      <option value="4">4th Year</option>
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '6px' }}>
                    Description / Track (Optional)
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. Software Engineering Track, Day Shift"
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
                  <span>{submitting ? 'Creating...' : 'Create Section Definition'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
