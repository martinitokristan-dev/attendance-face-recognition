import React, { useState, useEffect, useCallback } from 'react';
import { Api, TokenStorage } from './api';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import LoginView from './views/LoginView';
import DashboardView from './views/DashboardView';
import ProgramsView from './views/ProgramsView';
import SectionCatalogView from './views/SectionCatalogView';
import SectionsView from './views/SectionsView';
import SubjectsView from './views/SubjectsView';
import SchedulesView from './views/SchedulesView';
import UsersView from './views/UsersView';
import FaceEnrollmentView from './views/FaceEnrollmentView';
import SectionReportView from './views/SectionReportView';
import ReportsView from './views/ReportsView';
import ProfileView from './views/ProfileView';
import LiveScannerView from './views/LiveScannerView';
import StudentEnrollmentView from './views/StudentEnrollmentView';

const VALID_TABS = [
  'dashboard',
  'programs',
  'section_catalog',
  'sections',
  'subjects',
  'schedules',
  'users',
  'face_enrollment',
  'student_enrollment',
  'section_report',
  'session_logs',
  'profile',
  'scanner',
];

function getInitialTab() {
  try {
    const hash = window.location.hash.replace(/^#\/?/, '').trim();
    if (hash && VALID_TABS.includes(hash)) {
      return hash;
    }
    const saved = localStorage.getItem('attendfr_active_tab');
    if (saved && VALID_TABS.includes(saved)) {
      return saved;
    }
  } catch {
    // fallback
  }
  return 'dashboard';
}

export default function App() {
  const [user, setUser] = useState(TokenStorage.getUser());
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(getInitialTab);
  const [activeSessionId, setActiveSessionId] = useState(() => {
    try {
      return localStorage.getItem('attendfr_active_session_id') || null;
    } catch {
      return null;
    }
  });
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [headerInfo, setHeaderInfo] = useState({
    title: '',
    subtitle: '',
    headerActions: null,
  });

  useEffect(() => {
    async function checkAuth() {
      const token = TokenStorage.getAccess();
      const refreshToken = TokenStorage.getRefresh();
      const cachedUser = TokenStorage.getUser();

      // Optimistically restore cached profile so user stays logged in immediately
      if (cachedUser) {
        setUser(cachedUser);
      }

      if (token || refreshToken) {
        try {
          const profile = await Api.getMe();
          setUser(profile);
          TokenStorage.set(TokenStorage.getAccess(), TokenStorage.getRefresh(), profile);
        } catch {
          // If token refresh also failed and tokens were cleared
          if (!TokenStorage.getAccess() && !TokenStorage.getRefresh()) {
            setUser(null);
          } else if (!cachedUser) {
            setUser(null);
          }
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    }
    checkAuth();
  }, []);

  const getTitle = useCallback((tab) => {
    switch (tab) {
      case 'dashboard':
        return user?.role === 'admin'
          ? 'Admin Dashboard'
          : user?.role === 'teacher'
          ? 'Instructor Dashboard'
          : 'My Dashboard';
      case 'programs':
        return 'Academic Programs';
      case 'section_catalog':
        return 'Section Catalog (Master List)';
      case 'sections':
        return user?.role === 'student'
          ? 'My Schedule'
          : user?.role === 'teacher'
          ? 'Sections & Schedules'
          : 'Class Sections';
      case 'subjects':
        return 'Subjects';
      case 'schedules':
        return 'Schedules';
      case 'users':
        return 'Users';
      case 'face_enrollment':
        return 'Select Student to Enroll';
      case 'student_enrollment':
        return 'Student Admission & Enrollment';
      case 'section_report':
        return user?.role === 'teacher' ? 'Attendance Reports' : 'Section Attendance Report';
      case 'session_logs':
        return user?.role === 'student' ? 'My Records' : 'Session Logs';
      case 'profile':
        return 'My Profile';
      case 'scanner':
        return 'Live Attendance';
      default:
        return 'AttendFR';
    }
  }, [user?.role]);

  const updateHeaderInfo = useCallback((info) => {
    setHeaderInfo((prev) => {
      if (
        prev.title === info.title &&
        prev.subtitle === info.subtitle &&
        prev.headerActions === info.headerActions
      ) {
        return prev;
      }
      return { ...prev, ...info };
    });
  }, []);

  const handleTabChange = useCallback((newTab) => {
    setActiveTab(newTab);
    try {
      localStorage.setItem('attendfr_active_tab', newTab);
      if (window.location.hash.replace(/^#\/?/, '').trim() !== newTab) {
        window.location.hash = `#/${newTab}`;
      }
    } catch {
      // ignore
    }
    setHeaderInfo({
      title: getTitle(newTab),
      subtitle: '',
      headerActions: null,
    });
  }, [getTitle]);

  // Sync with browser URL hash change (e.g. forward/back buttons or direct URL change)
  useEffect(() => {
    const handleHashChange = () => {
      try {
        const hash = window.location.hash.replace(/^#\/?/, '').trim();
        if (hash && VALID_TABS.includes(hash) && hash !== activeTab) {
          setActiveTab(hash);
          localStorage.setItem('attendfr_active_tab', hash);
          setHeaderInfo({
            title: getTitle(hash),
            subtitle: '',
            headerActions: null,
          });
        }
      } catch {
        // ignore
      }
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [activeTab, getTitle]);

  // Sync hash on mount if user is logged in
  useEffect(() => {
    if (user) {
      const currentHash = window.location.hash.replace(/^#\/?/, '').trim();
      if (!currentHash || currentHash !== activeTab) {
        window.location.hash = `#/${activeTab}`;
      }
    }
  }, [user, activeTab]);

  const handleStartSession = useCallback((sec) => {
    const secId = sec?.id || null;
    setActiveSessionId(secId);
    try {
      if (secId) {
        localStorage.setItem('attendfr_active_session_id', String(secId));
      } else {
        localStorage.removeItem('attendfr_active_session_id');
      }
    } catch {
      // ignore
    }
    handleTabChange('scanner');
  }, [handleTabChange]);

  const handleLoginSuccess = (userData) => {
    setUser(userData);
    const destTab = getInitialTab();
    handleTabChange(destTab);
  };

  const handleLogout = () => {
    Api.logout();
    try {
      localStorage.removeItem('attendfr_active_tab');
      localStorage.removeItem('attendfr_active_session_id');
      window.location.hash = '';
    } catch {
      // ignore
    }
    setUser(null);
    setActiveTab('dashboard');
    setActiveSessionId(null);
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-primary)', color: 'var(--text-secondary)' }}>
        <div style={{ textAlign: 'center' }}>
          <div className="pulse-indicator" style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--primary)', margin: '0 auto 16px auto' }} />
          <p style={{ fontWeight: '600', fontSize: '14px' }}>Loading AttendFR...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginView onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="app-layout">
      {/* Sidebar Navigation (100% copycat of templates/base.html) */}
      <Sidebar
        user={user}
        activeTab={activeTab}
        setActiveTab={handleTabChange}
        onLogout={handleLogout}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* Backdrop for Mobile Drawer */}
      {sidebarOpen && (
        <div
          className="sidebar-backdrop"
          onClick={() => setSidebarOpen(false)}
          style={{ display: 'block' }}
        />
      )}

      {/* Main Content Area */}
      <main className="main-content">
        <Header
          title={headerInfo.title || getTitle(activeTab)}
          subtitle={headerInfo.subtitle}
          headerActions={headerInfo.headerActions}
          onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
        />

        <div style={{ minHeight: 'calc(100vh - 64px)' }}>
          {activeTab === 'dashboard' && (
            <DashboardView
              user={user}
              onNavigate={handleTabChange}
              onSetHeaderInfo={updateHeaderInfo}
              onStartSession={handleStartSession}
            />
          )}

          {activeTab === 'programs' && (
            <ProgramsView
              user={user}
              onSetHeaderInfo={updateHeaderInfo}
            />
          )}

          {activeTab === 'section_catalog' && (
            <SectionCatalogView
              user={user}
              onNavigate={handleTabChange}
              onSetHeaderInfo={updateHeaderInfo}
            />
          )}

          {activeTab === 'sections' && (
            <SectionsView
              user={user}
              onNavigate={handleTabChange}
              onSetHeaderInfo={updateHeaderInfo}
              onStartSession={handleStartSession}
            />
          )}

          {activeTab === 'subjects' && (
            <SubjectsView
              user={user}
              onSetHeaderInfo={updateHeaderInfo}
            />
          )}

          {activeTab === 'schedules' && (
            <SchedulesView
              user={user}
              onSetHeaderInfo={updateHeaderInfo}
            />
          )}

          {activeTab === 'users' && (
            <UsersView
              user={user}
              onNavigate={handleTabChange}
              onSetHeaderInfo={updateHeaderInfo}
            />
          )}

          {activeTab === 'face_enrollment' && (
            <FaceEnrollmentView
              user={user}
              onNavigate={handleTabChange}
              onSetHeaderInfo={updateHeaderInfo}
            />
          )}

          {activeTab === 'student_enrollment' && (
            <StudentEnrollmentView
              user={user}
              onNavigate={handleTabChange}
              onSetHeaderInfo={updateHeaderInfo}
            />
          )}

          {activeTab === 'section_report' && (
            <SectionReportView
              user={user}
              onSetHeaderInfo={updateHeaderInfo}
            />
          )}

          {activeTab === 'session_logs' && (
            <ReportsView
              user={user}
              onNavigate={handleTabChange}
              onSetHeaderInfo={updateHeaderInfo}
              onStartSession={handleStartSession}
            />
          )}

          {activeTab === 'profile' && (
            <ProfileView
              user={user}
              onUserUpdated={setUser}
              onSetHeaderInfo={updateHeaderInfo}
            />
          )}

          {activeTab === 'scanner' && user?.role === 'teacher' && (
            <LiveScannerView
              user={user}
              onNavigate={handleTabChange}
              onSetHeaderInfo={updateHeaderInfo}
              activeSessionId={activeSessionId}
            />
          )}
        </div>
      </main>
    </div>
  );
}
