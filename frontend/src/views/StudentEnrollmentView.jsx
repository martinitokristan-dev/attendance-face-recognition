import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowLeft,
  Camera,
  CheckCircle2,
  AlertCircle,
  MapPin,
  Phone,
  Mail,
  GraduationCap,
  ShieldCheck,
  Check,
  Square,
  Target,
  Loader2,
} from 'lucide-react';
import { Api } from '../api';
import PasswordInput from '../components/PasswordInput';
import PhoneInput from '../components/PhoneInput';
import { getPhPhoneValidationMessage } from '../utils/validation';
import { getRegions, getProvinces, getCitiesMunicipalities } from '../utils/phLocationsApi';

const defaultFormData = {
  student_id: '',
  family_name: '',
  given_name: '',
  middle_name: '',
  gender: 'Male',
  birth_date: '',
  birth_place: '',
  civil_status: 'Single',
  religion: 'Roman Catholic',
  citizenship: 'Filipino',
  lang_english: true,
  lang_filipino: true,
  lang_cebuano: true,
  lang_others: '',

  // Address Information
  address: '',
  region_code: '',
  region: '',
  province_code: '',
  province: '',
  municipality_code: '',
  municipality: '',

  // Fallback legacy keys
  current_address: '',
  current_region: '',
  current_province: '',
  current_municipality: '',
  permanent_address: '',
  permanent_region: '',
  permanent_province: '',
  permanent_municipality: '',

  // Contact & Security
  telephone: '',
  mobile_number: '',
  email: '',
  password: 'student123',
};

export default function StudentEnrollmentView({ user, onNavigate, onSetHeaderInfo }) {
  const clearEnrollmentSession = () => {
    try {
      sessionStorage.removeItem('attendfr_enrollment_draft');
      sessionStorage.removeItem('attendfr_enrollment_step');
      sessionStorage.removeItem('attendfr_enrolled_student');
    } catch {
      // ignore
    }
  };

  // Navigation & Page Header Setup
  useEffect(() => {
    if (onSetHeaderInfo) {
      onSetHeaderInfo({
        title: 'Student Admission & Enrollment',
        subtitle: 'Student demographic registration & biometric onboarding',
        headerActions: (
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() => {
              clearEnrollmentSession();
              onNavigate('face_enrollment');
            }}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <ArrowLeft size={15} />
            <span>Back to Students</span>
          </button>
        ),
      });
    }
  }, [onSetHeaderInfo, onNavigate]);

  // Form State with Reload Persistence
  const [formData, setFormData] = useState(() => {
    try {
      const draft = sessionStorage.getItem('attendfr_enrollment_draft');
      if (draft) {
        const parsed = JSON.parse(draft);
        // Clear out legacy auto-filled location if not explicitly chosen
        if (parsed.current_region_code === '160000000' && !parsed.address && !parsed.region_code) {
          parsed.region_code = '';
          parsed.region = '';
          parsed.province_code = '';
          parsed.province = '';
          parsed.municipality_code = '';
          parsed.municipality = '';
          parsed.current_region_code = '';
          parsed.current_region = '';
          parsed.current_province_code = '';
          parsed.current_province = '';
          parsed.current_municipality_code = '';
          parsed.current_municipality = '';
          parsed.permanent_region_code = '';
          parsed.permanent_region = '';
          parsed.permanent_province_code = '';
          parsed.permanent_province = '';
          parsed.permanent_municipality_code = '';
          parsed.permanent_municipality = '';
        }
        return { ...defaultFormData, ...parsed };
      }
    } catch {
      // ignore
    }
    return defaultFormData;
  });

  // Dynamic Philippine Locations from PSGC API
  const [regionsList, setRegionsList] = useState([]);
  const [provincesList, setProvincesList] = useState([]);
  const [citiesList, setCitiesList] = useState([]);
  const [loadingLocations, setLoadingLocations] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Enrolled Student State with Reload Persistence
  const [enrolledStudent, setEnrolledStudentState] = useState(() => {
    try {
      const saved = sessionStorage.getItem('attendfr_enrolled_student');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const setEnrolledStudent = (stud) => {
    setEnrolledStudentState(stud);
    try {
      if (stud) {
        sessionStorage.setItem('attendfr_enrolled_student', JSON.stringify(stud));
      } else {
        sessionStorage.removeItem('attendfr_enrolled_student');
      }
    } catch {
      // ignore
    }
  };

  // Biometrics Step 2 State with Reload Persistence
  const [activeStep, setActiveStepState] = useState(() => {
    try {
      const s = sessionStorage.getItem('attendfr_enrollment_step');
      return s ? Number(s) : 1;
    } catch {
      return 1;
    }
  });

  const setActiveStep = (step) => {
    setActiveStepState(step);
    try {
      sessionStorage.setItem('attendfr_enrollment_step', String(step));
    } catch {
      // ignore
    }
  };

  // Auto-save form draft on change
  useEffect(() => {
    try {
      sessionStorage.setItem('attendfr_enrollment_draft', JSON.stringify(formData));
    } catch {
      // ignore
    }
  }, [formData]);

  const [cameraActive, setCameraActive] = useState(false);
  const [enrollingFace, setEnrollingFace] = useState(false);
  const [faceMsg, setFaceMsg] = useState('');
  const [faceMsgType, setFaceMsgType] = useState('');
  const [flash, setFlash] = useState(false);

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const canvasRef = useRef(null);

  // Fetch Auto-Increment Student ID in background if not drafted
  useEffect(() => {
    async function initStudentId() {
      if (formData.student_id) return;
      try {
        const res = await Api.getNextStudentId();
        if (res && res.next_student_id) {
          setFormData((prev) => ({ ...prev, student_id: res.next_student_id }));
        } else {
          setFormData((prev) => ({ ...prev, student_id: '23100000450' }));
        }
      } catch {
        setFormData((prev) => ({ ...prev, student_id: '23100000450' }));
      }
    }
    initStudentId();
  }, [formData.student_id]);

  // Initialize Philippine Locations from PSGC API (starts clean with unselected defaults)
  useEffect(() => {
    async function loadLocations() {
      setLoadingLocations(true);
      try {
        const regs = await getRegions();
        setRegionsList(regs);

        const savedReg = formData.region_code || formData.permanent_region_code || formData.current_region_code;
        if (savedReg) {
          const provs = await getProvinces(savedReg);
          setProvincesList(provs);

          const savedProv = formData.province_code || formData.permanent_province_code || formData.current_province_code;
          if (savedProv) {
            const cities = await getCitiesMunicipalities(savedReg, savedProv);
            setCitiesList(cities);
          } else if (provs.length === 0) {
            // Province-less region (e.g. NCR)
            const cities = await getCitiesMunicipalities(savedReg, null);
            setCitiesList(cities);
          }
        }
      } catch (err) {
        console.error('Error loading location data from PSGC API:', err);
      } finally {
        setLoadingLocations(false);
      }
    }
    loadLocations();
  }, []);

  // Cascading Location Handlers
  const handleRegionChange = async (regionCode) => {
    if (!regionCode) {
      setProvincesList([]);
      setCitiesList([]);
      setFormData((prev) => ({
        ...prev,
        region_code: '',
        region: '',
        province_code: '',
        province: '',
        municipality_code: '',
        municipality: '',
        permanent_region_code: '',
        permanent_region: '',
        permanent_province_code: '',
        permanent_province: '',
        permanent_municipality_code: '',
        permanent_municipality: '',
        current_region_code: '',
        current_region: '',
        current_province_code: '',
        current_province: '',
        current_municipality_code: '',
        current_municipality: '',
      }));
      return;
    }

    const reg = regionsList.find((r) => r.code === regionCode);
    const regName = reg ? (reg.displayName || reg.name) : '';

    const provs = await getProvinces(regionCode);
    setProvincesList(provs);

    if (provs.length > 0) {
      setCitiesList([]);
      setFormData((prev) => ({
        ...prev,
        region_code: regionCode,
        region: regName,
        province_code: '',
        province: '',
        municipality_code: '',
        municipality: '',
        permanent_region_code: regionCode,
        permanent_region: regName,
        permanent_province_code: '',
        permanent_province: '',
        permanent_municipality_code: '',
        permanent_municipality: '',
        current_region_code: regionCode,
        current_region: regName,
        current_province_code: '',
        current_province: '',
        current_municipality_code: '',
        current_municipality: '',
      }));
    } else {
      // Province-less region (e.g. NCR)
      const cities = await getCitiesMunicipalities(regionCode, null);
      setCitiesList(cities);

      setFormData((prev) => ({
        ...prev,
        region_code: regionCode,
        region: regName,
        province_code: '',
        province: 'N/A',
        municipality_code: '',
        municipality: '',
        permanent_region_code: regionCode,
        permanent_region: regName,
        permanent_province_code: '',
        permanent_province: 'N/A',
        permanent_municipality_code: '',
        permanent_municipality: '',
        current_region_code: regionCode,
        current_region: regName,
        current_province_code: '',
        current_province: 'N/A',
        current_municipality_code: '',
        current_municipality: '',
      }));
    }
  };

  const handleProvinceChange = async (provinceCode) => {
    if (!provinceCode) {
      setCitiesList([]);
      setFormData((prev) => ({
        ...prev,
        province_code: '',
        province: '',
        municipality_code: '',
        municipality: '',
        permanent_province_code: '',
        permanent_province: '',
        permanent_municipality_code: '',
        permanent_municipality: '',
        current_province_code: '',
        current_province: '',
        current_municipality_code: '',
        current_municipality: '',
      }));
      return;
    }

    const prov = provincesList.find((p) => p.code === provinceCode);
    const provName = prov ? prov.name : '';

    const currentRegCode = formData.region_code || formData.permanent_region_code || formData.current_region_code;
    const cities = await getCitiesMunicipalities(currentRegCode, provinceCode);
    setCitiesList(cities);

    setFormData((prev) => ({
      ...prev,
      province_code: provinceCode,
      province: provName,
      municipality_code: '',
      municipality: '',
      permanent_province_code: provinceCode,
      permanent_province: provName,
      permanent_municipality_code: '',
      permanent_municipality: '',
      current_province_code: provinceCode,
      current_province: provName,
      current_municipality_code: '',
      current_municipality: '',
    }));
  };

  const handleMunicipalityChange = (municipalityCode) => {
    if (!municipalityCode) {
      setFormData((prev) => ({
        ...prev,
        municipality_code: '',
        municipality: '',
        permanent_municipality_code: '',
        permanent_municipality: '',
        current_municipality_code: '',
        current_municipality: '',
      }));
      return;
    }

    const city = citiesList.find((c) => c.code === municipalityCode);
    const cityName = city ? city.name : '';
    setFormData((prev) => ({
      ...prev,
      municipality_code: municipalityCode,
      municipality: cityName,
      permanent_municipality_code: municipalityCode,
      permanent_municipality: cityName,
      current_municipality_code: municipalityCode,
      current_municipality: cityName,
    }));
  };

  // Camera Management
  const startCamera = async () => {
    try {
      setFaceMsg('');
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraActive(true);
    } catch {
      setFaceMsgType('danger');
      setFaceMsg('Camera access failed. Please ensure camera permissions are granted.');
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

  // Step 1: Submit Demographic & Contact Form
  const handleSubmitForm = async (e, proceedToFace = true) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    // Validation
    if (!formData.family_name.trim() || !formData.given_name.trim()) {
      setErrorMsg('Please enter both Family Name (Last Name) and Given Name (First Name).');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    if (formData.mobile_number) {
      const phErr = getPhPhoneValidationMessage(formData.mobile_number);
      if (phErr) {
        setErrorMsg(phErr);
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }
    }

    try {
      setSubmitting(true);

      const langs = [];
      if (formData.lang_english) langs.push('English');
      if (formData.lang_filipino) langs.push('Filipino');
      if (formData.lang_cebuano) langs.push('Cebuano');
      if (formData.lang_others.trim()) langs.push(formData.lang_others.trim());

      const finalAddress = (formData.address || formData.permanent_address || formData.current_address || '').trim();
      const finalRegion = formData.region || formData.permanent_region || formData.current_region || '';
      const finalProvince = formData.province || formData.permanent_province || formData.current_province || '';
      const finalMunicipality = formData.municipality || formData.permanent_municipality || formData.current_municipality || '';

      const payload = {
        role: 'student',
        student_id: formData.student_id || 'auto',
        first_name: formData.given_name.trim(),
        last_name: formData.family_name.trim(),
        middle_name: formData.middle_name.trim(),
        gender: formData.gender,
        birth_date: formData.birth_date || null,
        birth_place: formData.birth_place.trim(),
        civil_status: formData.civil_status,
        religion: formData.religion.trim(),
        citizenship: formData.citizenship.trim(),
        languages_spoken: langs.join(', '),

        // Address (populated with verified single address)
        current_address: finalAddress,
        current_region: finalRegion,
        current_province: finalProvince,
        current_municipality: finalMunicipality,
        permanent_address: finalAddress,
        permanent_region: finalRegion,
        permanent_province: finalProvince,
        permanent_municipality: finalMunicipality,

        // Contact
        telephone: formData.telephone.trim(),
        mobile_number: formData.mobile_number.trim(),
        phone: formData.mobile_number.trim() || formData.telephone.trim(),
        email: formData.email.trim(),
        password: formData.password || 'student123',

        // Baseline progression: Freshman, Course unassigned
        year_level: 1,
        course: '',
      };

      const res = await Api.createUser(payload);
      setEnrolledStudent(res);
      const studentAssignedId = res.student_profile?.student_id || formData.student_id;
      setSuccessMsg(`Student ${payload.first_name} ${payload.last_name} (${studentAssignedId}) registered successfully!`);

      if (proceedToFace) {
        setActiveStep(2);
        setTimeout(startCamera, 150);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        setTimeout(() => onNavigate('face_enrollment'), 1800);
      }
    } catch (err) {
      setErrorMsg(err.message || 'Failed to submit student enrollment. Please verify form details.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setSubmitting(false);
    }
  };

  // Step 2: Capture Face Biometrics
  const handleCaptureFace = async () => {
    if (!videoRef.current || !enrolledStudent) return;
    try {
      setEnrollingFace(true);
      setFaceMsg('');

      setFlash(true);
      setTimeout(() => setFlash(false), 200);

      const video = videoRef.current;
      const canvas = canvasRef.current || document.createElement('canvas');
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const frameB64 = canvas.toDataURL('image/jpeg', 0.9);
      const studentProfileId = enrolledStudent.student_profile?.id;

      if (!studentProfileId) {
        throw new Error('Student profile record not found. Unable to link face capture.');
      }

      const res = await Api.enrollFace(studentProfileId, frameB64);
      setFaceMsgType('success');
      setFaceMsg(res.message || 'Facial biometrics enrolled and linked successfully!');
      stopCamera();

      setTimeout(() => {
        clearEnrollmentSession();
        onNavigate('face_enrollment');
      }, 2200);
    } catch (err) {
      setFaceMsgType('danger');
      setFaceMsg(err.message || 'Failed to enroll facial biometrics. Please reposition and try again.');
    } finally {
      setEnrollingFace(false);
    }
  };

  return (
    <div className="page-content" style={{ maxWidth: '1150px', margin: '0 auto', paddingBottom: '60px' }}>
      {/* Alerts */}
      {errorMsg && (
        <div className="alert alert-danger" style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <AlertCircle size={18} />
          <span style={{ fontSize: '13px' }}>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="alert alert-success" style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <CheckCircle2 size={18} />
          <span style={{ fontSize: '13px' }}>{successMsg}</span>
        </div>
      )}

      {/* Step Indicator */}
      <div
        style={{
          display: 'flex',
          gap: '12px',
          marginBottom: '20px',
        }}
      >
        <button
          type="button"
          onClick={() => setActiveStep(1)}
          style={{
            flex: 1,
            padding: '12px 16px',
            background: activeStep === 1 ? 'var(--bg-secondary)' : 'var(--bg-primary)',
            border: activeStep === 1 ? '2px solid var(--accent)' : '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            cursor: 'pointer',
            textAlign: 'left',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            transition: 'all 0.15s ease',
          }}
        >
          <div
            style={{
              width: '28px',
              height: '28px',
              borderRadius: '50%',
              background: activeStep === 1 ? 'var(--accent)' : 'var(--border)',
              color: activeStep === 1 ? '#fff' : 'var(--text-muted)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
              fontSize: '13px',
            }}
          >
            1
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: '13px', color: 'var(--text-primary)' }}>
              Step 1: Student Information
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              Personal profile, dynamic address & contact details
            </div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => {
            if (enrolledStudent) setActiveStep(2);
          }}
          disabled={!enrolledStudent}
          style={{
            flex: 1,
            padding: '12px 16px',
            background: activeStep === 2 ? 'var(--bg-secondary)' : 'var(--bg-primary)',
            border: activeStep === 2 ? '2px solid var(--accent)' : '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            cursor: enrolledStudent ? 'pointer' : 'not-allowed',
            opacity: enrolledStudent ? 1 : 0.65,
            textAlign: 'left',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            transition: 'all 0.15s ease',
          }}
        >
          <div
            style={{
              width: '28px',
              height: '28px',
              borderRadius: '50%',
              background: activeStep === 2 ? 'var(--accent)' : 'var(--border)',
              color: activeStep === 2 ? '#fff' : 'var(--text-muted)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
              fontSize: '13px',
            }}
          >
            2
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: '13px', color: 'var(--text-primary)' }}>
              Step 2: Facial Biometric Enrollment
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              {enrolledStudent ? 'Live camera capture ready' : 'Save profile first to unlock'}
            </div>
          </div>
        </button>
      </div>

      {/* STEP 1: FORM VIEW */}
      {activeStep === 1 && (
        <form onSubmit={(e) => handleSubmitForm(e, true)}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(480px, 1fr))',
              gap: '20px',
            }}
          >
            {/* ══ LEFT COLUMN ══ */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Personal Details Card */}
              <div className="card">
                <div className="card-header" style={{ borderBottom: '1px solid var(--border)' }}>
                  <span className="card-title" style={{ fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <GraduationCap size={16} /> Personal Information
                  </span>
                </div>
                <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {/* Family Name */}
                  <div className="floating-field">
                    <input
                      type="text"
                      id="family_name"
                      className="floating-input"
                      placeholder=" "
                      required
                      value={formData.family_name}
                      onChange={(e) => setFormData({ ...formData, family_name: e.target.value.toUpperCase() })}
                    />
                    <label htmlFor="family_name" className="floating-label">
                      Family Name (Last Name) <span style={{ color: '#dc2626' }}>*</span>
                    </label>
                  </div>

                  {/* Given Name */}
                  <div className="floating-field">
                    <input
                      type="text"
                      id="given_name"
                      className="floating-input"
                      placeholder=" "
                      required
                      value={formData.given_name}
                      onChange={(e) => setFormData({ ...formData, given_name: e.target.value.toUpperCase() })}
                    />
                    <label htmlFor="given_name" className="floating-label">
                      Given Name (First Name) <span style={{ color: '#dc2626' }}>*</span>
                    </label>
                  </div>

                  {/* Middle Name */}
                  <div className="floating-field">
                    <input
                      type="text"
                      id="middle_name"
                      className="floating-input"
                      placeholder=" "
                      value={formData.middle_name}
                      onChange={(e) => setFormData({ ...formData, middle_name: e.target.value.toUpperCase() })}
                    />
                    <label htmlFor="middle_name" className="floating-label">
                      Middle Name (Optional)
                    </label>
                  </div>

                  {/* Date of Birth & Place of Birth */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                    <div className="floating-field">
                      <input
                        type="date"
                        id="birth_date"
                        className="floating-input"
                        placeholder=" "
                        required
                        value={formData.birth_date}
                        onChange={(e) => setFormData({ ...formData, birth_date: e.target.value })}
                      />
                      <label htmlFor="birth_date" className="floating-label">
                        Date of Birth <span style={{ color: '#dc2626' }}>*</span>
                      </label>
                    </div>
                    <div className="floating-field">
                      <input
                        type="text"
                        id="birth_place"
                        className="floating-input"
                        placeholder=" "
                        required
                        value={formData.birth_place}
                        onChange={(e) => setFormData({ ...formData, birth_place: e.target.value.toUpperCase() })}
                      />
                      <label htmlFor="birth_place" className="floating-label">
                        Place of Birth <span style={{ color: '#dc2626' }}>*</span>
                      </label>
                    </div>
                  </div>
                </div>
              </div>


              {/* Demographics & Civil Status Card */}
              <div className="card">
                <div className="card-header" style={{ borderBottom: '1px solid var(--border)' }}>
                  <span className="card-title" style={{ fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <ShieldCheck size={16} /> Demographics & Civil Status
                  </span>
                </div>
                <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {/* Gender Pill Buttons & Civil Status */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px', alignItems: 'center' }}>
                    {/* Gender */}
                    <div>
                      <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        Gender <span style={{ color: '#dc2626' }}>*</span>
                      </div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          type="button"
                          onClick={() => setFormData({ ...formData, gender: 'Male' })}
                          style={{
                            flex: 1,
                            padding: '9px 12px',
                            borderRadius: 'var(--radius)',
                            border: formData.gender === 'Male' ? '2px solid #2563eb' : '1.5px solid var(--border)',
                            background: formData.gender === 'Male' ? '#eff6ff' : '#ffffff',
                            color: formData.gender === 'Male' ? '#1d4ed8' : 'var(--text-secondary)',
                            fontWeight: 650,
                            fontSize: '13px',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                          }}
                        >
                          Male
                        </button>
                        <button
                          type="button"
                          onClick={() => setFormData({ ...formData, gender: 'Female' })}
                          style={{
                            flex: 1,
                            padding: '9px 12px',
                            borderRadius: 'var(--radius)',
                            border: formData.gender === 'Female' ? '2px solid #2563eb' : '1.5px solid var(--border)',
                            background: formData.gender === 'Female' ? '#eff6ff' : '#ffffff',
                            color: formData.gender === 'Female' ? '#1d4ed8' : 'var(--text-secondary)',
                            fontWeight: 650,
                            fontSize: '13px',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                          }}
                        >
                          Female
                        </button>
                      </div>
                    </div>

                    {/* Civil Status */}
                    <div className="floating-field">
                      <select
                        id="civil_status"
                        className="floating-select"
                        value={formData.civil_status}
                        onChange={(e) => setFormData({ ...formData, civil_status: e.target.value })}
                      >
                        <option value="Single">Single</option>
                        <option value="Married">Married</option>
                        <option value="Widowed">Widowed</option>
                        <option value="Separated">Separated</option>
                      </select>
                      <label htmlFor="civil_status" className="floating-label">
                        Civil Status
                      </label>
                    </div>
                  </div>

                  {/* Religion & Citizenship */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
                    <div className="floating-field">
                      <select
                        id="religion"
                        className="floating-select"
                        value={formData.religion}
                        onChange={(e) => setFormData({ ...formData, religion: e.target.value })}
                      >
                        <option value="Roman Catholic">Roman Catholic</option>
                        <option value="Seventh-day Adventist">Seventh-day Adventist</option>
                        <option value="Iglesia ni Cristo">Iglesia ni Cristo</option>
                        <option value="Baptist">Baptist</option>
                        <option value="Islam">Islam</option>
                        <option value="Born Again Christian">Born Again Christian</option>
                        <option value="Other">Other</option>
                      </select>
                      <label htmlFor="religion" className="floating-label">
                        Religion
                      </label>
                    </div>

                    <div className="floating-field">
                      <input
                        type="text"
                        id="citizenship"
                        className="floating-input"
                        placeholder=" "
                        value={formData.citizenship}
                        onChange={(e) => setFormData({ ...formData, citizenship: e.target.value })}
                      />
                      <label htmlFor="citizenship" className="floating-label">
                        Citizenship
                      </label>
                    </div>
                  </div>

                  {/* Languages Spoken */}
                  <div>
                    <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Languages Spoken
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'center', fontSize: '13px' }}>
                      <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={formData.lang_english}
                          onChange={(e) => setFormData({ ...formData, lang_english: e.target.checked })}
                        />
                        <span>English</span>
                      </label>
                      <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={formData.lang_filipino}
                          onChange={(e) => setFormData({ ...formData, lang_filipino: e.target.checked })}
                        />
                        <span>Filipino</span>
                      </label>
                      <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={formData.lang_cebuano}
                          onChange={(e) => setFormData({ ...formData, lang_cebuano: e.target.checked })}
                        />
                        <span>Cebuano</span>
                      </label>
                      <div className="floating-field" style={{ width: '160px' }}>
                        <input
                          type="text"
                          id="lang_others"
                          className="floating-input"
                          style={{ height: '42px', paddingTop: '18px', paddingBottom: '2px', fontSize: '12.5px' }}
                          placeholder=" "
                          value={formData.lang_others}
                          onChange={(e) => setFormData({ ...formData, lang_others: e.target.value })}
                        />
                        <label htmlFor="lang_others" className="floating-label" style={{ top: '12px', fontSize: '12px' }}>
                          Other Dialect
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* ══ RIGHT COLUMN ══ */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Address Information Card */}
              <div className="card">
                <div className="card-header" style={{ borderBottom: '1px solid var(--border)' }}>
                  <span className="card-title" style={{ fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <MapPin size={16} /> Address Information
                  </span>
                </div>
                <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div className="floating-field">
                    <textarea
                      id="address"
                      className="floating-textarea"
                      rows={2}
                      placeholder=" "
                      value={formData.address || formData.permanent_address || formData.current_address || ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        setFormData((prev) => ({
                          ...prev,
                          address: val,
                          permanent_address: val,
                          current_address: val,
                        }));
                      }}
                    />
                    <label htmlFor="address" className="floating-label">
                      House#/Street Name & Barangay
                    </label>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px' }}>
                    {/* Region API Dropdown */}
                    <div className="floating-field">
                      <select
                        id="region_select"
                        className="floating-select"
                        value={formData.region_code || formData.permanent_region_code || formData.current_region_code || ''}
                        onChange={(e) => handleRegionChange(e.target.value)}
                      >
                        <option value="">-- Select Region --</option>
                        {regionsList.map((r) => (
                          <option key={r.code} value={r.code}>
                            {r.displayName || r.name}
                          </option>
                        ))}
                      </select>
                      <label htmlFor="region_select" className="floating-label">
                        Region
                      </label>
                    </div>

                    {/* Province API Dropdown */}
                    <div className="floating-field">
                      <select
                        id="province_select"
                        className="floating-select"
                        value={formData.province_code || formData.permanent_province_code || formData.current_province_code || ''}
                        onChange={(e) => handleProvinceChange(e.target.value)}
                        disabled={!formData.region_code && !formData.permanent_region_code && !formData.current_region_code}
                      >
                        <option value="">
                          {!formData.region_code && !formData.permanent_region_code && !formData.current_region_code
                            ? '-- Select Region First --'
                            : provincesList.length === 0
                            ? 'N/A (Metropolitan / Province-less)'
                            : '-- Select Province --'}
                        </option>
                        {provincesList.map((p) => (
                          <option key={p.code} value={p.code}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                      <label htmlFor="province_select" className="floating-label">
                        Province
                      </label>
                    </div>

                    {/* Municipality / City API Dropdown */}
                    <div className="floating-field">
                      <select
                        id="municipality_select"
                        className="floating-select"
                        value={formData.municipality_code || formData.permanent_municipality_code || formData.current_municipality_code || ''}
                        onChange={(e) => handleMunicipalityChange(e.target.value)}
                        disabled={
                          (!formData.region_code && !formData.permanent_region_code && !formData.current_region_code) ||
                          (provincesList.length > 0 && !formData.province_code && !formData.permanent_province_code && !formData.current_province_code)
                        }
                      >
                        <option value="">
                          {!formData.region_code && !formData.permanent_region_code && !formData.current_region_code
                            ? '-- Select Region First --'
                            : provincesList.length > 0 && !formData.province_code && !formData.permanent_province_code && !formData.current_province_code
                            ? '-- Select Province First --'
                            : '-- Select City / Municipality --'}
                        </option>
                        {citiesList.map((c) => (
                          <option key={c.code} value={c.code}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                      <label htmlFor="municipality_select" className="floating-label">
                        City / Municipality
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              {/* Communication & Account Security Card */}
              <div className="card">
                <div className="card-header" style={{ borderBottom: '1px solid var(--border)' }}>
                  <span className="card-title" style={{ fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Phone size={16} /> Communication & Security
                  </span>
                </div>
                <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {/* Mobile & Phone */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                    <div>
                      <PhoneInput
                        id="mobile_number"
                        floatingLabel="Mobile Number"
                        required
                        value={formData.mobile_number}
                        onChange={(e) => setFormData({ ...formData, mobile_number: e.target.value })}
                      />
                      <div className="floating-helper" style={{ color: '#64748b' }}>
                        Used for automated attendance SMS alerts
                      </div>
                    </div>

                    <div className="floating-field">
                      <input
                        type="text"
                        id="telephone"
                        className="floating-input"
                        placeholder=" "
                        value={formData.telephone}
                        onChange={(e) => setFormData({ ...formData, telephone: e.target.value })}
                      />
                      <label htmlFor="telephone" className="floating-label">
                        Telephone / Landline
                      </label>
                    </div>
                  </div>

                  {/* Personal Email */}
                  <div className="floating-field">
                    <input
                      type="email"
                      id="email"
                      className="floating-input"
                      placeholder=" "
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    />
                    <label htmlFor="email" className="floating-label">
                      Personal Email Address (Optional)
                    </label>
                    <div className="floating-helper" style={{ color: 'var(--text-muted)' }}>
                      Student's personal email (e.g. Gmail, Yahoo). Institutional email is issued upon enrollment.
                    </div>
                  </div>

                  {/* Initial Password */}
                  <div>
                    <PasswordInput
                      id="password"
                      floatingLabel="Default Account Password"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      showStrength={formData.password.length > 0 && formData.password !== 'student123'}
                    />
                    <div className="floating-helper" style={{ color: 'var(--text-muted)' }}>
                      Standard default is <code>student123</code>. Student can update upon first login.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Form Actions Footer */}
          <div
            style={{
              marginTop: '24px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '12px',
              padding: '16px 20px',
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => {
                clearEnrollmentSession();
                onNavigate('face_enrollment');
              }}
            >
              Cancel & Return
            </button>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                type="button"
                className="btn btn-secondary"
                disabled={submitting}
                onClick={(e) => handleSubmitForm(e, false)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <span>Save Profile Only (Skip Camera)</span>
              </button>

              <button
                type="submit"
                className="btn btn-primary"
                disabled={submitting}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '10px 22px' }}
              >
                <Camera size={16} />
                <span>{submitting ? 'Registering...' : 'Save & Proceed to Face Biometrics ➔'}</span>
              </button>
            </div>
          </div>
        </form>
      )}

      {/* STEP 2: BIOMETRIC FACE ENROLLMENT VIEW */}
      {activeStep === 2 && (
        <div className="card" style={{ maxWidth: '800px', margin: '0 auto' }}>
          <div
            className="card-header"
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderBottom: '1px solid var(--border)',
              padding: '16px 20px',
            }}
          >
            <div>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Camera size={18} />
                <span>Facial Biometric Capture</span>
              </h3>
              <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '2px' }}>
                Enrolling biometric record for {formData.given_name} {formData.family_name}
              </div>
            </div>

            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => setActiveStep(1)}
            >
              Review Form Details
            </button>
          </div>

          <div className="card-body" style={{ textAlign: 'center', padding: '24px' }}>
            {/* Viewfinder Card */}
            <div
              style={{
                position: 'relative',
                width: '100%',
                maxWidth: '560px',
                height: '380px',
                margin: '0 auto',
                background: '#090d16',
                borderRadius: 'var(--radius)',
                overflow: 'hidden',
                boxShadow: 'inset 0 0 20px rgba(0,0,0,0.8)',
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
                  display: cameraActive ? 'block' : 'none',
                }}
              />

              {!cameraActive && (
                <div style={{ textAlign: 'center', padding: '20px' }}>
                  <div
                    style={{
                      width: '64px',
                      height: '64px',
                      borderRadius: '50%',
                      background: 'rgba(255, 255, 255, 0.08)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      margin: '0 auto 16px',
                    }}
                  >
                    <Camera size={32} style={{ color: 'rgba(255,255,255,0.7)' }} />
                  </div>
                  <div style={{ color: '#ffffff', fontWeight: 600, fontSize: '15px', marginBottom: '8px' }}>
                    Camera Ready for Face Enrollment
                  </div>
                  <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '12px', maxWidth: '300px', margin: '0 auto 20px' }}>
                    Click below to activate the webcam and align the student's face within the guide.
                  </div>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={startCamera}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
                  >
                    <Camera size={16} />
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
                      width: '200px',
                      height: '260px',
                      border: '2px dashed rgba(255, 255, 255, 0.85)',
                      borderRadius: '50% 50% 45% 45%',
                      boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.35)',
                      pointerEvents: 'none',
                    }}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      bottom: '12px',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      background: 'rgba(0, 0, 0, 0.75)',
                      color: '#fff',
                      fontSize: '11px',
                      padding: '4px 12px',
                      borderRadius: '20px',
                      pointerEvents: 'none',
                    }}
                  >
                    Align face inside the oval frame looking directly at the camera
                  </div>
                </>
              )}

              {/* Shutter Flash */}
              {flash && (
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    background: '#fff',
                    opacity: 0.8,
                    pointerEvents: 'none',
                    zIndex: 10,
                  }}
                />
              )}
            </div>

            {/* Results Alert */}
            {faceMsg && (
              <div
                className={`alert alert-${faceMsgType}`}
                style={{
                  marginTop: '16px',
                  maxWidth: '560px',
                  margin: '16px auto 0',
                  textAlign: 'left',
                  fontSize: '13px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                {faceMsgType === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                <span>{faceMsg}</span>
              </div>
            )}

            {/* Camera Controls */}
            {cameraActive && (
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  gap: '12px',
                  marginTop: '20px',
                }}
              >
                <button
                  type="button"
                  className="btn btn-success"
                  onClick={handleCaptureFace}
                  disabled={enrollingFace}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '10px 24px', fontSize: '14px' }}
                >
                  <Target size={16} />
                  <span>{enrollingFace ? 'Analyzing Face...' : 'Capture & Enroll Face'}</span>
                </button>

                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={stopCamera}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  <Square size={15} />
                  <span>Stop Camera</span>
                </button>
              </div>
            )}

            {/* Bottom Actions */}
            <div
              style={{
                marginTop: '30px',
                paddingTop: '20px',
                borderTop: '1px solid var(--border)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => {
                  stopCamera();
                  clearEnrollmentSession();
                  onNavigate('face_enrollment');
                }}
              >
                Skip & Finish Later
              </button>

              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  stopCamera();
                  clearEnrollmentSession();
                  onNavigate('face_enrollment');
                }}
              >
                Done / Back to Registered Students
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
