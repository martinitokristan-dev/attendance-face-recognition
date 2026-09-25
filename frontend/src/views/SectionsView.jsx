import React, { useState, useEffect } from 'react';
import {
  List,
  Calendar,
  Plus,
  Camera,
  X,
  Check,
  Building,
  Clock,
  Users,
  Eye,
  Trash2,
  ExternalLink,
  GraduationCap,
  Layers,
  MapPin,
  CheckCircle,
  AlertTriangle,
  FileText,
  Edit2,
  UserPlus,
  BookOpen,
  AlertCircle,
  RotateCcw,
} from 'lucide-react';
import { Api } from '../api';
import { formatTime12h, formatSchoolScheduleParts } from '../utils/time';
import ActionPopover from '../components/ActionPopover';
import Toast from '../components/Toast';

export default function SectionsView({ user, onNavigate, onStartSession, onSetHeaderInfo }) {
  const [viewMode, setViewMode] = useState('table');
  const [sections, setSections] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [catalogSections, setCatalogSections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedSectionDetail, setSelectedSectionDetail] = useState(null);
  const [sessions, setSessions] = useState([]);

  // Class Roster & Enrollment state
  const [sectionEnrollments, setSectionEnrollments] = useState([]);
  const [loadingEnrollments, setLoadingEnrollments] = useState(false);
  const [allStudents, setAllStudents] = useState([]);
  const [enrollStudentId, setEnrollStudentId] = useState('');
  const [enrollType, setEnrollType] = useState('regular'); // 'regular' | 'irregular'
  const [enrollSubjectId, setEnrollSubjectId] = useState('');
  const [enrolling, setEnrolling] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    program_section: '',
    program: '',
    course: 'BSIT',
    year_level: 1,
    school_year: '2025-2026',
    semester: '1st',
  });
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Edit section state
  const [editingSection, setEditingSection] = useState(null);
  const [editFormData, setEditFormData] = useState({
    name: '',
    program_section: '',
    program: '',
    course: '',
    year_level: 1,
    school_year: '2025-2026',
    semester: '1st',
    semester: '1st',
  });
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editErrorMsg, setEditErrorMsg] = useState('');

  const loadData = async () => {
    try {
      setLoading(true);
      const [secList, schList, progList, teacherList, subjList, catList, sessList] = await Promise.all([
        Api.getSections(),
        Api.getSchedules(),
        Api.getPrograms(),
        Api.getTeachers(),
        Api.getSubjects(),
        Api.getProgramSections(),
        Api.getSessions().catch(() => []),
      ]);
      setSections(secList);
      setSchedules(schList);
      setPrograms(progList);
      setTeachers(teacherList);
      setSubjects(subjList);
      setCatalogSections(catList);
      setSessions(sessList || []);
    } catch (err) {
      console.error('Error loading sections data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const isAdmin = user?.role === 'admin';
  const role = user?.role || 'admin';

  useEffect(() => {
    if (isAdmin && viewMode !== 'table') {
      setViewMode('table');
    }
  }, [isAdmin, viewMode]);

  // Update Top-Header in App.jsx
  useEffect(() => {

    if (onSetHeaderInfo) {
      onSetHeaderInfo({
        title: role === 'student' ? 'My Schedule' : role === 'teacher' ? 'Sections & Schedules' : 'Class Sections',
        subtitle:
          role === 'student'
            ? 'Your enrolled course subjects, room assignments, and weekly class timetable'
            : role === 'teacher'
            ? 'Your assigned teaching sections, course subjects, and class schedules'
            : 'Manage school sections, subjects, and weekly timetable schedules',
        headerActions: (
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            {!isAdmin && (
              <div className="view-toggle-group">
                <button
                  type="button"
                  className={`btn ${viewMode === 'table' ? 'btn-primary' : 'btn-outline'}`}
                  onClick={() => setViewMode('table')}
                >
                  <List size={14} /> <span>Table View</span>
                </button>
                <button
                  type="button"
                  className={`btn ${viewMode === 'grid' ? 'btn-primary' : 'btn-outline'}`}
                  onClick={() => setViewMode('grid')}
                >
                  <Calendar size={14} /> <span>Timetable Grid</span>
                </button>
              </div>
            )}


            {isAdmin && (
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setShowAddModal(true)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <Plus size={16} /> <span>Add Section</span>
              </button>
            )}
          </div>
        ),
      });
    }
  }, [viewMode, isAdmin, role, onSetHeaderInfo]);

  const handleCreateSection = async (e) => {
    e.preventDefault();
    if (!formData.name) {
      setErrorMsg('Section name is required.');
      return;
    }

    try {
      setSubmitting(true);
      setErrorMsg('');
      const payload = {
        name: formData.name.trim(),
        program_section: formData.program_section || null,
        program: formData.program || null,
        course: formData.course || '',
        year_level: parseInt(formData.year_level, 10) || 1,
        school_year: formData.school_year,
        semester: formData.semester,
      };
      await Api.createSection(payload);

      setSuccessMsg(`Class Section "${formData.name}" created successfully!`);
      setShowAddModal(false);
      setFormData({
        name: '',
        program_section: '',
        program: '',
        course: 'BSIT',
        year_level: 1,
        school_year: '2025-2026',
        semester: '1st',
      });
      await loadData();
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to create section.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteSection = async (id, name) => {
    if (!window.confirm(`Are you sure you want to delete class section "${name}"?`)) return;
    try {
      await Api.deleteSection(id);
      setSuccessMsg(`Section "${name}" deleted.`);
      loadData();
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to delete section.');
    }
  };

  const handleOpenEditSection = (sec) => {
    setEditingSection(sec);
    setEditErrorMsg('');
    setEditFormData({
      name: sec.name || '',
      program_section: sec.program_section || sec.program_section_details?.id || '',
      program: sec.program_details?.id || sec.program || '',
      course: sec.course || sec.program_section_details?.course || '',
      year_level: sec.year_level || 1,
      school_year: sec.school_year || '2025-2026',
      semester: sec.semester || '1st',
    });
  };

  const handleEditSectionSubmit = async (e) => {
    e.preventDefault();
    if (!editFormData.name) {
      setEditErrorMsg('Section name is required.');
      return;
    }
    try {
      setEditSubmitting(true);
      setEditErrorMsg('');
      await Api.updateSection(editingSection.id, {
        name: editFormData.name.trim(),
        program_section: editFormData.program_section || null,
        program: editFormData.program || null,
        course: editFormData.course || '',
        year_level: parseInt(editFormData.year_level, 10) || 1,
        school_year: editFormData.school_year,
        semester: editFormData.semester,
      });
      setSuccessMsg(`Section "${editFormData.name}" updated successfully!`);
      setEditingSection(null);
      await loadData();
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      setEditErrorMsg(err.message || 'Failed to update section.');
    } finally {
      setEditSubmitting(false);
    }
  };

  const handleOpenSectionDetail = async (sec) => {
    setSelectedSectionDetail(sec);
    setEnrollStudentId('');
    setEnrollType('regular');
    setEnrollSubjectId('');
    try {
      setLoadingEnrollments(true);
      const [enrollments, studentList] = await Promise.all([
        Api.getSectionEnrollments(sec.id),
        allStudents.length > 0 ? Promise.resolve(allStudents) : Api.getStudents(),
      ]);
      setSectionEnrollments(enrollments);
      if (allStudents.length === 0) setAllStudents(studentList);
    } catch (err) {
      console.error('Failed to load section enrollments:', err);
    } finally {
      setLoadingEnrollments(false);
    }
  };

  const handleEnrollSubmit = async (e) => {
    e.preventDefault();
    if (!enrollStudentId || !selectedSectionDetail) return;
    if (enrollType === 'irregular' && !enrollSubjectId) {
      setErrorMsg('Please select a specific course subject for this irregular student.');
      return;
    }
    try {
      setEnrolling(true);
      setErrorMsg('');
      const subId = enrollType === 'irregular' ? enrollSubjectId : null;
      await Api.enrollStudent(selectedSectionDetail.id, enrollStudentId, subId);
      const updated = await Api.getSectionEnrollments(selectedSectionDetail.id);
      setSectionEnrollments(updated);
      setEnrollStudentId('');
      setSuccessMsg('Student successfully enrolled in section!');
      await loadData();
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to enroll student');
    } finally {
      setEnrolling(false);
    }
  };

  const handleUnenrollStudent = async (enrollmentId) => {
    if (!window.confirm('Are you sure you want to remove this student enrollment?')) return;
    try {
      setErrorMsg('');
      await Api.unenrollStudent(selectedSectionDetail.id, enrollmentId);
      const updated = await Api.getSectionEnrollments(selectedSectionDetail.id);
      setSectionEnrollments(updated);
      setSuccessMsg('Student removed from section.');
      await loadData();
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to remove student');
    }
  };

  // Helper to format schedules summary items
  const getSectionScheduleItems = (sec) => {
    const secSchedules = schedules.filter((s) => s.section === sec.id);
    if (secSchedules.length === 0) {
      if (sec.schedule_display && sec.schedule_display !== 'No schedule set') {
        const parsed = formatSchoolScheduleParts(sec.schedule_display);
        return parsed.fullTime !== 'No schedule set' ? [parsed] : [];
      }
      return [];
    }
    return secSchedules.map((s) => formatSchoolScheduleParts(s));
  };

  // Helper to construct per-subject rows for each section (for rowSpan alignment)
  const getSectionSubjectRows = (sec) => {
    const secSchedules = schedules.filter((s) => s.section === sec.id);

    if (sec.subjects && sec.subjects.length > 0) {
      return sec.subjects.map((sub) => {
        let subScheds = secSchedules.filter((s) => s.subject === sub.id || s.subject_code === sub.code);
        if (subScheds.length === 0 && sec.subjects.length === 1) {
          subScheds = secSchedules;
        }

        let formattedScheds = subScheds.map((s) => formatSchoolScheduleParts(s));
        if (formattedScheds.length === 0 && sec.subjects.length === 1 && sec.schedule_display && sec.schedule_display !== 'No schedule set') {
          const parsed = formatSchoolScheduleParts(sec.schedule_display);
          if (parsed.fullTime !== 'No schedule set') {
            formattedScheds = [parsed];
          }
        }

        const teacher = sub.teacher_details?.user
          ? `${sub.teacher_details.user.first_name} ${sub.teacher_details.user.last_name}`
          : sub.teacher_name || (sec.teacher_details?.user ? `${sec.teacher_details.user.first_name} ${sec.teacher_details.user.last_name}` : '— Unassigned');

        return {
          id: sub.id,
          code: sub.code,
          name: sub.name,
          teacher,
          schedules: formattedScheds,
        };
      });
    }

    // Fallback if section has single subject or no subjects array
    const subjectCode = sec.effective_subject_code || sec.subject_details?.code || (sec.subject ? 'Linked' : '');
    const subjectName = sec.effective_subject_name || sec.subject_details?.name || '';
    const teacher = sec.teacher_details?.user
      ? `${sec.teacher_details.user.first_name} ${sec.teacher_details.user.last_name}`
      : '— Unassigned';

    let formattedScheds = secSchedules.map((s) => formatSchoolScheduleParts(s));
    if (formattedScheds.length === 0 && sec.schedule_display && sec.schedule_display !== 'No schedule set') {
      const parsed = formatSchoolScheduleParts(sec.schedule_display);
      if (parsed.fullTime !== 'No schedule set') {
        formattedScheds = [parsed];
      }
    }

    return [
      {
        id: sec.subject || null,
        code: subjectCode !== '—' ? subjectCode : '',
        name: subjectName || (subjectCode ? '' : 'No subjects'),
        teacher,
        schedules: formattedScheds,
      },
    ];
  };

  const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  return (
    <div className="page-content">
      <Toast message={successMsg} type="success" onClose={() => setSuccessMsg('')} />
      <Toast message={errorMsg} type="error" onClose={() => setErrorMsg('')} />

      {/* VIEW 1: TABLE VIEW (Admin is locked to Table View; Students & Faculty can toggle Timetable Grid) */}
      {isAdmin || viewMode === 'table' ? (

        <div className="card mb-3" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
          <div className="table-container" style={{ border: 'none', margin: 0, overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-secondary)' }}>
                  <th style={{ padding: '10px 8px', fontSize: '11px', fontWeight: '650', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.4px', width: '65px', textAlign: 'center' }}>Program</th>
                  <th style={{ padding: '10px 8px', fontSize: '11px', fontWeight: '650', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.4px', width: '65px', textAlign: 'center' }}>Course</th>
                  <th style={{ padding: '10px 8px', fontSize: '11px', fontWeight: '650', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.4px', borderRight: '1px solid var(--border)', width: '110px' }}>Section &amp; Year</th>
                  {role !== 'teacher' && (
                    <th style={{ padding: '10px 8px', fontSize: '11px', fontWeight: '650', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.4px', width: '115px' }}>Instructor</th>
                  )}
                  <th style={{ padding: '10px 8px', fontSize: '11px', fontWeight: '650', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.4px', width: '295px' }}>Subject</th>
                  <th style={{ padding: '10px 8px', fontSize: '11px', fontWeight: '650', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.4px', width: '210px' }}>Schedule</th>
                  <th style={{ padding: '10px 8px', fontSize: '11px', fontWeight: '650', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.4px', width: '110px', textAlign: 'center' }}>School Year</th>
                  <th style={{ padding: '10px 8px', fontSize: '11px', fontWeight: '650', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.4px', width: '90px', textAlign: 'center' }}>Students</th>
                  {role === 'teacher' && <th style={{ padding: '10px 8px', fontSize: '11px', fontWeight: '650', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.4px', width: '100px', textAlign: 'center' }}>Attendance</th>}
                  <th style={{ padding: '10px 8px', fontSize: '11px', fontWeight: '650', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.4px', textAlign: 'center', width: '75px' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={9} style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>
                      Loading sections...
                    </td>
                  </tr>
                ) : sections.length === 0 ? (
                  <tr>
                    <td colSpan={9} style={{ padding: '36px', textAlign: 'center', color: 'var(--text-muted)' }}>
                      No class sections available.{' '}
                      {isAdmin && (
                        <button
                          type="button"
                          className="btn-link"
                          onClick={() => setShowAddModal(true)}
                          style={{ color: 'var(--primary)', cursor: 'pointer', background: 'none', border: 'none', textDecoration: 'underline' }}
                        >
                          Add one
                        </button>
                      )}
                    </td>
                  </tr>
                ) : (
                  sections.map((sec) => {
                    const subjectRows = getSectionSubjectRows(sec);
                    const rowSpanCount = subjectRows.length;

                    return (
                      <React.Fragment key={sec.id}>
                        {subjectRows.map((subItem, subIdx) => {
                          const isFirstSubject = subIdx === 0;
                          const isLastSubject = subIdx === subjectRows.length - 1;

                          return (
                            <tr
                              key={`${sec.id}-sub-${subItem.id || subIdx}`}
                              style={{
                                borderBottom: isLastSubject
                                  ? '1px solid var(--border)'
                                  : '1px solid rgba(0, 0, 0, 0.05)',
                                background: 'transparent',
                              }}
                            >
                              {/* ─── SECTION-LEVEL CELLS (Program, Course, Section) ─── */}
                              {isFirstSubject && (
                                <>
                                  <td rowSpan={rowSpanCount} style={{ padding: '10px 8px', verticalAlign: 'middle', textAlign: 'center' }}>
                                    <span className="badge badge-accent" style={{ fontWeight: '700' }}>
                                      {sec.program_details?.code || sec.program?.code || 'CITEC'}
                                    </span>
                                  </td>
                                  <td rowSpan={rowSpanCount} style={{ padding: '10px 8px', verticalAlign: 'middle', textAlign: 'center' }}>
                                    {sec.course ? (
                                      <span className="badge badge-primary" style={{ fontWeight: '700', fontSize: '11.5px' }}>
                                        {sec.course}
                                      </span>
                                    ) : (
                                      <span className="text-muted" style={{ fontSize: '12px' }}>—</span>
                                    )}
                                  </td>
                                  <td rowSpan={rowSpanCount} style={{ padding: '10px 8px', verticalAlign: 'middle', borderRight: '1px solid var(--border)' }}>
                                    <strong>{sec.name}</strong>
                                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                                      {sec.year_level_display || `${sec.year_level || 1}st Year`}
                                    </div>
                                  </td>
                                </>
                              )}

                              {/* ─── SUBJECT-LEVEL CELLS: 1. Instructor, 2. Subject, 3. Schedule ─── */}
                              {/* 1. Instructor (Admin/Student only - hidden in teacher portal) */}
                              {role !== 'teacher' && (
                                <td style={{ padding: '10px 8px', verticalAlign: 'middle' }}>
                                  {subItem.teacher && subItem.teacher !== '— Unassigned' ? (
                                    <span style={{ fontSize: '12.5px', fontWeight: '600', color: 'var(--text-primary)' }}>
                                      {subItem.teacher}
                                    </span>
                                  ) : (
                                    <span className="text-muted" style={{ fontSize: '12px' }}>— Unassigned</span>
                                  )}
                                </td>
                              )}

                              {/* 2. Subject */}
                              <td style={{ padding: '10px 8px', verticalAlign: 'middle' }}>
                                {subItem.code ? (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                                    <div>
                                      <span className="badge badge-accent" style={{ fontWeight: '700', fontSize: '11px', padding: '2px 7px' }}>
                                        {subItem.code}
                                      </span>
                                    </div>
                                    <span style={{ fontSize: '12.5px', fontWeight: '500', color: 'var(--text-primary)', lineHeight: 1.3 }}>
                                      {subItem.name}
                                    </span>
                                  </div>
                                ) : (
                                  <span className="text-muted" style={{ fontSize: '12px' }}>
                                    {subItem.name || 'No subjects'}
                                  </span>
                                )}
                              </td>

                              {/* 3. Schedule (Day & Time) */}
                              <td style={{ padding: '10px 8px', verticalAlign: 'middle' }}>
                                {subItem.schedules && subItem.schedules.length > 0 ? (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    {subItem.schedules.map((item, idx) => (
                                      <div
                                        key={idx}
                                        className="badge badge-outline"
                                        style={{
                                          display: 'inline-flex',
                                          flexDirection: 'column',
                                          alignItems: 'flex-start',
                                          gap: '1px',
                                          padding: '4px 8px',
                                          color: 'var(--text-primary)',
                                          borderColor: 'rgba(99,102,241,0.3)',
                                          background: 'rgba(99,102,241,0.05)',
                                          borderRadius: '5px',
                                          lineHeight: 1.25,
                                          width: 'fit-content',
                                          maxWidth: '100%',
                                        }}
                                      >
                                        {(item.timeLines || [item.fullTime]).map((tl, tIdx) => (
                                          <span
                                            key={tIdx}
                                            style={{
                                              fontSize: '11px',
                                              fontWeight: '600',
                                              letterSpacing: '0.1px',
                                              whiteSpace: 'nowrap',
                                            }}
                                          >
                                            {tl}
                                          </span>
                                        ))}
                                        {item.room && (
                                          <span style={{ fontSize: '10px', fontWeight: '500', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                                            {item.room}
                                          </span>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <span className="text-muted" style={{ fontSize: '12px' }}>
                                    No schedule set
                                  </span>
                                )}
                              </td>

                              {/* ─── TRAILING SECTION-LEVEL CELLS (School Year, Students, Today's Attendance, Actions) ─── */}
                              {isFirstSubject && (
                                <>
                                  <td rowSpan={rowSpanCount} style={{ padding: '10px 8px', fontSize: '12.5px', verticalAlign: 'middle', textAlign: 'center' }}>
                                    <div>{sec.school_year}</div>
                                    <div className="text-muted" style={{ fontSize: '11px' }}>({sec.semester})</div>
                                  </td>
                                  <td rowSpan={rowSpanCount} style={{ padding: '10px 8px', verticalAlign: 'middle', textAlign: 'center' }}>
                                    <button
                                      type="button"
                                      onClick={() => handleOpenSectionDetail(sec)}
                                      title="View Section Details & Class Roster"
                                      style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '5px',
                                        padding: '3px 8px',
                                        borderRadius: '6px',
                                        background: 'rgba(37, 99, 235, 0.06)',
                                        border: '1px solid rgba(37, 99, 235, 0.16)',
                                        color: 'var(--info)',
                                        cursor: 'pointer',
                                        transition: 'all 0.15s ease',
                                        outline: 'none',
                                      }}
                                      onMouseEnter={(e) => {
                                        e.currentTarget.style.background = 'rgba(37, 99, 235, 0.12)';
                                        e.currentTarget.style.borderColor = 'rgba(37, 99, 235, 0.28)';
                                      }}
                                      onMouseLeave={(e) => {
                                        e.currentTarget.style.background = 'rgba(37, 99, 235, 0.06)';
                                        e.currentTarget.style.borderColor = 'rgba(37, 99, 235, 0.16)';
                                      }}
                                    >
                                      <Users size={14} style={{ width: '14px', height: '14px', color: 'var(--info)' }} />
                                      <span style={{ fontSize: '13px', fontWeight: '500', color: 'var(--info)', lineHeight: 1 }}>
                                        {sec.student_count || 0}
                                      </span>
                                    </button>
                                  </td>
                                  {role === 'teacher' && (
                                    <td rowSpan={rowSpanCount} style={{ padding: '10px 8px', verticalAlign: 'middle', textAlign: 'center' }}>
                                      <span className="badge badge-outline" style={{ color: 'var(--text-muted)', opacity: 0.85 }}>—</span>
                                    </td>
                                  )}
                                  <td rowSpan={rowSpanCount} style={{ padding: '10px 8px', textAlign: 'center', whiteSpace: 'nowrap', verticalAlign: 'middle' }}>
                                    <ActionPopover
                                      items={(() => {
                                        if (role === 'teacher') {
                                          const secSession = sessions.find((s) => s.schedule_details?.section === sec.id || s.schedule === sec.primary_schedule?.id);
                                          const isClosed = secSession?.status === 'closed';
                                          const isOpen = secSession?.status === 'open';

                                          return [
                                            isClosed
                                              ? {
                                                  label: 'Reopen & Scan',
                                                  icon: RotateCcw,
                                                  isPrimary: true,
                                                  onClick: () => {
                                                    if (onStartSession) onStartSession(sec);
                                                    else onNavigate('scanner');
                                                  },
                                                }
                                              : isOpen
                                              ? {
                                                  label: 'Resume Scanner',
                                                  icon: Camera,
                                                  isPrimary: true,
                                                  onClick: () => {
                                                    if (onStartSession) onStartSession(sec);
                                                    else onNavigate('scanner');
                                                  },
                                                }
                                              : {
                                                  label: 'Start Attendance',
                                                  icon: Camera,
                                                  isPrimary: true,
                                                  onClick: () => {
                                                    if (onStartSession) onStartSession(sec);
                                                    else onNavigate('scanner');
                                                  },
                                                },
                                            { isDivider: true },
                                            {
                                              label: 'Class List & Attendance',
                                              icon: Users,
                                              onClick: () => handleOpenSectionDetail(sec),
                                            },
                                            {
                                              label: 'Attendance Report',
                                              icon: FileText,
                                              onClick: () => onNavigate('section_report'),
                                            },
                                          ];
                                        } else if (role === 'student') {
                                          return [
                                            {
                                              label: 'Class List',
                                              icon: Users,
                                              onClick: () => handleOpenSectionDetail(sec),
                                            },
                                          ];
                                        } else {
                                          // ADMIN: View Details, Attendance Report, Edit, Delete (NO SCANNER)
                                          return [
                                            {
                                              label: 'View Details',
                                              icon: Eye,
                                              onClick: () => handleOpenSectionDetail(sec),
                                            },
                                            {
                                              label: 'Attendance Report',
                                              icon: FileText,
                                              onClick: () => onNavigate('section_report'),
                                            },
                                            {
                                              label: 'Edit Section',
                                              icon: Edit2,
                                              onClick: () => handleOpenEditSection(sec),
                                            },
                                            { isDivider: true },
                                            {
                                              label: 'Delete Section',
                                              icon: Trash2,
                                              isDanger: true,
                                              onClick: () => handleDeleteSection(sec.id, sec.name),
                                            },
                                          ];
                                        }
                                      })()}
                                    />
                                  </td>
                                </>
                              )}
                            </tr>
                          );
                        })}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* VIEW 2: TIMETABLE GRID */
        <div className="card mb-3" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
          <div className="card-header" style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="card-title" style={{ fontSize: '15px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Calendar size={18} style={{ color: 'var(--primary)' }} />
              Weekly Class Schedule Graph
            </span>
            <span className="badge badge-info" style={{ fontWeight: '600' }}>
              {schedules.length} Scheduled Meeting{schedules.length !== 1 ? 's' : ''} / Week
            </span>
          </div>

          <div style={{ padding: '18px', overflowX: 'auto' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '12px', minWidth: '700px' }}>
              {daysOfWeek.map((dayName) => {
                const dayShort = dayName.slice(0, 3);
                const daySchedules = schedules.filter(
                  (s) =>
                    (s.day_of_week && s.day_of_week.toLowerCase() === dayShort.toLowerCase()) ||
                    (s.day_2 && s.day_2.toLowerCase() === dayShort.toLowerCase())
                );
                return (
                  <div
                    key={dayName}
                    style={{
                      background: 'var(--bg-secondary)',
                      borderRadius: 'var(--radius)',
                      border: '1px solid var(--border)',
                      padding: '12px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                    }}
                  >
                    <div style={{ fontWeight: '700', fontSize: '13px', borderBottom: '1px solid var(--border)', paddingBottom: '6px', color: 'var(--text-primary)' }}>
                      {dayName}
                    </div>
                    {daySchedules.length === 0 ? (
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)', padding: '16px 0', textAlign: 'center' }}>
                        No classes
                      </div>
                    ) : (
                      daySchedules.map((sch) => {
                        const schParts = formatSchoolScheduleParts(sch);
                        return (
                          <div
                            key={sch.id}
                            style={{
                              padding: '8px 10px',
                              background: 'var(--accent-light)',
                              borderLeft: '3px solid var(--accent)',
                              borderRadius: 'var(--radius-sm)',
                              fontSize: '12px',
                            }}
                          >
                            <div style={{ fontWeight: '700', color: 'var(--text-primary)' }}>{sch.section_name}</div>
                            <div style={{ color: 'var(--text-primary)', fontWeight: '600', fontSize: '10.5px', marginTop: '2px' }}>
                              {schParts.time || schParts.fullTime}
                            </div>
                            <div style={{ color: 'var(--text-secondary)', fontSize: '10px', marginTop: '1px' }}>
                              {schParts.room || sch.room || 'TBA'}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ─── ADD CLASS SECTION MODAL (Exact Copycat of section_form.html) ─── */}
      {showAddModal && (
        <div
          className="modal-backdrop open"
          style={{ display: 'flex', opacity: 1, zIndex: 1200 }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowAddModal(false);
          }}
        >
          <div className="modal-card modal-md" style={{ width: '100%', maxWidth: '560px', background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-xl)', overflow: 'hidden', border: '1px solid var(--border)' }}>
            <div className="modal-header" style={{ padding: '18px 22px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <h3 className="modal-title" style={{ fontSize: '16px', fontWeight: '700', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Building size={18} style={{ color: 'var(--primary)' }} />
                  <span>Add Class Section</span>
                </h3>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                  Define program, section code, academic year, and teacher
                </div>
              </div>
              <button
                type="button"
                className="btn btn-outline btn-sm modal-close-btn"
                onClick={() => setShowAddModal(false)}
                style={{ padding: '4px', border: 'none', background: 'none', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateSection}>
              <div className="modal-body" style={{ padding: '22px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {errorMsg && (
                  <div className="alert alert-danger" style={{ fontSize: '13px', padding: '10px 14px' }}>
                    {errorMsg}
                  </div>
                )}

                <div className="form-group">
                  <label className="form-label" style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '6px' }}>
                    Academic Program *
                  </label>
                  <select
                    className="form-select"
                    value={formData.program}
                    onChange={(e) => {
                      const newProg = e.target.value;
                      setFormData({ ...formData, program: newProg });
                    }}
                    required
                  >
                    <option value="">Select program...</option>
                    {programs.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.code} - {p.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 1. Pick from Section Catalog (Master Cohort) */}
                {catalogSections.length > 0 && (
                  <div className="form-group" style={{ background: 'var(--bg-secondary)', padding: '12px 14px', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                    <label className="form-label" style={{ display: 'block', fontSize: '12px', fontWeight: '700', marginBottom: '4px', color: 'var(--text-primary)' }}>
                      Choose from Section Catalog (Master Batch)
                    </label>
                    <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginBottom: '8px' }}>
                      Selecting a saved section auto-populates its name, course, college, and year level.
                    </div>
                    <select
                      className="form-select"
                      value={formData.program_section}
                      onChange={(e) => {
                        const catId = e.target.value;
                        if (catId) {
                          const cat = catalogSections.find((c) => String(c.id) === String(catId));
                          if (cat) {
                            setFormData({
                              ...formData,
                              program_section: cat.id,
                              name: cat.name,
                              program: cat.program || cat.program_details?.id || formData.program,
                              course: cat.course || formData.course,
                              year_level: cat.year_level || formData.year_level,
                            });
                          }
                        } else {
                          setFormData({ ...formData, program_section: '' });
                        }
                      }}
                    >
                      <option value="">-- Choose catalog section (e.g. IT-43) or type custom below --</option>
                      {catalogSections
                        .filter((c) => !formData.program || String(c.program) === String(formData.program) || String(c.program_details?.id) === String(formData.program))
                        .map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name} ({c.course ? c.course + ' • ' : ''}{c.year_level_display || `${c.year_level} Year`} • {c.program_details?.code || 'Catalog'})
                          </option>
                        ))}
                    </select>
                  </div>
                )}

                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label" style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '6px' }}>
                      Section Name / Code *
                    </label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g. IT-43, BSCS-2A"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label" style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '6px' }}>
                      Course / Degree Program (e.g. BSIT, CS)
                    </label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g. BSIT, BSCS, BSA"
                      value={formData.course}
                      onChange={(e) => setFormData({ ...formData, course: e.target.value })}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                  <div className="form-group">
                    <label className="form-label" style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '6px' }}>
                      Year Level *
                    </label>
                    <select
                      className="form-select"
                      value={formData.year_level}
                      onChange={(e) => setFormData({ ...formData, year_level: e.target.value })}
                      required
                    >
                      <option value="1">1st Year</option>
                      <option value="2">2nd Year</option>
                      <option value="3">3rd Year</option>
                      <option value="4">4th Year</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label" style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '6px' }}>
                      School Year *
                    </label>
                    <input
                      type="text"
                      className="form-control"
                      value={formData.school_year}
                      onChange={(e) => setFormData({ ...formData, school_year: e.target.value })}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label" style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '6px' }}>
                      Semester / Term *
                    </label>
                    <select
                      className="form-select"
                      value={formData.semester}
                      onChange={(e) => setFormData({ ...formData, semester: e.target.value })}
                      required
                    >
                      <option value="1st">1st Semester</option>
                      <option value="2nd">2nd Semester</option>
                      <option value="summer">Summer Term</option>
                    </select>
                  </div>
                </div>

                <div style={{ fontSize: '12px', color: 'var(--text-muted)', background: 'var(--bg-secondary)', padding: '10px 14px', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                  💡 <strong>Pure Cohort Container:</strong> Creating a section establishes the student batch. Subjects and instructors are linked individually in the <strong>Subjects</strong> module.
                </div>
              </div>

              <div className="modal-footer" style={{ padding: '14px 22px', background: 'var(--bg-secondary)', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" className="btn btn-outline" onClick={() => setShowAddModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  <Check size={16} />
                  <span>{submitting ? 'Creating...' : 'Create Section'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── SECTION DETAIL / ROSTER MODAL ─── */}
      {selectedSectionDetail && (
        <div
          className="modal-backdrop open"
          style={{ display: 'flex', opacity: 1, zIndex: 1200 }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedSectionDetail(null);
          }}
        >
          <div className="modal-card modal-lg" style={{ width: '100%', maxWidth: '780px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-xl)', overflow: 'hidden', border: '1px solid var(--border)' }}>
            <div className="modal-header" style={{ padding: '18px 22px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
              <div>
                <h3 className="modal-title" style={{ fontSize: '16px', fontWeight: '700', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Layers size={18} style={{ color: 'var(--primary)' }} />
                  <span>{selectedSectionDetail.name}</span>
                </h3>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                  {selectedSectionDetail.program_details?.code || selectedSectionDetail.program?.code || 'CITEC'} •{' '}
                  {selectedSectionDetail.year_level_display || `${selectedSectionDetail.year_level || 1}st Year`} •{' '}
                  {selectedSectionDetail.school_year} ({selectedSectionDetail.semester})
                </div>
              </div>
              <button
                type="button"
                className="btn btn-outline btn-sm modal-close-btn"
                onClick={() => setSelectedSectionDetail(null)}
                style={{ padding: '4px', border: 'none', background: 'none', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <div className="modal-body" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto' }}>
              {/* KPI Cards */}
              <div className="stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                <div className="stat-card" style={{ padding: '10px 14px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Subjects</div>
                  <div style={{ fontSize: '16px', fontWeight: '800', marginTop: '2px', color: 'var(--text-primary)' }}>
                    {selectedSectionDetail.subjects?.length || (selectedSectionDetail.subject ? 1 : 0)} Subjects
                  </div>
                </div>
                <div className="stat-card" style={{ padding: '10px 14px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Meeting Schedules</div>
                  <div style={{ fontSize: '16px', fontWeight: '800', marginTop: '2px', color: 'var(--text-primary)' }}>
                    {schedules.filter((s) => s.section === selectedSectionDetail.id).length} Meetings / Wk
                  </div>
                </div>
                <div className="stat-card blue" style={{ padding: '10px 14px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Total Students Enrolled</div>
                  <div style={{ fontSize: '18px', fontWeight: '800', marginTop: '2px', color: 'var(--info)' }}>
                    {sectionEnrollments.length || selectedSectionDetail.student_count || 0}
                  </div>
                </div>
              </div>

              {/* SECTION 1: SUBJECTS */}
              <div style={{ background: 'var(--bg-secondary)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', padding: '14px 16px' }}>
                <h4 style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <BookOpen size={15} style={{ color: 'var(--primary)' }} /> Subjects ({selectedSectionDetail.subjects?.length || 0})
                </h4>
                {(!selectedSectionDetail.subjects || selectedSectionDetail.subjects.length === 0) ? (
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>No subjects added to this section yet.</div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '10px' }}>
                    {selectedSectionDetail.subjects.map((sub) => {
                      const tName = sub.teacher_details?.user
                        ? `${sub.teacher_details.user.first_name} ${sub.teacher_details.user.last_name}`
                        : 'Unassigned / TBA';
                      return (
                        <div key={sub.id} style={{ background: 'var(--bg-card)', padding: '10px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                            <span className="badge badge-accent" style={{ fontWeight: '700', fontSize: '11px' }}>{sub.code}</span>
                            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{sub.units || 3} Units</span>
                          </div>
                          <div style={{ fontWeight: '600', fontSize: '12.5px', color: 'var(--text-primary)', marginBottom: '4px' }}>{sub.name}</div>
                          <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <span>Instructor:</span> <strong style={{ color: 'var(--text-secondary)' }}>{tName}</strong>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* SECTION 2: CLASS MEETING TIMETABLE */}
              <div style={{ background: 'var(--bg-secondary)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', padding: '14px 16px' }}>
                <h4 style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '10px' }}>
                  Class Meeting Schedules
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {schedules.filter((s) => s.section === selectedSectionDetail.id).length === 0 ? (
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                      No meeting schedules assigned yet.
                    </div>
                  ) : (
                    schedules
                      .filter((s) => s.section === selectedSectionDetail.id)
                      .map((sch) => {
                        const schParts = formatSchoolScheduleParts(sch);
                        return (
                          <div
                            key={sch.id}
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              padding: '8px 12px',
                              background: 'var(--bg-card)',
                              borderRadius: 'var(--radius-sm)',
                              fontSize: '12.5px',
                              border: '1px solid var(--border)',
                            }}
                          >
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                              {(schParts.timeLines || [schParts.fullTime]).map((tl, tIdx) => (
                                <span key={tIdx} style={{ fontWeight: '600', fontSize: '11px', color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                                  {tl}
                                </span>
                              ))}
                              {schParts.room && (
                                <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: '500', whiteSpace: 'nowrap' }}>
                                  {schParts.room}
                                </span>
                              )}
                            </div>
                            <span className="badge badge-accent" style={{ fontSize: '11px', fontWeight: '600' }}>
                              {sch.subject_code || 'Subject'}
                            </span>
                          </div>
                        );
                      })
                  )}
                </div>
              </div>

              {/* SECTION 3: CLASS ROSTER & ENROLLMENT (REGULAR + IRREGULAR) */}
              <div style={{ background: 'var(--bg-secondary)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', padding: '14px 16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <h4 style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-secondary)', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Users size={15} style={{ color: 'var(--primary)' }} /> Class Roster ({sectionEnrollments.length} Enrolled)
                  </h4>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <span className="badge badge-info" style={{ fontSize: '11px' }}>
                      {sectionEnrollments.filter((e) => !e.is_irregular).length} Block Regular
                    </span>
                    <span className="badge badge-accent" style={{ fontSize: '11px' }}>
                      {sectionEnrollments.filter((e) => e.is_irregular).length} Irregular
                    </span>
                  </div>
                </div>

                {loadingEnrollments ? (
                  <div style={{ textAlign: 'center', padding: '18px', color: 'var(--text-muted)', fontSize: '12px' }}>Loading roster...</div>
                ) : sectionEnrollments.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '14px', color: 'var(--text-muted)', fontSize: '12px' }}>
                    No students currently enrolled in this section.
                  </div>
                ) : (
                  <div style={{ maxHeight: '220px', overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', background: 'var(--bg-card)' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                      <thead>
                        <tr style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)', textAlign: 'left' }}>
                          <th style={{ padding: '8px 12px', fontWeight: '600', color: 'var(--text-secondary)' }}>Student Name</th>
                          <th style={{ padding: '8px 12px', fontWeight: '600', color: 'var(--text-secondary)' }}>ID Number</th>
                          <th style={{ padding: '8px 12px', fontWeight: '600', color: 'var(--text-secondary)' }}>Enrollment Scope</th>
                          <th style={{ padding: '8px 12px', fontWeight: '600', color: 'var(--text-secondary)' }}>Face Status</th>
                          {isAdmin && <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: '600', color: 'var(--text-secondary)' }}>Action</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {sectionEnrollments.map((enr) => {
                          const st = enr.student_details || {};
                          const u = st.user || {};
                          const fullName = `${u.first_name || ''} ${u.last_name || ''}`.trim() || st.student_id;
                          const isFace = !!st.is_face_enrolled;
                          return (
                            <tr key={enr.id} style={{ borderBottom: '1px solid var(--border)' }}>
                              <td style={{ padding: '8px 12px' }}>
                                <strong>{fullName}</strong>
                                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{st.course || 'BSIT'}</div>
                              </td>
                              <td style={{ padding: '8px 12px', color: 'var(--text-secondary)' }}>
                                {st.student_id}
                              </td>
                              <td style={{ padding: '8px 12px' }}>
                                {enr.is_irregular ? (
                                  <span className="badge badge-accent" style={{ fontSize: '10.5px', padding: '2px 6px' }}>
                                    Irregular • {enr.subject_details?.code || 'Specific Subject'}
                                  </span>
                                ) : (
                                  <span className="badge badge-info" style={{ fontSize: '10.5px', padding: '2px 6px' }}>
                                    Block / Regular
                                  </span>
                                )}
                              </td>
                              <td style={{ padding: '8px 12px' }}>
                                {isFace ? (
                                  <span className="badge badge-success" style={{ fontSize: '10px', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                                    <CheckCircle size={10} /> Enrolled
                                  </span>
                                ) : (
                                  <span className="badge badge-warning" style={{ fontSize: '10px', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                                    <AlertTriangle size={10} /> Missing
                                  </span>
                                )}
                              </td>
                              {isAdmin && (
                                <td style={{ padding: '8px 12px', textAlign: 'right' }}>
                                  <button
                                    type="button"
                                    onClick={() => handleUnenrollStudent(enr.id)}
                                    style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', padding: '4px' }}
                                    title="Remove student from section"
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                </td>
                              )}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Admin Quick-Enroll Form */}
                {isAdmin && (
                  <form onSubmit={handleEnrollSubmit} style={{ marginTop: '12px', padding: '12px', background: 'var(--bg-card)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                    <div style={{ fontSize: '12px', fontWeight: '700', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <UserPlus size={14} style={{ color: 'var(--primary)' }} /> Enroll Student into this Section
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: enrollType === 'irregular' ? '1.5fr 1.2fr 1.2fr auto' : '2fr 1.5fr auto', gap: '8px', alignItems: 'flex-end' }}>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label" style={{ fontSize: '11px', marginBottom: '3px' }}>Select Student *</label>
                        <select
                          className="form-select"
                          style={{ fontSize: '12px', padding: '6px 8px' }}
                          value={enrollStudentId}
                          onChange={(e) => setEnrollStudentId(e.target.value)}
                          required
                        >
                          <option value="">Choose student...</option>
                          {allStudents.map((s) => {
                            const name = `${s.user?.first_name || ''} ${s.user?.last_name || ''}`.trim() || s.student_id;
                            return (
                              <option key={s.id} value={s.id}>
                                {name} ({s.student_id}) - {s.course}
                              </option>
                            );
                          })}
                        </select>
                      </div>

                      <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label" style={{ fontSize: '11px', marginBottom: '3px' }}>Enrollment Type *</label>
                        <select
                          className="form-select"
                          style={{ fontSize: '12px', padding: '6px 8px' }}
                          value={enrollType}
                          onChange={(e) => setEnrollType(e.target.value)}
                        >
                          <option value="regular">Regular Block (All Subjects)</option>
                          <option value="irregular">Irregular (Back/Advance Subject)</option>
                        </select>
                      </div>

                      {enrollType === 'irregular' && (
                        <div className="form-group" style={{ margin: 0 }}>
                          <label className="form-label" style={{ fontSize: '11px', marginBottom: '3px' }}>Target Subject *</label>
                          <select
                            className="form-select"
                            style={{ fontSize: '12px', padding: '6px 8px' }}
                            value={enrollSubjectId}
                            onChange={(e) => setEnrollSubjectId(e.target.value)}
                            required
                          >
                            <option value="">Select subject...</option>
                            {(selectedSectionDetail.subjects || []).map((sub) => (
                              <option key={sub.id} value={sub.id}>
                                {sub.code} - {sub.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      <button
                        type="submit"
                        className="btn btn-primary"
                        style={{ padding: '7px 14px', fontSize: '12px', height: '34px', whiteSpace: 'nowrap' }}
                        disabled={enrolling}
                      >
                        <Plus size={13} /> {enrolling ? 'Enrolling...' : 'Enroll'}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </div>

            <div className="modal-footer" style={{ padding: '14px 22px', background: 'var(--bg-secondary)', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: '10px', flexShrink: 0 }}>
              {role === 'teacher' && (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => {
                    const sec = selectedSectionDetail;
                    setSelectedSectionDetail(null);
                    if (onStartSession) onStartSession(sec);
                    else onNavigate('scanner');
                  }}
                >
                  <Camera size={14} /> <span>Open Attendance Scanner</span>
                </button>
              )}
              <button type="button" className="btn btn-outline" onClick={() => setSelectedSectionDetail(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Section Modal */}
      {editingSection && (
        <div
          className="modal-backdrop open"
          style={{ display: 'flex', opacity: 1, zIndex: 1200 }}
          onClick={(e) => { if (e.target === e.currentTarget) setEditingSection(null); }}
        >
          <div className="modal-card modal-md" style={{ width: '100%', maxWidth: '560px', background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-xl)', overflow: 'hidden', border: '1px solid var(--border)' }}>
            <div className="modal-header" style={{ padding: '18px 22px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <h3 className="modal-title" style={{ fontSize: '16px', fontWeight: '700', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Edit2 size={18} style={{ color: 'var(--primary)' }} />
                  <span>Edit Class Section</span>
                </h3>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>Update section details and assignment</div>
              </div>
              <button type="button" className="btn btn-outline btn-sm modal-close-btn" onClick={() => setEditingSection(null)} style={{ padding: '4px', border: 'none', background: 'none', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleEditSectionSubmit}>
              <div className="modal-body" style={{ padding: '22px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {editErrorMsg && (
                  <div className="alert alert-danger" style={{ fontSize: '13px', padding: '10px 14px' }}>{editErrorMsg}</div>
                )}
                <div className="form-group">
                  <label className="form-label" style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '6px' }}>Academic Program *</label>
                  <select className="form-select" value={editFormData.program} onChange={(e) => setEditFormData({ ...editFormData, program: e.target.value })} required>
                    <option value="">Select program...</option>
                    {programs.map((p) => (<option key={p.id} value={p.id}>{p.code} - {p.name}</option>))}
                  </select>
                </div>
                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label" style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '6px' }}>Section Name / Code *</label>
                    <input type="text" className="form-control" placeholder="e.g. IT-43, BSCS-2A" value={editFormData.name} onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })} required />
                  </div>
                  <div className="form-group">
                    <label className="form-label" style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '6px' }}>Course (e.g. BSIT, CS)</label>
                    <input type="text" className="form-control" placeholder="e.g. BSIT, BSCS, BSA" value={editFormData.course} onChange={(e) => setEditFormData({ ...editFormData, course: e.target.value })} />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                  <div className="form-group">
                    <label className="form-label" style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '6px' }}>Year Level *</label>
                    <select className="form-select" value={editFormData.year_level} onChange={(e) => setEditFormData({ ...editFormData, year_level: e.target.value })} required>
                      <option value="1">1st Year</option>
                      <option value="2">2nd Year</option>
                      <option value="3">3rd Year</option>
                      <option value="4">4th Year</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label" style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '6px' }}>School Year *</label>
                    <input type="text" className="form-control" value={editFormData.school_year} onChange={(e) => setEditFormData({ ...editFormData, school_year: e.target.value })} required />
                  </div>
                  <div className="form-group">
                    <label className="form-label" style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '6px' }}>Semester / Term *</label>
                    <select className="form-select" value={editFormData.semester} onChange={(e) => setEditFormData({ ...editFormData, semester: e.target.value })} required>
                      <option value="1st">1st Semester</option>
                      <option value="2nd">2nd Semester</option>
                      <option value="summer">Summer Term</option>
                    </select>
                  </div>
                </div>
              </div>
              <div className="modal-footer" style={{ padding: '14px 22px', background: 'var(--bg-secondary)', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" className="btn btn-outline" onClick={() => setEditingSection(null)}>Cancel</button>
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
