# AttendFR — Project & Setup Guide

**AttendFR** is an enterprise-grade, role-based Automated Attendance Management System powered by **Django 5**, **dlib (128-D Face Encodings)**, **OpenCV**, and **MariaDB/MySQL**. It features real-time webcam facial recognition, dynamic schedule conflict detection, two-tier wrong-section prevention, and an intuitive UI.

---

## 📋 Table of Contents
1. [System Architecture & Roles](#system-architecture--roles)
2. [Prerequisites](#prerequisites)
3. [Step-by-Step Setup Guide](#step-by-step-setup-guide)
4. [Environment Configuration (.env)](#environment-configuration-env)
5. [Database Setup (XAMPP / MySQL)](#database-setup-xampp--mysql)
6. [Database Migrations & Seeding](#database-migrations--seeding)
7. [Running the Application](#running-the-application)
8. [Default Demo Credentials](#default-demo-credentials)
9. [Key Workflows](#key-workflows)
   - [Admin Workflow](#admin-workflow)
   - [Teacher Workflow](#teacher-workflow)
   - [Face Enrollment Workflow](#face-enrollment-workflow)
   - [Live Attendance Scanning](#live-attendance-scanning)
   - [Wrong-Section Detection](#wrong-section-detection)
10. [Running Automated Tests](#running-automated-tests)
11. [Troubleshooting & FAQs](#troubleshooting--faqs)

---

## 1. System Architecture & Roles

The system enforces strict role-based access control (RBAC):

| Role | Permissions & Responsibilities |
| :--- | :--- |
| **Administrator** (`admin`) | Master control. Creates and manages Subjects, Sections, Schedules, Teachers, and Students. Handles institutional enrollments and schedule conflict resolutions. |
| **Teacher** (`teacher`) | Section oversight. Views assigned sections, schedules (e.g. M-TH 08:00–09:30), student rosters. Starts live attendance sessions, monitors real-time camera feeds, and reviews/exports attendance reports (CSV/Print). |
| **Student** (`student`) | Personal attendance history. Views subject schedules, attendance rate percentages, and detailed logs (present, late, absent, excused). |

---

## 2. Prerequisites

Before cloning and running the project, ensure you have:

- **Python 3.10, 3.11, or 3.12** installed ([python.org](https://www.python.org/downloads/)).
  - Verify: `python --version`
- **Git** installed ([git-scm.com](https://git-scm.com/)).
- **XAMPP** (or standalone MySQL/MariaDB server 10.4+) installed and running ([apachefriends.org](https://www.apachefriends.org/)).
- **C++ Build Tools / CMake** (required for `dlib` if wheels are not pre-cached).
  - *Windows*: Visual Studio C++ Build Tools or install pre-built `dlib` wheel.

---

## 3. Step-by-Step Setup Guide

### Step 1: Clone the Repository
```bash
git clone https://github.com/jvrycode/Attendance-Face-Recognition.git
cd Attendance-Face-Recognition
```

### Step 2: Create and Activate a Virtual Environment

**On Windows (PowerShell):**
```powershell
python -m venv .venv
.venv\Scripts\activate
```

**On Windows (Command Prompt):**
```cmd
python -m venv .venv
.venv\Scripts\activate.bat
```

**On macOS / Linux:**
```bash
python3 -m venv .venv
source .venv/bin/activate
```

### Step 3: Install Dependencies
```bash
python -m pip install --upgrade pip
pip install -r requirements.txt
```

> **Tip for Windows users installing dlib:** If `pip install dlib` encounters compilation errors, ensure CMake is installed (`pip install cmake`), or download a matching pre-compiled wheel for your Python version from GitHub releases and run `pip install <wheel_file>.whl`.

---

## 4. Environment Configuration (`.env`)

Copy the provided example environment template:

**Windows PowerShell:**
```powershell
Copy-Item .env.example .env
```

**Linux / macOS:**
```bash
cp .env.example .env
```

Verify or update the values in your `.env` file:
```dotenv
SECRET_KEY=attendfr-local-super-secret-key-replace-in-production
DEBUG=True
ALLOWED_HOSTS=127.0.0.1,localhost

# MySQL / MariaDB Settings (XAMPP Default)
DB_ENGINE=django.db.backends.mysql
DB_NAME=attendance_db
DB_USER=root
DB_PASSWORD=
DB_HOST=127.0.0.1
DB_PORT=3306

# Face Recognition Settings
FACE_RECOGNITION_TOLERANCE=0.55
LATE_THRESHOLD_MINUTES=15
```

---

## 5. Database Setup (XAMPP / MySQL)

1. Open your **XAMPP Control Panel**.
2. Click **Start** next to **MySQL** (and Apache if using phpMyAdmin).
3. Open your browser to `http://localhost/phpmyadmin/` or open MySQL shell:
   ```bash
   mysql -u root -p
   ```
4. Create the database:
   ```sql
   CREATE DATABASE attendance_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   ```

---

## 6. Database Migrations & Seeding

### Step 1: Run Django Migrations
```bash
python manage.py makemigrations accounts core face_app
python manage.py migrate
```

### Step 2: Seed Demo Data
Populate the database with sample departments, subjects, sections, teachers, students, and schedules:
```bash
python seed.py
```

---

## 7. Running the Application

Start the Django development server:
```bash
python manage.py runserver
```

Open your browser and navigate to:
👉 **[http://127.0.0.1:8000/](http://127.0.0.1:8000/)**

---

## 8. Default Demo Credentials

All test accounts created by `seed.py`:

| Role | Username | Password | Notes |
| :--- | :--- | :--- | :--- |
| **Administrator** | `admin` | `AdminPass123!` | Access to `/admin/` and full management dashboard |
| **Teacher** | `prof_albert` | `StrongPassword123!` | Assigned to section `BSCS-2A` (CS101) |
| **Teacher 2** | `prof_curie` | `StrongPassword123!` | Assigned to section `BSCS-2B` (CS102) |
| **Student** | `student_juan` | `StudentPass123!` | Enrolled in `BSCS-2A` (ID: `2024-00001`) |

---

## 9. Key Workflows

### Admin Workflow
1. Log in with `admin` / `AdminPass123!`.
2. Go to **Subjects** -> Create course subjects (e.g. `CS101 - Intro to Programming`).
3. Go to **Sections** -> Create section and assign Teacher (e.g. `BSCS-2A` with `prof_albert`).
4. Go to **Schedules** -> Assign meeting days and room (e.g. `Mon & Thu 08:00-09:30 @ Room 101`).
   - The system automatically groups identical schedule days as `M-TH 08:00–09:30 @ Room 101`.
   - The conflict detector automatically prevents room double-booking or scheduling the same teacher simultaneously.
5. In **Section Details**, use **+ Register New Student** to register students directly into the section and proceed immediately to face enrollment.

### Teacher Workflow
1. Log in with `prof_albert` / `StrongPassword123!`.
2. The **Teacher Dashboard** displays all assigned sections, subjects, schedule times, and student counts.
3. Click **Start Attendance** on today's scheduled section to create or open today's session.
4. The live attendance monitor opens with camera feed on the left and student roster on the right.

### Face Enrollment Workflow
1. Navigate to **Face Enrollment** from the sidebar or navbar.
2. Select an unenrolled student from the searchable grid or click **+ Register New Student**.
3. Capture a photo using the live camera or upload a clear frontal portrait photo.
4. The system validates face presence, extracts a 128-dimensional embedding vector, and caches it in memory for high-speed matching.

### Live Attendance Scanning
1. In the live attendance session (`/sessions/<id>/live/`), click **Start Camera**.
2. Position your face in front of the camera.
3. The system scans the feed with progressive fallbacks:
   - **Fast scan**: 0.5x localization for high-res feeds.
   - **Full-res fallback**: Native resolution detection if faces are distant.
   - **CLAHE adaptive equalization**: Handles harsh backlighting (e.g., windows or bright lamps behind the student).
4. When recognized:
   - Green bounding box with Student ID, Name, and confidence score.
   - Status updates **immediately to Present** with scan timestamp.
   - Audio chime plays and manual buttons disappear.

### Wrong-Section Detection
If a student enrolled in Section B steps in front of the camera during Section A's session:
- The system checks the in-memory global student matrix (~0.3ms).
- Identifies the student and detects section mismatch.
- Highlights face with a bold **Red Bounding Box**: `⚠ WRONG SECTION: [ID] · [Name] (Assigned: BSCS-2B)`.
- Sounds a low-frequency warning buzzer.
- Displays a toast alert: `⚠ WRONG SECTION — Attendance NOT marked`.

---

## 10. Running Automated Tests

AttendFR features comprehensive test suites covering model validations, conflict checks, RBAC, and face recognition:

### Run Standard Django Unit Tests (22 Tests)
```bash
python manage.py test
```

### Run Feature Test Suite (Laravel Artisan-Style, 19 Tests)
```bash
python manage.py test_features
```

Both test suites use an isolated test database and will report `PASS` with zero failures.

---

## 11. Troubleshooting & FAQs

### Q: Why does the camera say "Camera ready" or "Scanning..." but not detect my face?
- **Lighting & Backlighting**: Ensure the light source is in front of you, not directly behind your head. Our built-in CLAHE processor balances backlighting, but extreme glare can obscure facial features.
- **Face Enrollment**: Ensure your face was successfully enrolled under **Face Enrollment**.
- **Section Enrollment**: Make sure the student is enrolled in the section corresponding to the active session. If enrolled in another section, the system will trigger a red "Wrong Section" alert.

### Q: Database connection error (`Access denied for user 'root'`)?
- Check your `.env` file. Ensure `DB_PORT=3306`, `DB_USER=root`, and `DB_PASSWORD` match your MySQL setup. In standard XAMPP, `DB_PASSWORD` is empty by default.

### Q: Session is closed and won't let me scan?
- Visit `/sessions/<id>/report/` and click the green **Re-open Session** button at the top right to resume scanning.
