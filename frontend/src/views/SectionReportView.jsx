import React, { useState, useEffect } from 'react';
import { FileText, Printer, Filter, Calendar, CheckCircle2, Clock, XCircle } from 'lucide-react';
import { Api } from '../api';

export default function SectionReportView({ user, onSetHeaderInfo }) {
  const [sections, setSections] = useState([]);
  const [selectedSectionId, setSelectedSectionId] = useState('');
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadSections() {
      try {
        setLoading(true);
        const secList = await Api.getSections();
        setSections(secList);
        if (secList.length > 0) {
          setSelectedSectionId(secList[0].id);
        }
      } catch (err) {
        console.error('Failed to load sections:', err);
      } finally {
        setLoading(false);
      }
    }
    loadSections();
  }, []);

  useEffect(() => {
    if (onSetHeaderInfo) {
      onSetHeaderInfo({
        title: user?.role === 'teacher' ? 'Attendance Reports' : 'Section Attendance Report',
        subtitle: 'Consolidated attendance records by class section',
        headerActions: (
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => window.print()}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <Printer size={16} />
            <span>Print / Save PDF</span>
          </button>
        ),
      });
    }
  }, [user, onSetHeaderInfo]);

  useEffect(() => {
    async function loadSectionAttendance() {
      if (!selectedSectionId) return;
      try {
        setLoading(true);
        const sessions = await Api.getSessions();
        const secSessions = sessions.filter(
          (s) => s.schedule_details?.section == selectedSectionId || s.schedule?.section == selectedSectionId
        );
        if (secSessions.length > 0) {
          // Fetch details for the sessions and consolidate records
          const detailPromises = secSessions.slice(0, 5).map((s) => Api.getSessionDetail(s.id).catch(() => null));
          const details = await Promise.all(detailPromises);
          const allRecs = [];
          const seen = new Set();
          for (const d of details) {
            if (d && d.records) {
              for (const r of d.records) {
                const key = `${r.student || r.id}-${r.session}`;
                if (!seen.has(key)) {
                  seen.add(key);
                  allRecs.push(r);
                }
              }
            }
          }
          setRecords(allRecs.length > 0 ? allRecs : (details[0]?.records || []));
        } else {
          setRecords([]);
        }
      } catch (err) {
        console.error('Failed to load report:', err);
      } finally {
        setLoading(false);
      }
    }
    loadSectionAttendance();
  }, [selectedSectionId]);

  const selectedSection = sections.find((s) => s.id == selectedSectionId);

  // Compute instructors & subjects string for selected section
  const sectionSubjects = selectedSection?.subjects && selectedSection.subjects.length > 0
    ? selectedSection.subjects.map((sub) => sub.code).join(', ')
    : (selectedSection?.effective_subject_code || selectedSection?.subject_details?.code || 'CS 101');

  const sectionInstructors = selectedSection?.subjects && selectedSection.subjects.length > 0
    ? selectedSection.subjects
        .map((sub) => sub.teacher_details?.user ? `${sub.teacher_details.user.first_name} ${sub.teacher_details.user.last_name}` : 'TBA')
        .filter((val, idx, self) => self.indexOf(val) === idx)
        .join(', ')
    : (selectedSection?.teacher_details?.user?.first_name || 'Assigned Faculty');

  const formatTimestamp = (ts) => {
    if (!ts) return '—';
    try {
      const d = new Date(ts);
      if (isNaN(d.getTime())) return ts;
      return d.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });
    } catch {
      return ts;
    }
  };

  return (
    <div className="page-content">

      {/* Filter Toolbar */}
      <div className="card mb-3" style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
              Section:
            </span>
            <select
              className="form-select form-select-sm"
              value={selectedSectionId}
              onChange={(e) => setSelectedSectionId(e.target.value)}
              style={{ width: '220px', fontSize: '13px' }}
            >
              {sections.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.school_year})
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
              Subject:
            </span>
            <span className="badge badge-accent" style={{ fontWeight: '700' }}>
              {sectionSubjects}
            </span>
          </div>
        </div>

        <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
          Instructor: <strong>{sectionInstructors}</strong>
        </div>
      </div>

      {/* Table */}
      <div className="card" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
        <div className="table-container" style={{ border: 'none', margin: 0 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-secondary)' }}>
                <th style={{ padding: '12px 18px', fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Student</th>
                <th style={{ padding: '12px 18px', fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Student ID</th>
                <th style={{ padding: '12px 18px', fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Verification Status</th>
                <th style={{ padding: '12px 18px', fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Timestamp</th>
                <th style={{ padding: '12px 18px', fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Attendance Rate</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="5" style={{ padding: '36px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    Loading attendance records...
                  </td>
                </tr>
              ) : records.length === 0 ? (
                <tr>
                  <td colSpan="5" style={{ padding: '36px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    No attendance records logged for this section yet.
                  </td>
                </tr>
              ) : (
                records.map((rec) => {
                  const isPresent = rec.status === 'present';
                  const isLate = rec.status === 'late';
                  const st = rec.student_details || rec.student_info || (typeof rec.student === 'object' ? rec.student : {}) || {};
                  const studentName = rec.student_name || (st.user ? `${st.user.first_name || ''} ${st.user.last_name || ''}`.trim() : '') || 'Student';
                  const studentId = rec.student_id_number || st.student_id || '—';

                  return (
                    <tr key={rec.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '14px 18px' }}>
                        <div style={{ fontWeight: '600', color: 'var(--text-primary)' }}>
                          {studentName}
                        </div>
                      </td>
                      <td style={{ padding: '14px 18px', fontWeight: '600' }}>
                        {studentId}
                      </td>
                      <td style={{ padding: '14px 18px' }}>
                        {isPresent ? (
                          <span className="badge badge-success" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <CheckCircle2 size={11} /> Present
                          </span>
                        ) : isLate ? (
                          <span className="badge badge-warning" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <Clock size={11} /> Late
                          </span>
                        ) : (
                          <span className="badge badge-muted" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <XCircle size={11} /> Absent
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '14px 18px', fontSize: '13px', color: 'var(--text-muted)' }}>
                        {formatTimestamp(rec.recognized_at)}
                      </td>
                      <td style={{ padding: '14px 18px' }}>
                        <span className="badge badge-outline" style={{ fontWeight: '700' }}>
                          {isPresent ? '100%' : isLate ? '80%' : '0%'}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
