import React, { useState, useEffect, useRef } from 'react';
import {
  Camera,
  Search,
  CheckCircle,
  AlertTriangle,
  UserPlus,
  Plus,
  X,
  Target,
  Square,
  GraduationCap,
  Check,
  Info,
} from 'lucide-react';
import { Api } from '../api';
import ActionPopover from '../components/ActionPopover';
import PasswordInput from '../components/PasswordInput';

export default function FaceEnrollmentView({ user, onNavigate, onSetHeaderInfo }) {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Biometric Face Enrollment Modal State (templates/components/modal_face_enroll.html)
  const [activeModalStudent, setActiveModalStudent] = useState(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [enrolling, setEnrolling] = useState(false);
  const [resultMsg, setResultMsg] = useState('');
  const [resultType, setResultType] = useState('');
  const [flash, setFlash] = useState(false);

  // Register Student Modal State (templates/face/enroll_select.html)
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [registerForm, setRegisterForm] = useState({
    student_id: '',
    first_name: '',
    last_name: '',
    email: '',
    course: 'BSIT',
    year_level: 1,
    password: '',
  });
  const [registerSubmitting, setRegisterSubmitting] = useState(false);
  const [registerError, setRegisterError] = useState('');
  const [registerSuccess, setRegisterSuccess] = useState('');

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);

  const loadStudents = async () => {
    try {
      setLoading(true);
      const data = await Api.getStudents();
      setStudents(data || []);
    } catch (err) {
      console.error('Failed to load students:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStudents();
  }, []);

  // Update Top Header in App.jsx (100% copycat of templates/face/enroll_select.html)
  useEffect(() => {
    if (onSetHeaderInfo) {
      onSetHeaderInfo({
        title: 'Select Student to Enroll',
        subtitle: 'Enroll or update biometric 128-D face embeddings for students',
        headerActions: (
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => (onNavigate ? onNavigate('student_enrollment') : setShowRegisterModal(true))}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <UserPlus size={16} />
            <span>Register New Student</span>
          </button>
        ),
      });
    }
  }, [onSetHeaderInfo]);

  // Camera Management
  const startCamera = async () => {
    try {
      setResultMsg('');
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraActive(true);
    } catch (err) {
      setResultType('danger');
      setResultMsg('Could not access camera. Please allow camera permissions in your browser.');
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  };

  const openFaceModal = (student) => {
    setActiveModalStudent(student);
    setResultMsg('');
    setResultType('');
    setTimeout(startCamera, 100);
  };

  const closeFaceModal = () => {
    stopCamera();
    setActiveModalStudent(null);
    setResultMsg('');
    setResultType('');
  };

  // Capture & Enroll
  const captureAndEnroll = async () => {
    if (!videoRef.current || !activeModalStudent) return;
    try {
      setEnrolling(true);
      setResultMsg('');

      // Flash shutter effect
      setFlash(true);
      setTimeout(() => setFlash(false), 200);

      const video = videoRef.current;
      const canvas = canvasRef.current || document.createElement('canvas');
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const frameB64 = canvas.toDataURL('image/jpeg', 0.9);

      const res = await Api.enrollFace(activeModalStudent.id, frameB64);
      setResultType('success');
      setResultMsg(res.message || 'Face biometrics enrolled successfully!');
      stopCamera();

      // Update student row in table
      setStudents((prev) =>
        prev.map((s) =>
          s.id === activeModalStudent.id
            ? { ...s, is_face_enrolled: true, face_enrolled_at: new Date().toISOString() }
            : s
        )
      );

      // Auto close modal after brief delay
      setTimeout(() => {
        closeFaceModal();
      }, 1500);
    } catch (err) {
      setResultType('danger');
      setResultMsg(err.message || 'Face enrollment failed. Ensure face is lit and centered.');
    } finally {
      setEnrolling(false);
    }
  };

  // Register Student Submit
  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    if (!registerForm.student_id || !registerForm.first_name || !registerForm.last_name) {
      setRegisterError('Student ID, First Name, and Last Name are required.');
      return;
    }

    try {
      setRegisterSubmitting(true);
      setRegisterError('');

      await Api.createUser({
        username: registerForm.student_id,
        email: registerForm.email || `${registerForm.student_id.toLowerCase().replace(/[^a-z0-9]/g, '')}@student.urios.edu.ph`,
        first_name: registerForm.first_name,
        last_name: registerForm.last_name,
        role: 'student',
        student_id: registerForm.student_id,
        course: registerForm.course,
        year_level: parseInt(registerForm.year_level, 10) || 1,
        password: registerForm.password || 'student123',
      });

      setRegisterSuccess(`Student ${registerForm.first_name} ${registerForm.last_name} registered successfully!`);
      setShowRegisterModal(false);
      setRegisterForm({
        student_id: '',
        first_name: '',
        last_name: '',
        email: '',
        course: 'BSIT',
        year_level: 1,
        password: '',
      });
      await loadStudents();
      setTimeout(() => setRegisterSuccess(''), 4000);
    } catch (err) {
      setRegisterError(err.message || 'Failed to register student.');
    } finally {
      setRegisterSubmitting(false);
    }
  };

  // Filter students based on search
  const filteredStudents = students.filter((s) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    const fullName = `${s.user?.first_name || ''} ${s.user?.last_name || ''}`.toLowerCase();
    const sid = (s.student_id || '').toLowerCase();
    const course = (s.course || '').toLowerCase();
    return fullName.includes(q) || sid.includes(q) || course.includes(q);
  });

  return (
    <div className="page-content">
      {registerSuccess && (
        <div className="alert alert-success" style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Check size={18} />
          <span>{registerSuccess}</span>
        </div>
      )}

      {/* Main Registered Students Card (100% copy of templates/face/enroll_select.html) */}
      <div className="card">
        {/* Card Header */}
        <div
          className="card-header"
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          <span
            className="card-title"
            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <GraduationCap size={16} /> Registered Students
            <span className="badge badge-info" style={{ fontSize: '12px' }}>
              {filteredStudents.length}
            </span>
          </span>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {/* Real-time Filter */}
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                id="student-filter"
                className="form-control form-control-sm"
                placeholder="Search student or ID..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ paddingLeft: '32px', fontSize: '13px', width: '220px' }}
              />
              <span
                style={{
                  position: 'absolute',
                  left: '10px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-muted)',
                  pointerEvents: 'none',
                }}
              >
                <Search size={14} />
              </span>
            </div>

            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => (onNavigate ? onNavigate('student_enrollment') : setShowRegisterModal(true))}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <Plus size={14} /> <span>Enroll Student (FSUU)</span>
            </button>
          </div>
        </div>

        {/* Students Table */}
        <div className="table-container" style={{ border: 'none', margin: 0 }}>
          <table id="students-table">
            <thead>
              <tr>
                <th>Student</th>
                <th>Student ID</th>
                <th>Course &amp; Year</th>
                <th>Face Status</th>
                <th style={{ textAlign: 'right' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="5" className="text-center text-muted" style={{ padding: '36px' }}>
                    Loading students...
                  </td>
                </tr>
              ) : filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan="5" className="text-center text-muted" style={{ padding: '40px 20px' }}>
                    <div style={{ marginBottom: '12px' }}>
                      <GraduationCap size={40} style={{ opacity: 0.4, margin: '0 auto', display: 'block' }} />
                    </div>
                    <p style={{ fontSize: '14px', marginBottom: '14px' }}>
                      {search ? 'No students match your search query.' : 'No students registered in the system yet.'}
                    </p>
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={() => setShowRegisterModal(true)}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', margin: '0 auto' }}
                    >
                      <UserPlus size={15} /> <span>Register First Student</span>
                    </button>
                  </td>
                </tr>
              ) : (
                filteredStudents.map((student) => (
                  <tr key={student.id} className="student-row">
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        {student.face_image ? (
                          <img
                            src={student.face_image}
                            alt=""
                            onError={(e) => {
                              e.currentTarget.onerror = null;
                              e.currentTarget.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(student.user?.first_name || 'Student')}&background=6366f1&color=fff`;
                            }}
                            style={{
                              width: '36px',
                              height: '36px',
                              borderRadius: '50%',
                              objectFit: 'cover',
                              border: '2px solid var(--success)',
                            }}
                          />
                        ) : (
                          <div
                            className="student-avatar-sm"
                            style={{
                              width: '36px',
                              height: '36px',
                              borderRadius: '50%',
                              background: 'var(--bg-secondary)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: '700',
                              color: 'var(--primary)',
                            }}
                          >
                            {(student.user?.first_name?.[0] || 'S').toUpperCase()}
                          </div>
                        )}
                        <div>
                          <div className="font-bold student-name">
                            {student.user?.first_name} {student.user?.last_name}
                          </div>
                          <div className="text-muted" style={{ fontSize: '11px' }}>
                            {student.user?.email}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="student-id">
                      <code style={{ fontWeight: 600 }}>{student.student_id}</code>
                    </td>
                    <td className="student-course">
                      {student.course || 'BSIT'} &mdash; Year {student.year_level || 1}
                    </td>
                    <td>
                      {student.is_face_enrolled ? (
                        <span
                          className="badge badge-success"
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                        >
                          <CheckCircle size={13} /> Enrolled
                        </span>
                      ) : (
                        <span
                          className="badge badge-warning"
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                        >
                          <AlertTriangle size={13} /> Not Enrolled
                        </span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                        <button
                          type="button"
                          className={student.is_face_enrolled ? "btn btn-outline btn-sm" : "btn btn-success btn-sm"}
                          onClick={() => openFaceModal(student)}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                        >
                          <Camera size={13} /> <span>{student.is_face_enrolled ? 'Re-enroll' : 'Enroll Face'}</span>
                        </button>
                        <ActionPopover
                          items={[
                            {
                              label: student.is_face_enrolled ? 'Re-enroll Face Biometrics' : 'Enroll Face Biometrics',
                              icon: Camera,
                              isSuccess: !student.is_face_enrolled,
                              isPrimary: student.is_face_enrolled,
                              onClick: () => openFaceModal(student),
                            },
                          ]}
                        />
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ══ In-Page Modal: Biometric Face Enrollment (100% copycat of modal_face_enroll.html) ══ */}
      {activeModalStudent && (
        <div
          className="modal-backdrop open"
          id="face-enroll-modal"
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.65)',
            backdropFilter: 'blur(3px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '16px',
          }}
        >
          <div
            className="modal-card"
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)',
              maxWidth: '540px',
              width: '100%',
              boxShadow: 'var(--shadow-lg)',
              overflow: 'hidden',
            }}
          >
            <div
              className="modal-header"
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '16px 20px',
                borderBottom: '1px solid var(--border)',
              }}
            >
              <div>
                <h3
                  className="modal-title"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    margin: 0,
                    fontSize: '16px',
                    fontWeight: 700,
                  }}
                >
                  <Camera size={18} style={{ color: 'var(--primary)' }} />
                  <span>Biometric Face Enrollment</span>
                </h3>
                <div
                  className="modal-subtitle"
                  style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '2px' }}
                >
                  <strong>
                    {activeModalStudent.user?.first_name} {activeModalStudent.user?.last_name}
                  </strong>{' '}
                  &bull; ID: <code>{activeModalStudent.student_id}</code>
                </div>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={closeFaceModal}
                aria-label="Close modal"
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--text-muted)',
                }}
              >
                <X size={18} />
              </button>
            </div>

            <div className="modal-body" style={{ padding: '20px', textAlign: 'center' }}>
              {/* Centered Camera Box */}
              <div
                style={{
                  position: 'relative',
                  maxWidth: '460px',
                  margin: '0 auto',
                  background: '#0f172a',
                  borderRadius: 'var(--radius)',
                  overflow: 'hidden',
                  border: '1px solid var(--border)',
                  aspectRatio: '4 / 3',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    transform: 'scaleX(-1)',
                    display: cameraActive ? 'block' : 'none',
                  }}
                />
                <canvas ref={canvasRef} style={{ display: 'none' }} />

                {!cameraActive && (
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '24px',
                      textAlign: 'center',
                    }}
                  >
                    <div
                      style={{
                        width: '54px',
                        height: '54px',
                        borderRadius: '50%',
                        background: 'rgba(255, 255, 255, 0.05)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginBottom: '12px',
                      }}
                    >
                      <Camera size={24} style={{ color: '#94a3b8' }} />
                    </div>
                    <div style={{ fontSize: '15px', fontWeight: '700', color: '#f1f5f9' }}>
                      Camera Feed Offline
                    </div>
                    <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px', maxWidth: '300px', lineHeight: 1.4 }}>
                      Click &ldquo;Start Camera&rdquo; to begin student biometric enrollment
                    </div>
                    <button
                      type="button"
                      onClick={startCamera}
                      style={{
                        marginTop: '16px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '10px 22px',
                        fontWeight: '700',
                        fontSize: '13px',
                        borderRadius: 'var(--radius)',
                        background: '#ffffff',
                        color: '#0f172a',
                        border: 'none',
                        cursor: 'pointer',
                        boxShadow: '0 4px 14px rgba(0, 0, 0, 0.35)',
                        transition: 'all 0.15s ease',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = '#f1f5f9';
                        e.currentTarget.style.transform = 'translateY(-1px)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = '#ffffff';
                        e.currentTarget.style.transform = 'translateY(0)';
                      }}
                    >
                      <Camera size={16} style={{ color: '#0f172a' }} />
                      <span>Start Camera</span>
                    </button>
                  </div>
                )}

                {cameraActive && (
                  <>
                    {/* Oval Face Guide Vignette */}
                    <div
                      style={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        width: '180px',
                        height: '240px',
                        border: '2px dashed rgba(255, 255, 255, 0.85)',
                        borderRadius: '50% 50% 45% 45%',
                        boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.3)',
                        pointerEvents: 'none',
                      }}
                    />
                    <div
                      style={{
                        position: 'absolute',
                        bottom: '10px',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        background: 'rgba(0, 0, 0, 0.72)',
                        color: '#fff',
                        fontSize: '11px',
                        padding: '3px 10px',
                        borderRadius: '20px',
                        pointerEvents: 'none',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      Align student's face within the oval frame
                    </div>
                  </>
                )}

                {/* Shutter flash effect */}
                {flash && (
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      background: '#fff',
                      opacity: 0.75,
                      pointerEvents: 'none',
                      zIndex: 10,
                    }}
                  />
                )}
              </div>

              {/* Controls */}
              {cameraActive && (
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    gap: '10px',
                    flexWrap: 'wrap',
                    marginTop: '16px',
                  }}
                >
                  <button
                    type="button"
                    className="btn btn-success"
                    onClick={captureAndEnroll}
                    disabled={enrolling}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                  >
                    <Target size={16} />
                    <span>{enrolling ? 'Processing...' : 'Capture & Enroll'}</span>
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline"
                    onClick={stopCamera}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                  >
                    <Square size={16} /> <span>Stop Camera</span>
                  </button>
                </div>
              )}

              {/* Results Alert */}
              {resultMsg && (
                <div
                  className={`alert alert-${resultType}`}
                  style={{
                    marginTop: '14px',
                    textAlign: 'left',
                    fontSize: '13px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  {resultType === 'success' ? <CheckCircle size={16} /> : <AlertTriangle size={16} />}
                  <span>{resultMsg}</span>
                </div>
              )}

              {/* Tips */}
              <div
                style={{
                  marginTop: '16px',
                  padding: '12px 14px',
                  background: 'var(--bg-primary)',
                  borderRadius: 'var(--radius)',
                  fontSize: '12px',
                  color: 'var(--text-secondary)',
                  textAlign: 'left',
                }}
              >
                <div
                  style={{
                    fontWeight: 600,
                    marginBottom: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                    color: 'var(--text-primary)',
                  }}
                >
                  <Info size={13} /> Biometric Capture Guidelines:
                </div>
                <div>&bull; Ensure even facial lighting (avoid bright windows behind the subject).</div>
                <div>&bull; Have the student maintain a neutral expression looking directly at the lens.</div>
              </div>
            </div>

            <div
              className="modal-footer"
              style={{
                padding: '12px 20px',
                borderTop: '1px solid var(--border)',
                background: 'var(--bg-secondary)',
                display: 'flex',
                justifyContent: 'flex-end',
              }}
            >
              <button type="button" className="btn btn-outline" onClick={closeFaceModal}>
                Done / Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ In-Page Modal: Register New Student (100% copycat of templates/face/enroll_select.html) ══ */}
      {showRegisterModal && (
        <div
          className="modal-backdrop open"
          id="register-student-modal"
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.65)',
            backdropFilter: 'blur(3px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '16px',
          }}
        >
          <div
            className="modal-card"
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)',
              maxWidth: '560px',
              width: '100%',
              boxShadow: 'var(--shadow-lg)',
              overflow: 'hidden',
            }}
          >
            <div
              className="modal-header"
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '16px 20px',
                borderBottom: '1px solid var(--border)',
              }}
            >
              <div>
                <h3
                  className="modal-title"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    margin: 0,
                    fontSize: '16px',
                    fontWeight: 700,
                  }}
                >
                  <UserPlus size={18} style={{ color: 'var(--primary)' }} />
                  <span>Register Student</span>
                </h3>
                <div
                  className="modal-subtitle"
                  style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '2px' }}
                >
                  Enroll a new student into the attendance system
                </div>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setShowRegisterModal(false)}
                aria-label="Close modal"
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--text-muted)',
                }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleRegisterSubmit}>
              <div className="modal-body" style={{ padding: '20px' }}>
                {registerError && (
                  <div className="alert alert-danger" style={{ marginBottom: '14px', fontSize: '13px' }}>
                    {registerError}
                  </div>
                )}

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(2, 1fr)',
                    gap: '14px',
                  }}
                >
                  <div style={{ gridColumn: 'span 2' }}>
                    <label className="form-label" style={{ fontWeight: 600, fontSize: '13px', display: 'block', marginBottom: '4px' }}>
                      Student ID Number *
                    </label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g. 2024-00001"
                      required
                      value={registerForm.student_id}
                      onChange={(e) => setRegisterForm({ ...registerForm, student_id: e.target.value })}
                    />
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '3px' }}>
                      Unique identification number
                    </div>
                  </div>

                  <div>
                    <label className="form-label" style={{ fontWeight: 600, fontSize: '13px', display: 'block', marginBottom: '4px' }}>
                      First Name *
                    </label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="First name"
                      required
                      value={registerForm.first_name}
                      onChange={(e) => setRegisterForm({ ...registerForm, first_name: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="form-label" style={{ fontWeight: 600, fontSize: '13px', display: 'block', marginBottom: '4px' }}>
                      Last Name *
                    </label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Last name"
                      required
                      value={registerForm.last_name}
                      onChange={(e) => setRegisterForm({ ...registerForm, last_name: e.target.value })}
                    />
                  </div>

                  <div style={{ gridColumn: 'span 2' }}>
                    <label className="form-label" style={{ fontWeight: 600, fontSize: '13px', display: 'block', marginBottom: '4px' }}>
                      Email Address (Optional)
                    </label>
                    <input
                      type="email"
                      className="form-control"
                      placeholder="student@urios.edu.ph"
                      value={registerForm.email}
                      onChange={(e) => setRegisterForm({ ...registerForm, email: e.target.value })}
                    />
                  </div>

                  <div style={{ gridColumn: 'span 2' }}>
                    <label className="form-label" style={{ fontWeight: 600, fontSize: '13px', display: 'block', marginBottom: '4px' }}>
                      Degree Course *
                    </label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g. BSCS, BSIT"
                      required
                      value={registerForm.course}
                      onChange={(e) => setRegisterForm({ ...registerForm, course: e.target.value })}
                    />
                  </div>

                  <div style={{ gridColumn: 'span 2' }}>
                    <label className="form-label" style={{ fontWeight: 600, fontSize: '13px', display: 'block', marginBottom: '4px' }}>
                      Account Password
                    </label>
                    <PasswordInput
                      placeholder="Leave blank to use default student123"
                      value={registerForm.password}
                      onChange={(e) => setRegisterForm({ ...registerForm, password: e.target.value })}
                      showStrength={registerForm.password.length > 0}
                    />
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                      Default password is <code>student123</code>
                    </div>
                  </div>
                </div>
              </div>

              <div
                className="modal-footer"
                style={{
                  padding: '14px 20px',
                  background: 'var(--bg-secondary)',
                  borderTop: '1px solid var(--border)',
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: '10px',
                }}
              >
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => setShowRegisterModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={registerSubmitting}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  <Check size={16} />
                  <span>{registerSubmitting ? 'Registering...' : 'Register Student'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
