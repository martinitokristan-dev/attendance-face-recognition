# AttendFR — Face Recognition Attendance System
## Capstone / Senior Review Documentation

> **Reviewer's Note:** This document covers everything implemented in the repository — database schema, system flow, all API/endpoints, the face recognition pipeline, what is finished, and what is clearly missing or needs improvement.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Technology Stack](#2-technology-stack)
3. [Project Structure](#3-project-structure)
4. [Database Schema](#4-database-schema)
5. [System Architecture](#5-system-architecture)
6. [Application Flow / Flowcharts](#6-application-flow--flowcharts)
   - [Authentication Flow](#61-authentication-flow)
   - [Face Enrollment Flow](#62-face-enrollment-flow)
   - [Live Attendance Session Flow](#63-live-attendance-session-flow)
7. [URL Routes & API Reference](#7-url-routes--api-reference)
8. [Face Recognition Pipeline](#8-face-recognition-pipeline)
9. [Role-Based Access Control (RBAC)](#9-role-based-access-control-rbac)
10. [Forms & Validation](#10-forms--validation)
11. [Templates & Frontend](#11-templates--frontend)
12. [Configuration & Settings](#12-configuration--settings)
13. [Seed Data & Default Accounts](#13-seed-data--default-accounts)
14. [What Is Implemented ✅](#14-what-is-implemented-)
15. [What Is Missing / Needs Improvement ❌](#15-what-is-missing--needs-improvement-)
16. [Caching — Not Yet Implemented](#16-caching--not-yet-implemented)
17. [Development Cycle & Recommended Next Steps](#17-development-cycle--recommended-next-steps)

---

## 1. Project Overview

**AttendFR** is a web-based student attendance system that uses facial recognition to automatically mark students as **present**, **late**, or **absent** during a class session. It is built on Django (Python) and is targeted at Filipino academic institutions (timezone: `Asia/Manila`).

### Core Idea
1. Admin sets up subjects, sections, schedules, and user accounts.
2. Teachers start an **attendance session** for their scheduled class.
3. Students' faces were previously enrolled via webcam.
4. During the live session, the teacher's browser streams frames to the server, which compares each frame's detected face against all enrolled students in that section — automatically marking matches as present or late.
5. Teachers can review and manually edit records after the session.

---

## 2. Technology Stack

| Layer | Technology |
|---|---|
| Framework | Django 6.1 (Python 3.12) |
| Database | SQLite 3 (via `db.sqlite3`) |
| Face Detection | OpenCV Haar Cascade (`haarcascade_frontalface_default.xml`) |
| Face Encoding (Primary) | `face_recognition` library (dlib, 128-D vector) |
| Face Encoding (Fallback) | LBPH Histogram via `opencv-contrib-python` |
| Image Processing | Pillow, NumPy |
| Frontend | Bootstrap 5, Lucide Icons, Vanilla JS (AJAX/fetch) |
| Forms | `django-crispy-forms` + `crispy-bootstrap5` |
| Static Files | WhiteNoise (compressed, manifest-based) |
| Auth | Django built-in `AbstractUser` (custom) |
| Timezone | Asia/Manila |

---

## 3. Project Structure

```
attendance_fr/          ← Django project config (settings, main urls, wsgi)
accounts/               ← User management app
│  models.py            ←  CustomUser, Teacher, Student
│  views.py             ←  login, logout, dashboard, user CRUD
│  forms.py             ←  LoginForm, AdminUserCreateForm, etc.
│  decorators.py        ←  role_required(), admin_required(), teacher_required()
│  urls.py              ←  /accounts/* routes
core/                   ← Academic management app
│  models.py            ←  Subject, Section, StudentSection, Schedule,
│                       ←  AttendanceSession, AttendanceRecord
│  views.py             ←  subject/section/schedule CRUD, session management, AJAX API
│  forms.py             ←  SubjectForm, SectionForm, ScheduleForm, etc.
│  urls.py              ←  all non-auth routes
face_app/               ← Face recognition app
│  utils.py             ←  encode_face_from_image, compare_faces, draw_face_boxes, etc.
│  views.py             ←  enroll_face, enroll_face_capture, recognize_faces, delete_face
│  urls.py              ←  /face/* routes
templates/
│  base.html            ←  Sidebar layout, Lucide icons, Bootstrap
│  accounts/            ←  login, dashboards (admin/teacher/student), profile, user mgmt
│  core/                ←  subject/section/schedule forms, session live/report, history
│  face/                ←  enroll.html (webcam capture UI), enroll_select.html
static/css/
│  style.css            ←  Custom CSS (sidebar, cards, badges, etc.)
seed.py                 ←  Creates default admin/teacher/student + sample data
requirements.txt        ←  Python dependencies
```

---

## 4. Database Schema

### 4.1 Entity-Relationship Diagram

```
CustomUser (accounts)
 ├─ id, username, email, first_name, last_name
 ├─ role: 'admin' | 'teacher' | 'student'
 ├─ profile_image (ImageField → media/profiles/)
 └─ phone

     ↕ OneToOne                    ↕ OneToOne
  Teacher                        Student
  ├─ user (FK→CustomUser)        ├─ user (FK→CustomUser)
  ├─ employee_id (unique)        ├─ student_id (unique)
  ├─ department                  ├─ year_level
  └─ specialization              ├─ course
                                 ├─ face_encoding (TextField/JSON)
                                 ├─ face_enrolled_at (DateTimeField)
                                 └─ face_image (ImageField → media/face_images/)

Subject                          Section
├─ id                            ├─ id
├─ name                          ├─ name
├─ code (unique)                 ├─ subject (FK→Subject)
├─ description                   ├─ teacher (FK→Teacher, nullable)
├─ units                         ├─ school_year
└─ created_at                    ├─ semester: '1st'|'2nd'|'summer'
                                 └─ created_at

StudentSection (enrollment junction)
├─ student (FK→Student)
├─ section (FK→Section)
├─ enrolled_at
└─ UNIQUE (student, section)

Schedule
├─ id
├─ section (FK→Section)
├─ day_of_week: Mon|Tue|Wed|Thu|Fri|Sat
├─ start_time
├─ end_time
└─ room

AttendanceSession
├─ id
├─ schedule (FK→Schedule)
├─ date (default=today)
├─ started_by (FK→Teacher, nullable)
├─ status: 'open' | 'closed'
├─ created_at
└─ closed_at (nullable)

AttendanceRecord
├─ id
├─ session (FK→AttendanceSession)
├─ student (FK→Student)
├─ status: 'present'|'absent'|'late'|'excused'
├─ recognized_at (DateTimeField, nullable)
├─ confidence_score (FloatField, nullable)
├─ remarks
└─ UNIQUE (session, student)
```

### 4.2 Table Summary

| Table | Purpose | Key Fields |
|---|---|---|
| `accounts_customuser` | All system users | `role`, `profile_image` |
| `accounts_teacher` | Teacher extended profile | `employee_id`, `department` |
| `accounts_student` | Student extended profile | `student_id`, `face_encoding` (JSON) |
| `core_subject` | Academic subjects | `code` (unique) |
| `core_section` | Class sections | `subject_id`, `teacher_id`, `semester` |
| `core_studentsection` | Student enrollment in a section | `student_id`, `section_id` |
| `core_schedule` | Weekly class schedule | `day_of_week`, `start_time`, `end_time`, `room` |
| `core_attendancesession` | One attendance event per class day | `status`, `date` |
| `core_attendancerecord` | Per-student result per session | `status`, `confidence_score` |

### 4.3 Face Encoding Storage

> **Design Decision (Questionable):** Face encodings are stored **as a JSON string in a `TextField`** on the `Student` model — not in a dedicated file or binary column.
>
> - A dlib encoding = **128 floats** ≈ ~800 bytes JSON per student.
> - An LBPH encoding = **8×8 grid × 256 bins = 16,384 floats** ≈ ~100KB JSON per student.
> - This is inefficient for large datasets and makes indexed lookups impossible.
> - **Recommended improvement:** Use `BinaryField` or store encodings as `.npy` files on disk.

---

## 5. System Architecture

```
Browser (Student/Teacher/Admin)
        │
        │  HTTP / AJAX (JSON)
        ▼
  Django 6.1 Application
  ┌────────────────────────────────────────────────────┐
  │  Middleware Stack                                  │
  │  SecurityMiddleware → WhiteNoiseMiddleware →       │
  │  SessionMiddleware → CsrfViewMiddleware →          │
  │  AuthenticationMiddleware → MessageMiddleware      │
  ├────────────────────────────────────────────────────┤
  │  URL Router (attendance_fr/urls.py)                │
  │  /accounts/* → accounts app                        │
  │  /           → core app                            │
  │  /face/*     → face_app                            │
  │  /admin/     → Django Admin                        │
  ├────────────────────────────────────────────────────┤
  │  accounts app   │  core app        │  face_app     │
  │  - CustomUser   │  - Subject       │  - utils.py   │
  │  - Teacher      │  - Section       │    (FR logic) │
  │  - Student      │  - Schedule      │  - enroll     │
  │  - RBAC deco.   │  - Session       │  - recognize  │
  │                 │  - Record        │               │
  ├────────────────────────────────────────────────────┤
  │  Django ORM  →  SQLite 3 (db.sqlite3)              │
  │  WhiteNoise  →  static/  →  staticfiles/           │
  │  Pillow/CV2  →  media/face_images/, profiles/      │
  └────────────────────────────────────────────────────┘
```

---

## 6. Application Flow / Flowcharts

### 6.1 Authentication Flow

```
User visits any page
        │
        ▼
   Is authenticated?
   ┌────NO────┐
   ▼          ▼
Redirect   Already on
/login/    login page
   │
   ▼
Submit username + password
        │
        ▼
  LoginForm.is_valid()?
  ┌────NO────┐
  ▼          ▼
Error      Authenticate user
message    │
           ▼
        login(request, user)
           │
           ▼
     Redirect → /accounts/dashboard/
           │
           ▼
    Role check in dashboard_view()
    ┌────────┬──────────┬──────────┐
    ▼        ▼          ▼          ▼
  admin   teacher    student   (no role → login)
  dash.   dash.      dash.
```

### 6.2 Face Enrollment Flow

```
Student or Admin visits /face/enroll/
        │
        ├── Admin? → Show student picker (/face/enroll/?student_id=X)
        │
        └── Student? → Enroll own face
                │
                ▼
          enroll.html loads webcam (getUserMedia)
                │
                ▼
         User clicks "Capture"
                │
                ▼
         JS encodes frame as base64
                │
         POST /face/enroll/capture/
         { student_id, frame: "data:image/jpeg;base64,..." }
                │
                ▼
         enroll_face_capture() view
                │
         base64_to_bytes(frame)
                │
         encode_face_from_frame(frame_bytes)
                │
         ┌──────────────────────────┐
         │ face_recognition (dlib)? │ YES → 128-D float vector
         │  or LBPH available?      │ YES → LBP histogram vector
         └──────────────────────────┘
                │
         No face detected?
         └── Return { success: false, message: "..." }
                │
         Multiple faces?
         └── Return { success: false, message: "..." }
                │
         student.face_encoding = json.dumps(encoding)
         student.face_enrolled_at = now
         Crop + save face_image to media/face_images/
         student.save()
                │
         Return { success: true, message: "..." }
                │
                ▼
         JS shows success toast, updates UI
```

### 6.3 Live Attendance Session Flow

```
Teacher visits /sessions/start/<schedule_pk>/
        │
        ▼
  session_start() checks:
  - Does teacher own this section?
  - Is there already an open session today?
        │
  POST → Create AttendanceSession (status='open')
  Bulk-create AttendanceRecord for EVERY enrolled student (status='absent')
        │
  Redirect → /sessions/<pk>/live/
        │
        ▼
  session_live.html renders:
  - Webcam stream (getUserMedia)
  - Live attendance list (present/absent/late)
        │
        ▼ (JS polling loop every ~1.5s)
  Capture webcam frame as base64
        │
  POST /face/recognize/
  { session_id, frame: "data:image/jpeg;base64,..." }
        │
        ▼
  recognize_faces() view:
  1. encode_face_from_frame(frame_bytes) → unknown_encoding
  2. Query all enrolled students with face_encoding in this section
  3. For each student:
       compare_faces(known_encoding, unknown_encoding)
       is_match? → mark record as 'present' or 'late'
         Late if (now - session.schedule.start_time) > 15 minutes
  4. Return matched student info
        │
        ▼
  JS updates the attendance list in real-time
        │
  Teacher clicks "Close Session"
        │
  POST /sessions/<pk>/close/
  session.status = 'closed'
  session.closed_at = now
        │
  Redirect → /sessions/<pk>/report/
        │
        ▼
  session_report.html:
  - Shows present/late/absent counts
  - Teacher can manually override any record's status
```

---

## 7. URL Routes & API Reference

### 7.1 Accounts (`/accounts/`)

| Method | URL | View | Auth | Description |
|---|---|---|---|---|
| GET/POST | `/accounts/login/` | `login_view` | Public | Login page |
| GET | `/accounts/logout/` | `logout_view` | Login required | Logout user |
| GET | `/accounts/dashboard/` | `dashboard_view` | Login required | Role-specific dashboard |
| GET | `/accounts/profile/` | `profile_view` | Login required | Edit own profile |
| GET | `/accounts/users/` | `user_list_view` | Admin only | List all users |
| GET/POST | `/accounts/users/create/` | `user_create_view` | Admin only | Create user |
| GET/POST | `/accounts/users/<pk>/edit/` | `user_edit_view` | Admin only | Edit any user |
| POST | `/accounts/users/<pk>/delete/` | `user_delete_view` | Admin only | Delete user |

### 7.2 Core — Academic Management (`/`)

| Method | URL | View | Auth | Description |
|---|---|---|---|---|
| GET | `/subjects/` | `subject_list` | Admin | List subjects |
| GET/POST | `/subjects/add/` | `subject_create` | Admin | Add subject |
| GET/POST | `/subjects/<pk>/edit/` | `subject_edit` | Admin | Edit subject |
| POST | `/subjects/<pk>/delete/` | `subject_delete` | Admin | Delete subject |
| GET | `/sections/` | `section_list` | Admin | List sections |
| GET/POST | `/sections/add/` | `section_create` | Admin | Add section |
| GET/POST | `/sections/<pk>/` | `section_detail` | Admin | Section detail + enroll student |
| GET/POST | `/sections/<pk>/edit/` | `section_edit` | Admin | Edit section |
| POST | `/sections/<pk>/delete/` | `section_delete` | Admin | Delete section |
| POST | `/sections/<s_pk>/unenroll/<st_pk>/` | `student_unenroll` | Admin | Remove student |
| GET | `/schedules/` | `schedule_list` | Admin | List schedules |
| GET/POST | `/schedules/add/` | `schedule_create` | Admin | Add schedule (with conflict detection) |
| GET/POST | `/schedules/<pk>/edit/` | `schedule_edit` | Admin | Edit schedule |
| POST | `/schedules/<pk>/delete/` | `schedule_delete` | Admin | Delete schedule |
| GET/POST | `/sessions/start/<schedule_pk>/` | `session_start` | Teacher/Admin | Start attendance session |
| GET | `/sessions/<pk>/live/` | `session_live` | Teacher/Admin | Live attendance view |
| POST | `/sessions/<pk>/close/` | `session_close` | Teacher/Admin | Close session |
| GET/POST | `/sessions/<pk>/report/` | `session_report` | Login required | View/edit session report |
| GET | `/history/` | `attendance_history` | Login required | Role-filtered history |

### 7.3 AJAX API Endpoints

| Method | URL | View | Auth | Content-Type | Description |
|---|---|---|---|---|---|
| POST | `/api/mark-present/` | `mark_present_api` | Login | JSON | Manual mark-present via session/student ID |
| POST | `/face/enroll/capture/` | `enroll_face_capture` | Login | JSON | Enroll face from base64 frame |
| POST | `/face/recognize/` | `recognize_faces` | Login | JSON | Match frame against enrolled students |

#### POST `/api/mark-present/` — Request Body
```json
{
  "session_id": 5,
  "student_id": 12,
  "confidence": 0.87
}
```
#### Response (success)
```json
{
  "success": true,
  "status": "present",
  "student_name": "Juan Dela Cruz",
  "student_id": "2024-00001"
}
```

#### POST `/face/enroll/capture/` — Request Body
```json
{
  "student_id": 12,
  "frame": "data:image/jpeg;base64,/9j/4AAQSkZJRgAB..."
}
```
#### Response (success)
```json
{
  "success": true,
  "message": "Face enrolled successfully for Juan Dela Cruz!",
  "face_count": 1
}
```

#### POST `/face/recognize/` — Request Body
```json
{
  "session_id": 5,
  "frame": "data:image/jpeg;base64,/9j/4AAQSkZJRgAB..."
}
```
#### Response (success)
```json
{
  "success": true,
  "recognized": [
    {
      "student_id": 12,
      "student_number": "2024-00001",
      "name": "Juan Dela Cruz",
      "confidence": 87.5,
      "status": "present",
      "new_status": "present"
    }
  ],
  "face_count": 1
}
```

> **Note:** `recognize_faces` currently breaks after finding the **first match per frame** (`break` on line 191). Only one student can be recognized per frame/request. Multi-face recognition is not implemented.

---

## 8. Face Recognition Pipeline

### 8.1 Library Priority Order

```
Step 1: Try to import face_recognition (dlib)
        ↓ FACE_RECOGNITION_AVAILABLE = True/False

Step 2: Try cv2.face.LBPHFaceRecognizer_create()
        ↓ LBPH_AVAILABLE = True/False

Step 3: FR_AVAILABLE = FACE_RECOGNITION_AVAILABLE or LBPH_AVAILABLE
        ↓ If False → all enrollment/recognition endpoints return HTTP 503
```

### 8.2 Encoding Methods Compared

| Method | Vector Size | Distance Metric | Accuracy | Requirement |
|---|---|---|---|---|
| dlib (face_recognition) | 128 floats | Euclidean distance | High | `face_recognition`, `dlib-bin` |
| LBPH (OpenCV) | 16,384 floats (8×8×256) | Chi-squared | Medium | `opencv-contrib-python` |

#### dlib Encoding Flow
```
image bytes
  → _decode_image_to_rgb() → RGB numpy array
  → fr.face_locations() (HOG model)
  → fr.face_encodings() → [128-D vector]
  → vector[0].tolist()
```

#### LBPH Encoding Flow
```
image bytes
  → _decode_image_to_rgb() → RGB numpy array
  → cv2.cvtColor(COLOR_RGB2GRAY) → grayscale
  → _detect_faces_cv() (Haar Cascade) → [(x,y,w,h), ...]
  → Crop face ROI from grayscale
  → cv2.resize(128, 128)
  → _compute_lbp_histogram()
     - 8-point, radius=1 LBP pattern
     - 8×8 grid of cells
     - per-cell 256-bin normalized histogram
     - concatenate → 16,384-D vector
  → vector.tolist()
```

### 8.3 Comparison Logic

```python
# dlib path (len == 128)
distance = np.linalg.norm(known - unknown)
is_match = distance <= tolerance   # default 0.5
confidence = max(0.0, 1.0 - distance)

# LBPH path
chi_sq = sum((h1 - h2)^2 / (h1 + h2 + eps))
is_match = chi_sq <= LBPH_THRESHOLD   # default 40.0
confidence = max(0.0, 1.0 - chi_sq / LBPH_THRESHOLD)
```

### 8.4 Late Detection Logic

```python
session_start_dt = make_aware(datetime.combine(session.date, schedule.start_time))
is_late = (now - session_start_dt).total_seconds() > 900  # 15 minutes
record.status = 'late' if is_late else 'present'
```

---

## 9. Role-Based Access Control (RBAC)

### 9.1 Roles

| Role | Code | Description |
|---|---|---|
| Administrator | `'admin'` | Full access — user/subject/section/schedule management |
| Teacher | `'teacher'` | Manage their own sections, start/close sessions |
| Student | `'student'` | View own attendance records, enroll face |

### 9.2 Decorators (`accounts/decorators.py`)

```python
role_required(*roles)     # generic — checks request.user.role
admin_required            # role_required('admin')
teacher_required          # role_required('admin', 'teacher')  ← Admin can also do teacher actions
student_required          # role_required('student')
```

> **Potential Issue:** `teacher_required` allows admins to act as teachers (start sessions, etc.). This may not be the intended behavior if admins should be strictly administrative.

### 9.3 Role-Specific Dashboards

| Role | Template | Key Data |
|---|---|---|
| Admin | `dashboard_admin.html` | Total counts, 5 recent sessions |
| Teacher | `dashboard_teacher.html` | Assigned sections, 5 recent sessions |
| Student | `dashboard_student.html` | Last 10 attendance records |

---

## 10. Forms & Validation

| Form | App | Purpose | Model |
|---|---|---|---|
| `LoginForm` | accounts | Username + password auth | — |
| `AdminUserCreateForm` | accounts | Create any user (admin use) | `CustomUser` |
| `UserEditForm` | accounts | Edit profile fields | `CustomUser` |
| `TeacherProfileForm` | accounts | Create teacher profile | `Teacher` |
| `StudentProfileForm` | accounts | Create student profile | `Student` |
| `SubjectForm` | core | Subject CRUD | `Subject` |
| `SectionForm` | core | Section CRUD + teacher picker | `Section` |
| `ScheduleForm` | core | Schedule + conflict detection | `Schedule` |
| `TeacherScheduleForm` | core | Teacher-limited schedule (unused in views) | `Schedule` |
| `EnrollStudentForm` | core | Add student to section | — |
| `AttendanceRecordEditForm` | core | Manual status override | `AttendanceRecord` |

### Schedule Conflict Detection (in `Schedule.clean()`)

When saving a schedule, the system:
1. Validates `start_time < end_time`
2. Checks all other schedules on the same `day_of_week`
3. Detects **room conflicts** — same room, overlapping time
4. Detects **teacher conflicts** — same teacher, overlapping time
5. Raises `ValidationError` with a descriptive message

---

## 11. Templates & Frontend

### 11.1 Template Hierarchy

```
base.html
 ├─ Sidebar with role-aware navigation
 ├─ Bootstrap 5 (CDN)
 ├─ Lucide Icons (CDN)
 ├─ Custom CSS (static/css/style.css)
 ├─ Blocks: title, page_title, page_subtitle, header_actions, content, extra_css, extra_js
 └─ auth_content (used only on login page, no sidebar)
```

### 11.2 Template List

| Template | Purpose |
|---|---|
| `accounts/login.html` | Login form |
| `accounts/dashboard_admin.html` | Admin stats overview |
| `accounts/dashboard_teacher.html` | Teacher's sections + recent sessions |
| `accounts/dashboard_student.html` | Student's last 10 attendance records |
| `accounts/profile.html` | Edit profile |
| `accounts/user_list.html` | Admin: all users table |
| `accounts/user_create.html` | Admin: create user (dynamic form by role) |
| `accounts/user_edit.html` | Admin: edit user |
| `accounts/user_confirm_delete.html` | Delete confirmation |
| `core/subject_list.html` | List subjects with section count |
| `core/subject_form.html` | Add/edit subject |
| `core/section_list.html` | List sections |
| `core/section_detail.html` | Section detail + enrollment |
| `core/section_form.html` | Add/edit section |
| `core/schedule_list.html` | All schedules |
| `core/schedule_form.html` | Add/edit schedule |
| `core/session_start.html` | Confirm session start |
| `core/session_live.html` | **Live webcam + AJAX recognition** (largest file, 12KB) |
| `core/session_report.html` | Post-session attendance report with manual edit |
| `core/attendance_history_admin.html` | All sessions (admin view) |
| `core/attendance_history_teacher.html` | Teacher's sessions |
| `core/attendance_history_student.html` | Student's records |
| `core/confirm_delete.html` | Shared delete confirmation |
| `face/enroll.html` | Webcam face enrollment page |
| `face/enroll_select.html` | Admin: pick a student to enroll |

### 11.3 Frontend AJAX Logic (session_live.html)

The `session_live.html` template runs a JavaScript loop that:
1. Accesses the webcam via `navigator.mediaDevices.getUserMedia`
2. Captures a frame every ~1.5 seconds using `<canvas>`
3. Sends the frame as base64 to `POST /face/recognize/`
4. Updates the DOM attendance list with recognized names and status badges

---

## 12. Configuration & Settings

File: [`attendance_fr/settings.py`](attendance_fr/settings.py)

| Setting | Value | Notes |
|---|---|---|
| `DEBUG` | `True` | **Must be False in production** |
| `SECRET_KEY` | Hardcoded string | **Must be changed in production** |
| `ALLOWED_HOSTS` | `['*']` | **Restrict in production** |
| `AUTH_USER_MODEL` | `accounts.CustomUser` | Custom user model |
| `AUTH_PASSWORD_VALIDATORS` | `[]` (empty) | **No password validation — security risk** |
| `TIME_ZONE` | `Asia/Manila` | Philippine Standard Time |
| `DATABASES` | SQLite | No production DB configured |
| `FACE_RECOGNITION_TOLERANCE` | `0.5` | dlib Euclidean threshold |
| `FACE_ENCODINGS_DIR` | `media/face_encodings/` | Defined but **not used** — encoding stored in DB |
| `LBPH_THRESHOLD` | Not in settings (hardcoded `40.0`) | Should be in settings |
| `CRISPY_TEMPLATE_PACK` | `bootstrap5` | |
| `STATICFILES_STORAGE` | WhiteNoise `CompressedManifestStaticFilesStorage` | |

---

## 13. Seed Data & Default Accounts

Run with: `.venv\Scripts\python seed.py`

| Role | Username | Password | Name |
|---|---|---|---|
| Admin | `admin` | `admin123` | System Administrator |
| Teacher | `teacher1` | `teacher123` | Maria Santos |
| Student | `student1` | `student123` | Juan Dela Cruz |

**Seeded academic data:**
- Subject: `CS101 — Introduction to Computing` (3 units)
- Section: `BSCS-2A` (SY 2025–2026, 1st Semester, assigned to teacher1)
- Schedule: Monday 8:00–9:30, Room 101
- Enrollment: `student1` enrolled in `BSCS-2A`

> **Note:** `seed.py` uses an `os.environ.setdefault` approach — it must be run from the project root where `manage.py` lives, with the virtual environment activated.

---

## 14. What Is Implemented ✅

| Feature | Status | Notes |
|---|---|---|
| Custom user model with roles | ✅ Done | `CustomUser` with `role` field |
| Teacher & Student profile models | ✅ Done | OneToOne to CustomUser |
| Login / Logout | ✅ Done | Django's `AuthenticationForm` |
| Role-based navigation sidebar | ✅ Done | Template-level role checks |
| Role-based view decorators | ✅ Done | `admin_required`, `teacher_required` |
| Admin: User CRUD | ✅ Done | Create with role-specific sub-forms |
| Subject CRUD | ✅ Done | Admin only |
| Section CRUD + teacher assignment | ✅ Done | Admin only |
| Student enrollment into sections | ✅ Done | Via `StudentSection` junction table |
| Schedule management | ✅ Done | With room + teacher conflict detection |
| Attendance session lifecycle | ✅ Done | start → live → close → report |
| Auto-populate absent records on session start | ✅ Done | `bulk_create` |
| Present/Late detection (15-min cutoff) | ✅ Done | In both `mark_present_api` and `recognize_faces` |
| Manual record override (teacher/admin) | ✅ Done | In `session_report` |
| Face enrollment via webcam (AJAX) | ✅ Done | Base64 POST, crop & save image |
| Face recognition via webcam (AJAX loop) | ✅ Done | Per-frame comparison |
| dlib (face_recognition) encoding | ✅ Done | Primary, high-accuracy |
| LBPH histogram fallback encoding | ✅ Done | When dlib unavailable |
| draw_face_boxes utility | ✅ Done | But not called during live session! |
| Delete face data | ✅ Done | Clears encoding + deletes image file |
| Admin: enroll face for any student | ✅ Done | Via `?student_id=X` query param |
| Role-specific dashboard views | ✅ Done | 3 separate templates |
| Attendance history by role | ✅ Done | Filtered view per role |
| Session report with counts | ✅ Done | present/late/absent totals |
| WhiteNoise static serving | ✅ Done | |
| Bootstrap 5 + Lucide Icons | ✅ Done | CDN, no npm/webpack |
| Profile page | ✅ Done | Edit name, email, phone, profile image |
| Django admin panels | ✅ Done | All models registered |
| Seed script | ✅ Done | Creates sample data |

---

## 15. What Is Missing / Needs Improvement ❌

### 🔴 Critical Issues

| Issue | Location | Details |
|---|---|---|
| **Hardcoded SECRET_KEY** | `settings.py:9` | Must use environment variables (`python-dotenv`) |
| **No password validation** | `settings.py:71` | `AUTH_PASSWORD_VALIDATORS = []` — anyone can set "a" as password |
| **`DEBUG=True` hardcoded** | `settings.py:11` | Must be `False` in production |
| **`ALLOWED_HOSTS = ['*']`** | `settings.py:13` | Security vulnerability |
| **No HTTPS / CSRF enforcement** | `settings.py` | No `SECURE_*` settings for deployment |
| **`draw_face_boxes` is never called in live session** | `face_app/views.py` | The bounding box overlay function exists but the `recognize_faces` view never returns annotated frames — the webcam just shows raw video |

### 🟡 Functional Gaps

| Gap | Details |
|---|---|
| **No multi-face recognition per frame** | `recognize_faces` breaks after first match (`break` line 191). Classroom with multiple students visible = only 1 is marked per frame |
| **`FACE_ENCODINGS_DIR` setting unused** | Defined in settings but encoding is stored in DB text field instead |
| **`TeacherScheduleForm` is unused** | Defined in `core/forms.py` but never instantiated in any view |
| **No student self-registration** | Students cannot register themselves; they must be created by admin |
| **No password change view** | Users cannot change their own passwords |
| **No attendance export** | No CSV/PDF/Excel export for attendance records |
| **No pagination** | User lists, attendance history, etc. have no pagination — will break with large data |
| **No email notifications** | No email for login, session start, or absence alerts |
| **No report filtering** | History pages have no date range, subject, or section filters |
| **Section detail shows all schedules of section** | But has no "Start Session" button for each schedule — teacher must know the URL manually |
| **Teacher dashboard shows sections but no direct "start session" links** | UX gap — teacher has to navigate manually |
| **`session_report` allows closed session edits by teacher** | No guard on closed sessions — a teacher could still POST to modify records after closing |
| **No overall attendance percentage per student** | No computed absent rate, no early warning for students who are frequently absent |
| **No semester/year filtering** | Attendance history shows all sessions from all years with no filter |

### 🟢 Code Quality Issues

| Issue | Details |
|---|---|
| **`mark_present_api` and `recognize_faces` duplicate late-detection logic** | The 15-minute late check is copy-pasted in two views — should be a shared function |
| **`face_encoding` stored as TextField (JSON string)** | Inefficient; should be a `BinaryField` or external file |
| **No unit tests** | Zero test files in the repository |
| **`tolerance = 0.5` hardcoded in `recognize_faces`** | Should use `settings.FACE_RECOGNITION_TOLERANCE` like `compare_faces` does |
| **`fix_emojis.py`, `fix_emojis2.py`, `replace_emojis.py` in root** | Debug/utility scripts committed to repo — should be in a `scripts/` folder or removed |
| **`import json` inside view function** | `mark_present_api` does `import json` inside the function body (line 323) — should be at top |
| **No logging configuration** | `logger = logging.getLogger(__name__)` is used throughout but no `LOGGING` dict in settings, so logs may not appear |

---

## 16. Caching — Not Yet Implemented

**No caching layer exists in this project.** Here is where it would help and how to add it:

### Where Caching Would Help

| Query | Frequency | Cache Candidate |
|---|---|---|
| All enrolled students' face encodings for a section | Called on EVERY face recognition request (every 1.5 sec during live session) | **High priority** |
| `Subject` and `Section` lists | Admin/teacher nav lookups | Medium |
| Dashboard stats (counts) | Admin dashboard on every page load | Medium |

### Recommended Caching Strategy

#### Option A: Django In-Memory Cache (simplest)
```python
# settings.py
CACHES = {
    'default': {
        'BACKEND': 'django.core.cache.backends.locmem.LocMemCache',
        'LOCATION': 'attendfr-cache',
    }
}
```

#### Option B: Redis (production-ready)
```python
# settings.py
CACHES = {
    'default': {
        'BACKEND': 'django.core.cache.backends.redis.RedisCache',
        'LOCATION': 'redis://127.0.0.1:6379/1',
    }
}
```

#### Cache the Face Encodings in `recognize_faces`

```python
# face_app/views.py — recommended improvement
from django.core.cache import cache

def recognize_faces(request):
    ...
    cache_key = f'section_encodings_{section.pk}'
    enrollments_data = cache.get(cache_key)

    if not enrollments_data:
        enrollments = StudentSection.objects.filter(section=section) \
            .select_related('student__user') \
            .exclude(student__face_encoding__isnull=True) \
            .exclude(student__face_encoding__exact='')
        enrollments_data = [
            {
                'student_pk': e.student.pk,
                'student_id': e.student.student_id,
                'name': e.student.user.get_full_name(),
                'encoding': json.loads(e.student.face_encoding)
            }
            for e in enrollments
        ]
        cache.set(cache_key, enrollments_data, timeout=300)  # 5 min TTL
    ...
```

> **Cache invalidation:** Invalidate `section_encodings_<pk>` whenever a student's face encoding is updated or deleted, or when a student is enrolled/unenrolled from the section.

---

## 17. Development Cycle & Recommended Next Steps

### Current State Assessment

The project is approximately **60–70% complete** for a functional MVP. The core models, RBAC, and face recognition pipeline are solid. The main gaps are in UX polish, security hardening, and missing features like exports and filtering.

### Recommended Development Phases

#### Phase 1 — Security Hardening (Before any demo)
- [ ] Move `SECRET_KEY` to `.env` file using `python-dotenv`
- [ ] Set `DEBUG = os.environ.get('DEBUG', 'False') == 'True'`
- [ ] Add password validators back to `AUTH_PASSWORD_VALIDATORS`
- [ ] Restrict `ALLOWED_HOSTS` to actual domain/IP
- [ ] Add `LOGGING` configuration to `settings.py`

#### Phase 2 — Core UX Fixes
- [ ] Add "Start Session" button to teacher dashboard and section detail for each schedule
- [ ] Fix `recognize_faces` to process **all** detected faces per frame (remove the `break`)
- [ ] Use `FACE_RECOGNITION_TOLERANCE` from settings in `recognize_faces`
- [ ] Extract late-detection logic into a shared utility function
- [ ] Add pagination to all list views (Django's `Paginator`)
- [ ] Add filters to attendance history (by date range, subject, section)

#### Phase 3 — New Features
- [ ] CSV/Excel export of attendance records
- [ ] Student absent rate computation and visual summary
- [ ] Password change view for all users
- [ ] Email notifications (session started, absence alerts)
- [ ] Caching for face encoding lookups (see Section 16)

#### Phase 4 — Code Quality & Testing
- [ ] Write unit tests for:
  - `compare_faces()` with various tolerances
  - Schedule conflict detection
  - Role-based view access
  - Face enrollment AJAX endpoints
- [ ] Move `fix_emojis*.py` scripts out of project root
- [ ] Switch `face_encoding` storage from `TextField` to a binary file or proper column

#### Phase 5 — Deployment Preparation
- [ ] Switch database from SQLite to PostgreSQL
- [ ] Add `SECURE_SSL_REDIRECT`, `SECURE_HSTS_SECONDS`, etc.
- [ ] Configure Redis for caching and Django sessions
- [ ] Set up a proper WSGI server (Gunicorn + Nginx)
- [ ] Add Dockerfile / docker-compose

---

## Quick Start Commands

```powershell
# Activate virtual environment
.\.venv\Scripts\Activate.ps1

# Seed initial data
python seed.py

# Run development server
python manage.py runserver

# Access the app
# http://127.0.0.1:8000/

# Admin panel
# http://127.0.0.1:8000/admin/  (admin / admin123)
```

---

*Documentation generated on 2026-09-21 by senior code review.*
*Repository: https://github.com/jvrycode/Attendance-Face-Recognition*
