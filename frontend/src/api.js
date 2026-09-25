/**
 * AttendFR REST API Client
 * Seamlessly interfaces with Django REST Framework backend on Render / Localhost.
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

export function getApiBaseUrl() {
  return API_BASE_URL.replace(/\/+$/, '');
}

export const TokenStorage = {
  getAccess: () => localStorage.getItem('attendfr_access_token'),
  getRefresh: () => localStorage.getItem('attendfr_refresh_token'),
  getUser: () => {
    try {
      const u = localStorage.getItem('attendfr_user');
      return u ? JSON.parse(u) : null;
    } catch {
      return null;
    }
  },
  set: (access, refresh, user) => {
    if (access) localStorage.setItem('attendfr_access_token', access);
    if (refresh) localStorage.setItem('attendfr_refresh_token', refresh);
    if (user) localStorage.setItem('attendfr_user', JSON.stringify(user));
  },
  clear: () => {
    localStorage.removeItem('attendfr_access_token');
    localStorage.removeItem('attendfr_refresh_token');
    localStorage.removeItem('attendfr_user');
  },
};

export async function apiRequest(endpoint, options = {}) {
  const url = `${getApiBaseUrl()}${endpoint.startsWith('/') ? endpoint : '/' + endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  const token = TokenStorage.getAccess();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  let response = await fetch(url, { ...options, headers });

  // Handle Token Expiry & Automatic Refresh
  if (response.status === 401 && TokenStorage.getRefresh()) {
    try {
      const refreshRes = await fetch(`${getApiBaseUrl()}/api/token/refresh/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh: TokenStorage.getRefresh() }),
      });
      if (refreshRes.ok) {
        const data = await refreshRes.json();
        TokenStorage.set(data.access, data.refresh || null, null);
        headers['Authorization'] = `Bearer ${data.access}`;
        response = await fetch(url, { ...options, headers });
      } else if (refreshRes.status === 401 || refreshRes.status === 400) {
        TokenStorage.clear();
      }
    } catch {
      // Network failure during refresh - avoid wiping stored credentials on transient offline state
    }
  }

  return response;
}

export const Api = {
  // Auth
  login: async (username, password) => {
    const res = await fetch(`${getApiBaseUrl()}/api/token/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Invalid username or password');
    }
    const data = await res.json();
    TokenStorage.set(data.access, data.refresh, null);

    // Fetch user profile immediately
    const meRes = await apiRequest('/api/auth/me/');
    if (meRes.ok) {
      const meData = await meRes.json();
      TokenStorage.set(data.access, data.refresh, meData);
      return { tokens: data, user: meData };
    }
    return { tokens: data, user: null };
  },

  logout: () => {
    TokenStorage.clear();
  },

  getMe: async () => {
    const res = await apiRequest('/api/auth/me/');
    if (!res.ok) throw new Error('Failed to load user profile');
    return res.json();
  },

  getDashboardStats: async () => {
    const res = await apiRequest('/api/dashboard/stats/');
    if (!res.ok) throw new Error('Failed to load dashboard statistics');
    return res.json();
  },

  // Users Management
  getUsers: async (role = null, search = '') => {
    const params = new URLSearchParams();
    if (role && role !== 'all') params.append('role', role);
    if (search) params.append('search', search);
    const qs = params.toString() ? `?${params.toString()}` : '';
    const res = await apiRequest(`/api/users/${qs}`);
    if (!res.ok) return [];
    return res.json();
  },

  createUser: async (userData) => {
    const res = await apiRequest('/api/users/', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to create user');
    }
    return res.json();
  },

  updateUser: async (id, userData) => {
    const res = await apiRequest(`/api/users/${id}/`, {
      method: 'PATCH',
      body: JSON.stringify(userData),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to update user');
    }
    return res.json();
  },

  deleteUser: async (id) => {
    const res = await apiRequest(`/api/users/${id}/`, { method: 'DELETE' });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to delete user');
    }
    return true;
  },

  // Academic Catalog
  getPrograms: async () => {
    const res = await apiRequest('/api/programs/');
    if (!res.ok) return [];
    return res.json();
  },

  createProgram: async (programData) => {
    const res = await apiRequest('/api/programs/', {
      method: 'POST',
      body: JSON.stringify(programData),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || err.error || 'Failed to create program');
    }
    return res.json();
  },

  getSections: async () => {
    const res = await apiRequest('/api/sections/');
    if (!res.ok) return [];
    return res.json();
  },

  createSection: async (sectionData) => {
    const res = await apiRequest('/api/sections/', {
      method: 'POST',
      body: JSON.stringify(sectionData),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || err.error || 'Failed to create section');
    }
    return res.json();
  },

  getSchedules: async (sectionId = null) => {
    const q = sectionId ? `?section_id=${sectionId}` : '';
    const res = await apiRequest(`/api/schedules/${q}`);
    if (!res.ok) return [];
    return res.json();
  },

  createSchedule: async (scheduleData) => {
    const res = await apiRequest('/api/schedules/', {
      method: 'POST',
      body: JSON.stringify(scheduleData),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || err.error || 'Failed to create schedule');
    }
    return res.json();
  },

  updateSchedule: async (id, scheduleData) => {
    const res = await apiRequest(`/api/schedules/${id}/`, {
      method: 'PATCH',
      body: JSON.stringify(scheduleData),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || err.error || (Array.isArray(err) ? err[0] : 'Failed to update schedule'));
    }
    return res.json();
  },

  getProgramSections: async (filters = null) => {
    let q = '';
    if (typeof filters === 'number' || (typeof filters === 'string' && filters)) {
      q = `?program=${filters}`;
    } else if (filters && typeof filters === 'object') {
      const params = new URLSearchParams();
      if (filters.program) params.append('program', filters.program);
      if (filters.course) params.append('course', filters.course);
      if (filters.year_level) params.append('year_level', filters.year_level);
      const str = params.toString();
      if (str) q = `?${str}`;
    }
    const res = await apiRequest(`/api/program-sections/${q}`);
    if (!res.ok) return [];
    return res.json();
  },

  createProgramSection: async (sectionData) => {
    const res = await apiRequest('/api/program-sections/', {
      method: 'POST',
      body: JSON.stringify(sectionData),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || err.error || 'Failed to create section definition');
    }
    return res.json();
  },

  getSubjects: async () => {
    const res = await apiRequest('/api/subjects/');
    if (!res.ok) return [];
    return res.json();
  },

  createSubject: async (subjectData) => {
    const res = await apiRequest('/api/subjects/', {
      method: 'POST',
      body: JSON.stringify(subjectData),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || err.error || 'Failed to create subject offering');
    }
    return res.json();
  },

  updateSubject: async (id, subjectData) => {
    const res = await apiRequest(`/api/subjects/${id}/`, {
      method: 'PATCH',
      body: JSON.stringify(subjectData),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || err.error || 'Failed to update subject');
    }
    return res.json();
  },

  updateProgram: async (id, programData) => {
    const res = await apiRequest(`/api/programs/${id}/`, {
      method: 'PATCH',
      body: JSON.stringify(programData),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || err.error || 'Failed to update program');
    }
    return res.json();
  },

  updateSection: async (id, sectionData) => {
    const res = await apiRequest(`/api/sections/${id}/`, {
      method: 'PATCH',
      body: JSON.stringify(sectionData),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || err.error || 'Failed to update section');
    }
    return res.json();
  },

  deleteProgram: async (id) => {
    const res = await apiRequest(`/api/programs/${id}/`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete program');
    return true;
  },

  deleteProgramSection: async (id) => {
    const res = await apiRequest(`/api/program-sections/${id}/`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete section definition');
    return true;
  },

  deleteSection: async (id) => {
    const res = await apiRequest(`/api/sections/${id}/`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete section');
    return true;
  },

  getSectionEnrollments: async (sectionId) => {
    const res = await apiRequest(`/api/sections/${sectionId}/enrollments/`);
    if (!res.ok) return [];
    return res.json();
  },

  enrollStudent: async (sectionId, studentId, subjectId = null) => {
    const res = await apiRequest(`/api/sections/${sectionId}/enrollments/`, {
      method: 'POST',
      body: JSON.stringify({
        student: studentId,
        subject: subjectId || null,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || err.detail || 'Failed to enroll student');
    }
    return res.json();
  },

  unenrollStudent: async (sectionId, enrollmentId) => {
    const res = await apiRequest(`/api/sections/${sectionId}/enrollments/${enrollmentId}/`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || err.detail || 'Failed to unenroll student');
    }
    return true;
  },

  deleteSchedule: async (id) => {
    const res = await apiRequest(`/api/schedules/${id}/`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete schedule');
    return true;
  },

  deleteSubject: async (id) => {
    const res = await apiRequest(`/api/subjects/${id}/`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete subject');
    return true;
  },

  getTeachers: async () => {
    const res = await apiRequest('/api/users/?role=teacher');
    if (!res.ok) return [];
    return res.json();
  },

  getStudents: async (search = '') => {
    const q = search ? `?search=${encodeURIComponent(search)}` : '';
    const res = await apiRequest(`/api/students/${q}`);
    if (!res.ok) return [];
    return res.json();
  },

  getNextStudentId: async () => {
    const res = await apiRequest('/api/students/next-id/');
    if (!res.ok) return { next_student_id: '' };
    return res.json();
  },

  updateProfile: async (profileData) => {
    const res = await apiRequest('/api/auth/me/', {
      method: 'PATCH',
      body: JSON.stringify(profileData),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || err.error || 'Failed to update profile');
    }
    const data = await res.json();
    TokenStorage.set(null, null, data);
    return data;
  },

  // Attendance Sessions
  getSessions: async () => {
    const res = await apiRequest('/api/attendance/sessions/');
    if (!res.ok) return [];
    return res.json();
  },

  startSession: async (scheduleId) => {
    const res = await apiRequest('/api/attendance/sessions/start/', {
      method: 'POST',
      body: JSON.stringify({ schedule_id: scheduleId }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to start session');
    }
    return res.json();
  },

  closeSession: async (sessionId) => {
    const res = await apiRequest(`/api/attendance/sessions/${sessionId}/close/`, {
      method: 'POST',
    });
    if (!res.ok) throw new Error('Failed to close session');
    return res.json();
  },

  reopenSession: async (sessionId) => {
    const res = await apiRequest(`/api/attendance/sessions/${sessionId}/reopen/`, {
      method: 'POST',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to reopen attendance session');
    }
    return res.json();
  },

  getSessionDetail: async (sessionId) => {
    const res = await apiRequest(`/api/attendance/sessions/${sessionId}/`);
    if (!res.ok) throw new Error('Failed to load session details');
    return res.json();
  },

  // Face Recognition & Enrollment
  recognizeFace: async (sessionId, frameBase64) => {
    const res = await apiRequest('/api/face/recognize/', {
      method: 'POST',
      body: JSON.stringify({ session_id: sessionId, frame: frameBase64 }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      if (err.session_closed) {
        return { success: false, session_closed: true, error: err.error };
      }
      throw new Error(err.error || 'Face recognition service error');
    }
    return res.json();
  },

  enrollFace: async (studentId, frameBase64) => {
    const res = await apiRequest('/api/face/enroll/', {
      method: 'POST',
      body: JSON.stringify({ student_id: studentId, frame: frameBase64 }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || err.message || 'Face enrollment failed');
    }
    return res.json();
  },
  markAttendance: async (sessionId, studentId, status = 'present') => {
    const res = await apiRequest('/api/attendance/records/mark/', {
      method: 'POST',
      body: JSON.stringify({ session_id: sessionId, student_id: studentId, status }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to mark attendance');
    }
    return res.json();
  },

  // Student Attendance Overview & Monthly Calendar
  getStudentAttendanceOverview: async (studentId = null) => {
    let endpoint = '/api/attendance/student/overview/';
    if (studentId) endpoint += `?student_id=${studentId}`;
    const res = await apiRequest(endpoint);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to load student attendance overview');
    }
    return res.json();
  },

  getStudentAttendanceCalendar: async (sectionId, year = null, month = null, studentId = null) => {
    let endpoint = `/api/attendance/student/calendar/${sectionId}/?format=json`;
    if (year && month) endpoint += `&year=${year}&month=${month}`;
    if (studentId) endpoint += `&student_id=${studentId}`;
    const res = await apiRequest(endpoint);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to load attendance calendar');
    }
    return res.json();
  },
};

