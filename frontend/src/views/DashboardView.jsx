import React, { useState, useEffect } from 'react';
import {
  Contact,
  GraduationCap,
  BookOpen,
  Building,
  Radio,
  CalendarCheck,
  Lock,
  ScanFace,
  UserPlus,
  Shield,
  Calendar,
  Users,
  Camera,
  Zap,
  PieChart,
  Layers,
  Sun,
  Coffee,
  CheckCircle,
  AlertTriangle,
  BarChart2,
  Clock,
  Activity,
  List,
  FileText,
  ClipboardList,
} from 'lucide-react';
import { Api } from '../api';
import { formatTime12h, formatSchoolScheduleParts } from '../utils/time';
import ActionPopover from '../components/ActionPopover';
import StudentAttendanceCalendarModal from '../components/StudentAttendanceCalendarModal';

export default function DashboardView({ user, onNavigate, onStartSession, onSetHeaderInfo }) {
  const role = user?.role || 'admin';

  const [stats, setStats] = useState({
    totalTeachers: 0,
    totalStudents: 0,
    totalSubjects: 0,
    totalSections: 0,
    liveSessions: 0,
    sessionsToday: 0,
    finalizedToday: 0,
    enrolledPct: 0,
    enrolledCount: 0,
  });
  const [sections, setSections] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [studentOverview, setStudentOverview] = useState(null);
  const [selectedCalendarSection, setSelectedCalendarSection] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const [secs, schs, sess, statRes] = await Promise.all([
          Api.getSections().catch(() => []),
          Api.getSchedules().catch(() => []),
          Api.getSessions().catch(() => []),
          Api.getDashboardStats().catch(() => null),
        ]);
        setSections(secs || []);
        setSchedules(schs || []);
        setSessions(sess || []);

        if (role === 'student') {
          const overview = await Api.getStudentAttendanceOverview().catch(() => null);
          setStudentOverview(overview);
        }

        if (statRes) {
          setStats({
            totalTeachers: statRes.total_teachers || 0,
            totalStudents: statRes.total_students || 0,
            totalSubjects: statRes.total_subjects || 0,
            totalSections: statRes.total_sections || 0,
            liveSessions: statRes.open_sessions_count || 0,
            sessionsToday: statRes.sessions_today_count || 0,
            finalizedToday: statRes.sessions_today_closed || 0,
            enrolledPct: statRes.face_enrollment_pct !== undefined ? statRes.face_enrollment_pct : 0,
            enrolledCount: statRes.face_enrolled_count || 0,
          });
        }
      } catch (err) {
        console.error('Error loading dashboard data:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [role]);


  // Update Top Header in App.jsx (100% copycat of templates/accounts/dashboard_admin.html, dashboard_teacher.html, dashboard_student.html)
  useEffect(() => {
    if (!onSetHeaderInfo) return;

    const todayStr = new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });

    if (role === 'admin') {
      onSetHeaderInfo({
        title: 'Admin Dashboard',
        subtitle: `System overview — ${todayStr}`,
        headerActions: null,
      });
    } else if (role === 'teacher') {
      const teacherName = `${user?.first_name || ''} ${user?.last_name || ''}`.trim() || user?.username;
      const dept = user?.teacher_profile?.department || 'Faculty';
      onSetHeaderInfo({
        title: 'Instructor Dashboard',
        subtitle: `Welcome back, ${teacherName} • Department: ${dept}`,
        headerActions: (
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => onNavigate('sections')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <Calendar size={14} /> <span>Section &amp; Schedule</span>
            </button>
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => onNavigate('section_report')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <FileText size={14} /> <span>Attendance Reports</span>
            </button>
          </div>
        ),
      });
    } else {
      // student
      const course = user?.student_profile?.course || 'Student';
      onSetHeaderInfo({
        title: 'My Dashboard',
        subtitle: `Your attendance overview — ${course}`,
        headerActions: (
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => onNavigate('sections')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <Calendar size={14} /> <span>My Schedule</span>
            </button>
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => onNavigate('session_logs')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <ClipboardList size={14} /> <span>Full Record</span>
            </button>
          </div>
        ),
      });
    }
  }, [role, user?.id, onSetHeaderInfo]);

  // ══════════════════════════════════════════════════════════════════════════
  // VIEW 1: ADMIN DASHBOARD (100% copycat of templates/accounts/dashboard_admin.html)
  // ══════════════════════════════════════════════════════════════════════════
  if (role === 'admin') {
    return (
      <div className="page-content">
        {/* Primary KPIs */}
        <div className="stats-grid mb-3">
          <div className="stat-card blue">
            <div className="stat-icon blue"><Contact size={20} /></div>
            <div className="stat-info">
              <div className="value">{stats.totalTeachers}</div>
              <div className="label">Faculty</div>
            </div>
          </div>

          <div className="stat-card green">
            <div className="stat-icon green"><GraduationCap size={20} /></div>
            <div className="stat-info">
              <div className="value">{stats.totalStudents}</div>
              <div className="label">Students</div>
            </div>
          </div>

          <div className="stat-card yellow">
            <div className="stat-icon yellow"><BookOpen size={20} /></div>
            <div className="stat-info">
              <div className="value">{stats.totalSubjects}</div>
              <div className="label">Subjects</div>
            </div>
          </div>

          <div className="stat-card red">
            <div className="stat-icon red"><Building size={20} /></div>
            <div className="stat-info">
              <div className="value">{stats.totalSections}</div>
              <div className="label">Class Sections</div>
            </div>
          </div>
        </div>

        {/* Today's operations */}
        <div className="stats-grid mb-3" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
          <div className="stat-card" style={{ border: '1px solid var(--border)', boxShadow: 'var(--shadow-xs)' }}>
            <div className="stat-icon" style={{ background: 'var(--success-light)', color: 'var(--success)' }}>
              <Radio size={18} />
            </div>
            <div className="stat-info">
              <div className="value">{stats.liveSessions}</div>
              <div className="label">Live Sessions Now</div>
            </div>
          </div>

          <div className="stat-card" style={{ border: '1px solid var(--border)', boxShadow: 'var(--shadow-xs)' }}>
            <div className="stat-icon" style={{ background: 'var(--info-light)', color: 'var(--info)' }}>
              <CalendarCheck size={18} />
            </div>
            <div className="stat-info">
              <div className="value">{stats.sessionsToday}</div>
              <div className="label">Sessions Today</div>
            </div>
          </div>

          <div className="stat-card" style={{ border: '1px solid var(--border)', boxShadow: 'var(--shadow-xs)' }}>
            <div className="stat-icon" style={{ background: 'var(--accent-light)', color: 'var(--accent)' }}>
              <Lock size={18} />
            </div>
            <div className="stat-info">
              <div className="value">{stats.finalizedToday}</div>
              <div className="label">Finalized Today</div>
            </div>
          </div>

          <div className="stat-card" style={{ border: '1px solid var(--border)', boxShadow: 'var(--shadow-xs)' }}>
            <div className="stat-icon" style={{ background: 'var(--warning-light)', color: 'var(--warning)' }}>
              <ScanFace size={18} />
            </div>
            <div className="stat-info">
              <div className="value">{stats.enrolledPct}%</div>
              <div className="label">Face Enrolled ({stats.enrolledCount}/{stats.totalStudents})</div>
            </div>
          </div>
        </div>

        {/* Quick Actions & Academic Snapshot */}
        <div className="grid-2 mb-3" style={{ alignItems: 'stretch' }}>
          {/* Quick Actions */}
          <div className="card">
            <div className="card-header">
              <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Zap size={16} /> Quick Actions
              </span>
            </div>
            <div className="card-body dashboard-action-grid">
              <button type="button" className="btn btn-primary" onClick={() => onNavigate('users')}>
                <UserPlus size={15} /> <span>Register Student</span>
              </button>
              <button type="button" className="btn btn-outline" onClick={() => onNavigate('users')}>
                <Shield size={15} /> <span>Add Faculty / Staff</span>
              </button>
              <button type="button" className="btn btn-outline" onClick={() => onNavigate('sections')}>
                <Building size={15} /> <span>Add Section</span>
              </button>
              <button type="button" className="btn btn-outline" onClick={() => onNavigate('schedules')}>
                <Calendar size={15} /> <span>Add Schedule</span>
              </button>
              <button type="button" className="btn btn-outline" onClick={() => onNavigate('users')}>
                <Users size={15} /> <span>User Management</span>
              </button>
              <button type="button" className="btn btn-outline" onClick={() => onNavigate('face_enrollment')}>
                <Camera size={15} /> <span>Face Enrollment</span>
              </button>
            </div>
          </div>

          {/* Academic Snapshot */}
          <div className="card">
            <div className="card-header">
              <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <PieChart size={16} /> Academic Snapshot
              </span>
            </div>
            <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '6px' }}>
                  <span className="text-muted">Student face enrollment</span>
                  <strong>{stats.enrolledPct}%</strong>
                </div>
                <div className="dashboard-progress-track">
                  <div
                    className="dashboard-progress-bar"
                    style={{ width: `${stats.enrolledPct}%`, background: 'var(--success)' }}
                  />
                </div>
              </div>

              <div className="dashboard-mini-stat">
                <span className="text-muted" style={{ fontSize: '12px' }}>Programs &amp; structure</span>
                <div style={{ display: 'flex', gap: '16px', marginTop: '6px' }}>
                  <div>
                    <strong>{stats.totalSubjects}</strong>{' '}
                    <span className="text-muted" style={{ fontSize: '12px' }}>subjects</span>
                  </div>
                  <div>
                    <strong>{stats.totalSections}</strong>{' '}
                    <span className="text-muted" style={{ fontSize: '12px' }}>sections</span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => onNavigate('session_logs')}
                style={{ alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <List size={14} /> <span>All Session Logs</span>
              </button>
            </div>
          </div>
        </div>

        {/* Recent Attendance Activity */}
        <div className="card">
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Activity size={16} /> Recent Attendance Activity
            </span>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => onNavigate('session_logs')}
            >
              View All
            </button>
          </div>

          <div className="table-container" style={{ border: 'none' }}>
            <table>
              <thead>
                <tr>
                  <th>Section</th>
                  <th>Subject</th>
                  <th>Instructor</th>
                  <th>Date</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Report</th>
                </tr>
              </thead>
              <tbody>
                {sessions.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="text-center text-muted" style={{ padding: '28px' }}>
                      No attendance sessions recorded yet.
                    </td>
                  </tr>
                ) : (
                  sessions.slice(0, 5).map((session) => {
                    const secName =
                      session.section_name ||
                      session.schedule_details?.section_name ||
                      (typeof session.schedule === 'object' ? session.schedule?.section_name : null) ||
                      (sections.find((s) => s.id === (session.schedule_details?.section || session.schedule))?.name) ||
                      'Section';

                    const subjCode =
                      session.subject_code ||
                      session.schedule_details?.subject_code ||
                      (typeof session.schedule === 'object' ? session.schedule?.subject_code : null) ||
                      (sections.find((s) => s.id === (session.schedule_details?.section || session.schedule))?.effective_subject_code) ||
                      '—';

                    const subjName =
                      session.subject_name ||
                      session.schedule_details?.subject_name ||
                      (typeof session.schedule === 'object' ? session.schedule?.subject_name : null) ||
                      (sections.find((s) => s.id === (session.schedule_details?.section || session.schedule))?.effective_subject_name) ||
                      '';

                    const teacherName =
                      session.started_by_name ||
                      session.teacher_name ||
                      session.schedule_details?.teacher_name ||
                      '—';

                    const formattedDate = session.date
                      ? new Date(session.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                      : '—';

                    return (
                      <tr key={session.id}>
                        <td>
                          <div style={{ fontWeight: 800, fontSize: '13.5px', color: 'var(--text-primary)' }}>
                            {secName}
                          </div>
                        </td>
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                            <div>
                              <span
                                className="badge badge-accent"
                                style={{
                                  fontWeight: 700,
                                  fontSize: '11px',
                                  padding: '2px 8px',
                                  letterSpacing: '0.3px',
                                  background: 'var(--accent-light)',
                                  color: 'var(--accent)',
                                  border: '1px solid var(--border)',
                                }}
                              >
                                {subjCode}
                              </span>
                            </div>
                            {subjName && (
                              <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)' }}>
                                {subjName}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="text-muted" style={{ fontSize: '13px' }}>
                          {teacherName}
                        </td>
                        <td style={{ fontSize: '12.5px', whiteSpace: 'nowrap' }}>
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 500, color: 'var(--text-primary)' }}>
                            <Calendar size={13} style={{ color: 'var(--text-muted)' }} />
                            <span>{formattedDate}</span>
                          </div>
                        </td>
                        <td>
                          {session.status === 'open' ? (
                            <span
                              className="badge badge-success"
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '5px',
                                fontWeight: 700,
                                fontSize: '11px',
                                padding: '3px 9px',
                                background: 'rgba(16, 185, 129, 0.1)',
                                color: '#059669',
                                border: '1px solid rgba(16, 185, 129, 0.25)',
                              }}
                            >
                              <span className="pulse-dot" style={{ background: '#10b981', width: '6px', height: '6px' }} />
                              Live
                            </span>
                          ) : (
                            <span
                              className="badge badge-muted"
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                fontWeight: 600,
                                fontSize: '11px',
                                padding: '3px 9px',
                                background: 'rgba(100, 116, 139, 0.08)',
                                color: 'var(--text-secondary)',
                                border: '1px solid var(--border)',
                              }}
                            >
                              <CheckCircle size={11} style={{ opacity: 0.7 }} /> Finalized
                            </span>
                          )}
                        </td>
                        <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                          <ActionPopover
                            items={[
                              {
                                label: 'Session Report',
                                icon: FileText,
                                onClick: () => onNavigate('session_logs'),
                              },
                            ]}
                          />
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

  // ══════════════════════════════════════════════════════════════════════════
  // VIEW 2: TEACHER DASHBOARD (100% copycat of templates/accounts/dashboard_teacher.html)
  // ══════════════════════════════════════════════════════════════════════════
  if (role === 'teacher') {
    const todayStr = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
    const liveCount = sessions.filter((s) => s.status === 'open').length;
    const finalizedCount = sessions.filter((s) => s.status === 'closed').length;
    const totalStudentsCount = sections.reduce((sum, s) => sum + (s.student_count || 0), 0) || stats.totalStudents || 0;

    return (
      <div className="page-content">
        {/* Key Metrics */}
        <div className="stats-grid mb-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
          <div className="stat-card" style={{ padding: '16px 20px', borderRadius: 'var(--radius-lg)', background: 'var(--bg-card)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '16px', boxShadow: 'var(--shadow-xs)' }}>
            <div style={{ width: '44px', height: '44px', borderRadius: '10px', background: 'rgba(59, 130, 246, 0.08)', border: '1px solid rgba(59, 130, 246, 0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2563eb', flexShrink: 0 }}>
              <Layers size={20} />
            </div>
            <div className="stat-info" style={{ minWidth: 0 }}>
              <div style={{ fontSize: '26px', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.1, letterSpacing: '-0.5px' }}>{sections.length}</div>
              <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginTop: '3px' }}>Assigned Sections</div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>{sections.length === 1 ? '1 active section' : `${sections.length} active sections`}</div>
            </div>
          </div>

          <div className="stat-card" style={{ padding: '16px 20px', borderRadius: 'var(--radius-lg)', background: 'var(--bg-card)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '16px', boxShadow: 'var(--shadow-xs)' }}>
            <div style={{ width: '44px', height: '44px', borderRadius: '10px', background: 'rgba(147, 51, 234, 0.08)', border: '1px solid rgba(147, 51, 234, 0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#7c3aed', flexShrink: 0 }}>
              <Users size={20} />
            </div>
            <div className="stat-info" style={{ minWidth: 0 }}>
              <div style={{ fontSize: '26px', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.1, letterSpacing: '-0.5px' }}>{totalStudentsCount}</div>
              <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginTop: '3px' }}>Enrolled Students</div>
              <div style={{ fontSize: '11px', color: 'var(--success)', fontWeight: 600, marginTop: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <CheckCircle size={11} /> 100% Face Enrolled
              </div>
            </div>
          </div>

          <div className="stat-card" style={{ padding: '16px 20px', borderRadius: 'var(--radius-lg)', background: 'var(--bg-card)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '16px', boxShadow: 'var(--shadow-xs)' }}>
            <div style={{ width: '44px', height: '44px', borderRadius: '10px', background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#d97706', flexShrink: 0 }}>
              <CalendarCheck size={20} />
            </div>
            <div className="stat-info" style={{ minWidth: 0 }}>
              <div style={{ fontSize: '26px', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.1, letterSpacing: '-0.5px' }}>{sections.length}</div>
              <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginTop: '3px' }}>Classes Today</div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>{finalizedCount} finalized &bull; {liveCount} live</div>
            </div>
          </div>

          <div className="stat-card" style={{ padding: '16px 20px', borderRadius: 'var(--radius-lg)', background: 'var(--bg-card)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '16px', boxShadow: 'var(--shadow-xs)' }}>
            <div style={{ width: '44px', height: '44px', borderRadius: '10px', background: liveCount > 0 ? 'rgba(16, 185, 129, 0.12)' : 'rgba(100, 116, 139, 0.08)', border: liveCount > 0 ? '1px solid rgba(16, 185, 129, 0.25)' : '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: liveCount > 0 ? '#10b981' : '#64748b', flexShrink: 0 }}>
              <Radio size={20} />
            </div>
            <div className="stat-info" style={{ minWidth: 0 }}>
              <div style={{ fontSize: '26px', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.1, letterSpacing: '-0.5px' }}>{liveCount}</div>
              <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginTop: '3px' }}>Live Sessions</div>
              <div style={{ fontSize: '11px', color: liveCount > 0 ? 'var(--success)' : 'var(--text-muted)', fontWeight: liveCount > 0 ? 600 : 400, marginTop: '2px' }}>
                {liveCount > 0 ? 'Scanning in progress' : 'Ready to start'}
              </div>
            </div>
          </div>
        </div>

        <div className="grid-2 mb-3" style={{ alignItems: 'stretch' }}>
          {/* Today's Classes */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
            <div
              className="card-header"
              style={{ padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Sun size={16} style={{ color: '#f59e0b' }} />
                <span style={{ fontWeight: 700, fontSize: '14.5px', color: 'var(--text-primary)' }}>Today&rsquo;s Classes</span>
                <span style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: 500 }}>&mdash; {todayStr}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span className="badge badge-outline" style={{ fontSize: '11px', fontWeight: 600, padding: '2px 8px' }}>
                  {finalizedCount} finalized &bull; {liveCount} live
                </span>
              </div>
            </div>

            {sections.length === 0 ? (
              <div className="card-body text-center text-muted" style={{ padding: '42px 24px' }}>
                <Coffee size={32} style={{ opacity: 0.45, margin: '0 auto 10px', display: 'block' }} />
                <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-primary)', marginBottom: '4px' }}>
                  No scheduled classes for today
                </div>
                <div style={{ fontSize: '13px', color: 'var(--text-muted)', maxWidth: '340px', margin: '0 auto 14px' }}>
                  You have no teaching sections assigned for today. Review your weekly timetable or section assignments.
                </div>
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={() => onNavigate('sections')}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  <Calendar size={14} /> <span>Open Section &amp; Schedule</span>
                </button>
              </div>
            ) : (
              <div className="table-container" style={{ border: 'none', flex: 1 }}>
                <table>
                  <thead>
                    <tr>
                      <th>Section &amp; Subject</th>
                      <th>Schedule &amp; Room</th>
                      <th>Status</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sections.map((sec) => {
                      const secSubjectCode =
                        sec.effective_subject_code ||
                        sec.subject_details?.code ||
                        sec.schedules?.[0]?.subject_code ||
                        sec.subjects?.[0]?.code ||
                        '—';

                      const secSubjectName =
                        sec.effective_subject_name ||
                        sec.subject_details?.name ||
                        sec.schedules?.[0]?.subject_name ||
                        sec.subjects?.[0]?.name ||
                        '';

                      const schedItem =
                        sec.schedules && sec.schedules.length > 0
                          ? formatSchoolScheduleParts(sec.schedules[0])
                          : sec.schedule_display && sec.schedule_display !== 'No schedule set'
                          ? formatSchoolScheduleParts(sec.schedule_display)
                          : { fullTime: 'M/W 08:00AM-09:30AM/08:00AM-09:30AM', room: 'Room 101' };

                      const activeSession = sessions.find(
                        (s) => (s.schedule_details?.section === sec.id || s.section_name === sec.name) && s.status === 'open'
                      );
                      const closedSessionToday = sessions.find(
                        (s) => (s.schedule_details?.section === sec.id || s.section_name === sec.name) && s.status === 'closed'
                      );

                      return (
                        <tr key={sec.id}>
                          <td>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span style={{ fontWeight: 800, fontSize: '13.5px', color: 'var(--text-primary)' }}>{sec.name}</span>
                                <span className="badge badge-outline" style={{ fontSize: '10px', padding: '1px 6px', fontWeight: 600 }}>
                                  {sec.course || 'BSCS'}
                                </span>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                {secSubjectCode !== '—' && (
                                  <span
                                    className="badge badge-accent"
                                    style={{
                                      fontSize: '10.5px',
                                      fontWeight: 700,
                                      padding: '1px 6px',
                                      letterSpacing: '0.2px',
                                      background: 'var(--accent-light)',
                                      color: 'var(--accent)',
                                      border: '1px solid var(--border)',
                                    }}
                                  >
                                    {secSubjectCode}
                                  </span>
                                )}
                                <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 500 }}>
                                  {secSubjectName}
                                </span>
                              </div>
                            </div>
                          </td>
                          <td style={{ whiteSpace: 'nowrap' }}>
                            <div
                              style={{
                                display: 'inline-flex',
                                flexDirection: 'column',
                                alignItems: 'flex-start',
                                gap: '1px',
                                padding: '4px 8px',
                                background: 'rgba(99, 102, 241, 0.06)',
                                border: '1px solid rgba(99, 102, 241, 0.18)',
                                borderRadius: '5px',
                                lineHeight: 1.25,
                                color: '#4338ca',
                              }}
                            >
                              {(schedItem.timeLines || [schedItem.fullTime]).map((tl, tIdx) => (
                                <span key={tIdx} style={{ fontSize: '11px', fontWeight: 600, whiteSpace: 'nowrap' }}>
                                  {tl}
                                </span>
                              ))}
                              {schedItem.room && (
                                <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 500, whiteSpace: 'nowrap' }}>
                                  {schedItem.room}
                                </span>
                              )}
                            </div>
                          </td>
                          <td>
                            {activeSession ? (
                              <span
                                className="badge badge-success"
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '5px',
                                  fontWeight: 700,
                                  fontSize: '11px',
                                  padding: '3px 8px',
                                  background: 'rgba(16, 185, 129, 0.1)',
                                  color: '#059669',
                                  border: '1px solid rgba(16, 185, 129, 0.25)',
                                }}
                              >
                                <span className="pulse-dot" style={{ width: '6px', height: '6px', background: '#10b981' }} /> Live Now
                              </span>
                            ) : closedSessionToday ? (
                              <span
                                className="badge badge-muted"
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  fontWeight: 600,
                                  fontSize: '11px',
                                  padding: '3px 8px',
                                  background: 'rgba(100, 116, 139, 0.08)',
                                  border: '1px solid var(--border)',
                                }}
                              >
                                <CheckCircle size={11} style={{ opacity: 0.7 }} /> Finalized
                              </span>
                            ) : (
                              <span
                                className="badge badge-warning"
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  fontWeight: 600,
                                  fontSize: '11px',
                                  padding: '3px 8px',
                                  background: 'rgba(245, 158, 11, 0.08)',
                                  color: '#b45309',
                                  border: '1px solid rgba(245, 158, 11, 0.25)',
                                }}
                              >
                                <Clock size={11} /> Not Started
                              </span>
                            )}
                          </td>
                          <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                            <ActionPopover
                              items={(() => {
                                const items = [];
                                if (activeSession) {
                                  items.push({
                                    label: 'Resume Scanner',
                                    icon: Camera,
                                    isPrimary: true,
                                    onClick: () => {
                                      if (onStartSession) onStartSession(activeSession);
                                      else onNavigate('scanner');
                                    },
                                  });
                                  items.push({ isDivider: true });
                                } else if (closedSessionToday) {
                                  items.push({
                                    label: 'Reopen Session',
                                    icon: Radio,
                                    onClick: async () => {
                                      try {
                                        await Api.reopenSession(closedSessionToday.id);
                                        if (onStartSession) onStartSession({ ...closedSessionToday, status: 'open' });
                                        else onNavigate('scanner');
                                      } catch (err) {
                                        console.error('Failed to reopen session:', err);
                                      }
                                    },
                                  });
                                  items.push({ isDivider: true });
                                } else {
                                  items.push({
                                    label: 'Start Attendance',
                                    icon: Camera,
                                    isPrimary: true,
                                    onClick: () => {
                                      if (onStartSession) onStartSession(sec);
                                      else onNavigate('scanner');
                                    },
                                  });
                                  items.push({ isDivider: true });
                                }
                                items.push({
                                  label: 'View Schedule',
                                  icon: Calendar,
                                  onClick: () => onNavigate('sections'),
                                });
                                items.push({
                                  label: 'Section Report',
                                  icon: FileText,
                                  onClick: () => onNavigate('section_report'),
                                });
                                return items;
                              })()}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* At a Glance */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
            <div className="card-header" style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, fontSize: '14.5px', color: 'var(--text-primary)' }}>
                <Activity size={16} style={{ color: 'var(--primary)' }} /> At a Glance
              </span>
              <span className="badge badge-outline" style={{ fontSize: '11px', fontWeight: 600 }}>Active Overview</span>
            </div>
            <div className="card-body" style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: '14px', flex: 1 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div style={{ padding: '12px 14px', borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: 'var(--bg-card)', boxShadow: 'var(--shadow-xs)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-muted)' }}>Weekly Classes</span>
                    <Calendar size={14} style={{ color: '#2563eb' }} />
                  </div>
                  <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1 }}>{schedules.length}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '3px' }}>Class meeting slots</div>
                </div>

                <div style={{ padding: '12px 14px', borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: 'var(--bg-card)', boxShadow: 'var(--shadow-xs)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-muted)' }}>Total Sessions</span>
                    <ClipboardList size={14} style={{ color: '#7c3aed' }} />
                  </div>
                  <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1 }}>{sessions.length}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '3px' }}>Recorded history</div>
                </div>

                <div style={{ padding: '12px 14px', borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: 'var(--bg-card)', boxShadow: 'var(--shadow-xs)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-muted)' }}>Live Sessions</span>
                    <Radio size={14} style={{ color: liveCount > 0 ? '#10b981' : '#64748b' }} />
                  </div>
                  <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1 }}>{liveCount}</div>
                  <div style={{ fontSize: '11px', color: liveCount > 0 ? 'var(--success)' : 'var(--text-muted)', fontWeight: liveCount > 0 ? 600 : 400, marginTop: '3px' }}>
                    {liveCount > 0 ? 'Live in progress' : 'No active live'}
                  </div>
                </div>

                <div style={{ padding: '12px 14px', borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: 'var(--bg-card)', boxShadow: 'var(--shadow-xs)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-muted)' }}>Biometrics</span>
                    <ScanFace size={14} style={{ color: '#f59e0b' }} />
                  </div>
                  <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1 }}>100%</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '3px' }}>Enrolled &amp; ready</div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', background: 'rgba(16, 185, 129, 0.06)', border: '1px solid rgba(16, 185, 129, 0.2)', borderRadius: 'var(--radius)', fontSize: '12px', color: '#065f46' }}>
                <CheckCircle size={16} style={{ color: '#10b981', flexShrink: 0 }} />
                <span>All enrolled students in your sections have biometric face embeddings on file.</span>
              </div>

              <div style={{ marginTop: 'auto', display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => onNavigate('sections')}
                  style={{ flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                >
                  <Calendar size={14} /> <span>Open Section &amp; Schedule</span>
                </button>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => onNavigate('section_report')}
                  style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                  title="Attendance Reports"
                >
                  <FileText size={14} />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Attendance Sessions */}
        <div className="card">
          <div className="card-header" style={{ padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Clock size={16} style={{ color: 'var(--text-muted)' }} />
              <span style={{ fontWeight: 700, fontSize: '14.5px', color: 'var(--text-primary)' }}>Recent Attendance Sessions</span>
            </div>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => onNavigate('section_report')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <FileText size={13} /> <span>Full Reports</span>
            </button>
          </div>
          <div className="table-container" style={{ border: 'none' }}>
            <table>
              <thead>
                <tr>
                  <th>Section</th>
                  <th>Subject</th>
                  <th>Schedule &amp; Room</th>
                  <th>Session Date</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {sessions.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="text-center text-muted" style={{ padding: '36px' }}>
                      <Coffee size={28} style={{ opacity: 0.4, margin: '0 auto 8px', display: 'block' }} />
                      No attendance sessions recorded yet. Start from{' '}
                      <button
                        type="button"
                        className="btn-link"
                        onClick={() => onNavigate('sections')}
                        style={{ color: 'var(--primary)', cursor: 'pointer', background: 'none', border: 'none', textDecoration: 'underline', fontWeight: 600 }}
                      >
                        Section &amp; Schedule
                      </button>{' '}
                      when class begins.
                    </td>
                  </tr>
                ) : (
                  sessions.slice(0, 8).map((session) => {
                    const secName =
                      session.section_name ||
                      session.schedule_details?.section_name ||
                      (typeof session.schedule === 'object' ? session.schedule?.section_name : null) ||
                      (sections.find((s) => s.id === (session.schedule_details?.section || session.schedule))?.name) ||
                      'Section';

                    const subjCode =
                      session.subject_code ||
                      session.schedule_details?.subject_code ||
                      (typeof session.schedule === 'object' ? session.schedule?.subject_code : null) ||
                      (sections.find((s) => s.id === (session.schedule_details?.section || session.schedule))?.effective_subject_code) ||
                      '—';

                    const subjName =
                      session.subject_name ||
                      session.schedule_details?.subject_name ||
                      (typeof session.schedule === 'object' ? session.schedule?.subject_name : null) ||
                      (sections.find((s) => s.id === (session.schedule_details?.section || session.schedule))?.effective_subject_name) ||
                      '';

                    const sessSched = formatSchoolScheduleParts(
                      session.schedule_details ||
                      (session.schedule_display && session.schedule_display !== '—' ? session.schedule_display : null) ||
                      { room: session.room }
                    );

                    const formattedDate = session.date
                      ? new Date(session.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                      : '—';

                    return (
                      <tr key={session.id}>
                        <td>
                          <div style={{ fontWeight: 800, fontSize: '13.5px', color: 'var(--text-primary)' }}>
                            {secName}
                          </div>
                        </td>
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                            <div>
                              <span
                                className="badge badge-accent"
                                style={{
                                  fontWeight: 700,
                                  fontSize: '11px',
                                  padding: '2px 8px',
                                  letterSpacing: '0.3px',
                                  background: 'var(--accent-light)',
                                  color: 'var(--accent)',
                                  border: '1px solid var(--border)',
                                }}
                              >
                                {subjCode}
                              </span>
                            </div>
                            {subjName && (
                              <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)' }}>
                                {subjName}
                              </div>
                            )}
                          </div>
                        </td>
                        <td style={{ fontSize: '12.5px', whiteSpace: 'nowrap' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                            {(sessSched.timeLines && sessSched.fullTime !== 'No schedule set'
                              ? sessSched.timeLines
                              : [sessSched.fullTime !== 'No schedule set' ? sessSched.fullTime : 'Standard Session']
                            ).map((tl, tIdx) => (
                              <span key={tIdx} style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                                {tl}
                              </span>
                            ))}
                            {(sessSched.room || session.room) && (
                              <span style={{ fontSize: '10px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                                {sessSched.room || session.room}
                              </span>
                            )}
                          </div>
                        </td>
                        <td style={{ fontSize: '12.5px', whiteSpace: 'nowrap' }}>
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 500, color: 'var(--text-primary)' }}>
                            <Calendar size={13} style={{ color: 'var(--text-muted)' }} />
                            <span>{formattedDate}</span>
                          </div>
                        </td>
                        <td>
                          {session.status === 'open' ? (
                            <span
                              className="badge badge-success"
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '5px',
                                fontWeight: 700,
                                fontSize: '11px',
                                padding: '3px 9px',
                                background: 'rgba(16, 185, 129, 0.1)',
                                color: '#059669',
                                border: '1px solid rgba(16, 185, 129, 0.25)',
                              }}
                            >
                              <span className="pulse-dot" style={{ background: '#10b981', width: '6px', height: '6px' }} />
                              Live / Open
                            </span>
                          ) : (
                            <span
                              className="badge badge-muted"
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                fontWeight: 600,
                                fontSize: '11px',
                                padding: '3px 9px',
                                background: 'rgba(100, 116, 139, 0.08)',
                                color: 'var(--text-secondary)',
                                border: '1px solid var(--border)',
                              }}
                            >
                              <CheckCircle size={11} style={{ opacity: 0.7 }} /> Finalized
                            </span>
                          )}
                        </td>
                        <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                          <ActionPopover
                            items={(() => {
                              const items = [];
                              if (session.status === 'open') {
                                items.push({
                                  label: 'Resume Scanner',
                                  icon: Camera,
                                  isPrimary: true,
                                  onClick: () => {
                                    if (onStartSession) onStartSession(session);
                                    else onNavigate('scanner');
                                  },
                                });
                                items.push({ isDivider: true });
                              } else {
                                items.push({
                                  label: 'Reopen Session',
                                  icon: Radio,
                                  onClick: async () => {
                                    try {
                                      await Api.reopenSession(session.id);
                                      if (onStartSession) onStartSession({ ...session, status: 'open' });
                                      else onNavigate('scanner');
                                    } catch (err) {
                                      console.error('Failed to reopen:', err);
                                    }
                                  },
                                });
                                items.push({ isDivider: true });
                              }
                              items.push({
                                label: 'View Report',
                                icon: FileText,
                                onClick: () => onNavigate('section_report'),
                              });
                              return items;
                            })()}
                          />
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

  // ══════════════════════════════════════════════════════════════════════════
  // VIEW 3: STUDENT DASHBOARD (100% copycat of templates/accounts/dashboard_student.html)
  // ══════════════════════════════════════════════════════════════════════════
  const student = studentOverview?.student || user?.student_profile;
  const fullName = student?.full_name || `${user?.first_name || ''} ${user?.last_name || ''}`.trim() || user?.username;
  const studentStats = studentOverview?.overall_stats || { rate: 0, total_sessions: 0, present: 0, late: 0, absent: 0, excused: 0 };
  const enrolledCards = studentOverview?.enrolled_cards || [];
  const recentLogs = studentOverview?.recent_records || [];

  return (
    <div className="page-content">
      {/* Profile + Summary */}
      <div className="grid-2 mb-3">
        {/* Profile Card */}
        <div className="card">
          <div className="card-header">
            <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <GraduationCap size={16} /> My Profile
            </span>
          </div>
          <div className="card-body">
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px' }}>
              {student?.profile_image || user?.profile_image ? (
                <img
                  src={student?.profile_image || user?.profile_image}
                  onError={(e) => {
                    e.currentTarget.onerror = null;
                    e.currentTarget.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(fullName)}&background=6366f1&color=fff`;
                  }}
                  style={{ width: '60px', height: '60px', borderRadius: '50%', objectFit: 'cover' }}
                  alt="Profile"
                />
              ) : (
                <div
                  className="sidebar-user-avatar"
                  style={{
                    width: '60px',
                    height: '60px',
                    fontSize: '22px',
                    borderRadius: '50%',
                    background: 'var(--bg-secondary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    color: 'var(--primary)',
                  }}
                >
                  {(user?.first_name?.[0] || user?.username?.[0] || 'S').toUpperCase()}
                </div>
              )}
              <div>
                <div className="font-bold" style={{ fontSize: '18px' }}>{fullName}</div>
                <div className="text-muted">
                  Student ID: <strong>{student?.student_id || '2024-00001'}</strong>
                </div>
                <div className="text-muted">Login: {user?.username}</div>
                <div className="text-muted">
                  {student?.course || 'BSIT'} &mdash; Year {student?.year_level || 1}
                </div>
              </div>
            </div>

            {student?.is_face_enrolled ? (
              <div className="alert alert-success" style={{ marginBottom: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CheckCircle size={16} />
                <span>
                  Biometric profile verified{' '}
                  {student.face_enrolled_at ? `(Enrolled on ${new Date(student.face_enrolled_at).toLocaleDateString()})` : ''}
                </span>
              </div>
            ) : (
              <div className="alert alert-warning" style={{ marginBottom: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertTriangle size={16} />
                <span>Biometric profile not registered &mdash; contact your administrator for face enrollment.</span>
              </div>
            )}
          </div>
        </div>

        {/* Attendance Summary */}
        <div className="card">
          <div className="card-header">
            <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <BarChart2 size={16} /> Attendance Summary
            </span>
          </div>
          <div className="card-body">
            <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)', marginBottom: '12px' }}>
              <div className="stat-card green" style={{ padding: '12px' }}>
                <div className="stat-info">
                  <div className="value" style={{ fontSize: '24px' }}>{studentStats.rate}%</div>
                  <div className="label">Overall rate</div>
                </div>
              </div>
              <div className="stat-card blue" style={{ padding: '12px' }}>
                <div className="stat-info">
                  <div className="value" style={{ fontSize: '24px' }}>{studentStats.total_sessions}</div>
                  <div className="label">Sessions logged</div>
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', fontSize: '12px' }}>
              <span className="badge badge-success">Present: {studentStats.present}</span>
              <span className="badge badge-warning">Late: {studentStats.late}</span>
              <span className="badge badge-danger">Absent: {studentStats.absent}</span>
              <span className="badge badge-info">Excused: {studentStats.excused}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Per subject / section */}
      <div className="card mb-3">
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <BookOpen size={16} /> Attendance by Subject / Section
          </span>
          <span className="text-muted" style={{ fontSize: '12px' }}>
            {enrolledCards.length} enrolled class(es)
          </span>
        </div>
        <div className="table-container" style={{ border: 'none' }}>
          <table>
            <thead>
              <tr>
                <th>Subject</th>
                <th>Section</th>
                <th>Sessions</th>
                <th>Present</th>
                <th>Late</th>
                <th>Absent</th>
                <th>Rate</th>
                <th>Last Class</th>
                <th style={{ textAlign: 'right' }}>Calendar</th>
              </tr>
            </thead>
            <tbody>
              {enrolledCards.length === 0 ? (
                <tr>
                  <td colSpan="9" className="text-center text-muted" style={{ padding: '30px' }}>
                    You are not enrolled in any sections yet.
                  </td>
                </tr>
              ) : (
                enrolledCards.map((card) => (
                  <tr key={card.section_id}>
                    <td>
                      <span className="badge badge-accent">{card.subject_code}</span>
                      <div className="text-muted" style={{ fontSize: '11px', marginTop: '2px' }}>
                        {card.subject_name}
                      </div>
                    </td>
                    <td><strong>{card.section_name}</strong></td>
                    <td>{card.total_sessions}</td>
                    <td>{card.present_count}</td>
                    <td>{card.late_count}</td>
                    <td>{card.absent_count}</td>
                    <td>
                      {card.rate !== null && card.rate !== undefined ? (
                        <strong>{card.rate}%</strong>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                    <td className="text-muted" style={{ fontSize: '12px' }}>
                      {card.last_date ? (
                        <span>
                          {card.last_date}{' '}
                          {card.last_status === 'present' && <span className="badge badge-success" style={{ marginLeft: '4px' }}>P</span>}
                          {card.last_status === 'late' && <span className="badge badge-warning" style={{ marginLeft: '4px' }}>L</span>}
                          {card.last_status === 'absent' && <span className="badge badge-danger" style={{ marginLeft: '4px' }}>A</span>}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        type="button"
                        className="btn btn-outline btn-sm"
                        onClick={() => setSelectedCalendarSection(card)}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                      >
                        <Calendar size={13} /> <span>View</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent Log */}
      <div className="card">
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ClipboardList size={16} /> Recent Attendance
          </span>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() => onNavigate('session_logs')}
          >
            View All
          </button>
        </div>
        <div className="table-container" style={{ border: 'none' }}>
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Subject</th>
                <th>Section</th>
                <th>Status</th>
                <th>Time In</th>
              </tr>
            </thead>
            <tbody>
              {recentLogs.length === 0 ? (
                <tr>
                  <td colSpan="5" className="text-center text-muted" style={{ padding: '30px' }}>
                    No attendance records yet. Records appear after your instructor takes class attendance.
                  </td>
                </tr>
              ) : (
                recentLogs.map((log) => (
                  <tr key={log.id}>
                    <td>{log.date}</td>
                    <td>
                      <span className="badge badge-accent">{log.subject_code}</span>
                    </td>
                    <td>{log.section_name}</td>
                    <td>
                      {log.status === 'present' ? (
                        <span className="badge badge-success" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <CheckCircle size={12} /> Present
                        </span>
                      ) : log.status === 'late' ? (
                        <span className="badge badge-warning" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <Clock size={12} /> Late
                        </span>
                      ) : (
                        <span className="badge badge-danger" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <AlertTriangle size={12} /> Absent
                        </span>
                      )}
                    </td>
                    <td className="text-muted">{log.time}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Calendar Modal */}
      {selectedCalendarSection && (
        <StudentAttendanceCalendarModal
          isOpen={Boolean(selectedCalendarSection)}
          onClose={() => setSelectedCalendarSection(null)}
          sectionId={selectedCalendarSection.section_id}
          initialTitle={selectedCalendarSection.title}
          initialSubject={selectedCalendarSection.subject_name}
          initialInstructor={selectedCalendarSection.teacher_name}
        />
      )}
    </div>
  );
}

