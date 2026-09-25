# AttendFR — Face Recognition Attendance Management System

[![Python](https://img.shields.io/badge/Python-3.10%20%7C%203.11%20%7C%203.12-blue.svg)](https://www.python.org/)
[![Django](https://img.shields.io/badge/Django-5.x-darkgreen.svg)](https://www.djangoproject.com/)
[![dlib](https://img.shields.io/badge/dlib-128D%20Embeddings-red.svg)](http://dlib.net/)
[![OpenCV](https://img.shields.io/badge/OpenCV-Enabled-orange.svg)](https://opencv.org/)
[![Database](https://img.shields.io/badge/Database-MariaDB%20%2F%20MySQL-blue.svg)](https://mariadb.org/)
[![Tests](https://img.shields.io/badge/Tests-22%20Passing-brightgreen.svg)](https://github.com/jvrycode/Attendance-Face-Recognition)

**AttendFR** is a modern, enterprise-ready Automated Attendance Management System developed in Python & Django 5. It pairs real-time webcam facial detection and 128-dimensional embedding comparison with intelligent academic scheduling, schedule conflict detection, dynamic multi-day schedule grouping, and two-tier wrong-section prevention.

---

## ✨ Key Features

- 👤 **Role-Based Access Control (RBAC)**:
  - **Admin**: Manages subjects, sections, schedules, teachers, and student rosters.
  - **Teacher**: Starts live attendance sessions, monitors real-time detection, reviews reports, and exports CSVs.
  - **Student**: Reviews personal attendance history, percentage stats, and session remarks.
- ⚡ **Multi-Stage Robust Face Recognition**:
  - Progressive multi-resolution fallback (`0.5x` fast scan -> full resolution -> 1x upsample).
  - **CLAHE adaptive histogram equalization** to eliminate recognition failures caused by harsh backlighting (e.g. bright windows behind the subject).
  - Sub-millisecond vectorized NumPy matrix comparison against section rosters.
- 🚫 **Two-Tier Wrong-Section Prevention**:
  - Cross-checks unidentified faces against school-wide enrollments.
  - Flags students scanning in the wrong class with **bold red bounding boxes**, audio buzzers, and assigned section notifications.
- 📅 **Smart Academic Scheduling**:
  - Automatic multi-day grouping (e.g., `M-TH 08:00–09:30 @ Room 101`).
  - Validation engine rejects room double-booking and teacher schedule overlaps.
- ⏱ **Instant Live Attendance Marking**:
  - Scanning updates row status to **Present** (or Late) in real-time with exact timestamp and confidence score.
  - Generates downloadable CSV reports and printable session summaries.
- 🧪 **Comprehensive Automated Testing**:
  - 22 Django unit tests + 19 feature tests passing with 100% success.

---

## 🚀 Quick Start (Local Setup)

For the detailed, comprehensive guide, see [PROJECT_GUIDE.md](PROJECT_GUIDE.md).

### 1. Clone the repository
```bash
git clone https://github.com/jvrycode/Attendance-Face-Recognition.git
cd Attendance-Face-Recognition
```

### 2. Set up virtual environment
```bash
# Windows
python -m venv .venv
.venv\Scripts\activate

# macOS / Linux
python3 -m venv .venv
source .venv/bin/activate
```

### 3. Install requirements
```bash
python -m pip install --upgrade pip
pip install -r requirements.txt
```

### 4. Configure environment
```bash
# Copy example environment configuration
copy .env.example .env   # Windows
cp .env.example .env     # Linux / macOS
```
*(Ensure your MySQL server is running in XAMPP on port `3306` with database `attendance_db`)*

### 5. Run migrations & seed data
```bash
python manage.py makemigrations accounts core face_app
python manage.py migrate
python seed.py
```

### 6. Start server
```bash
python manage.py runserver
```
Visit: **[http://127.0.0.1:8000/](http://127.0.0.1:8000/)**

---

## 🔑 Default Credentials

| Role | Username | Password |
| :--- | :--- | :--- |
| **Administrator** | `admin` | `AdminPass123!` |
| **Teacher (CS101)** | `prof_albert` | `StrongPassword123!` |
| **Teacher (CS102)** | `prof_curie` | `StrongPassword123!` |
| **Student** | `student_juan` | `StudentPass123!` |

---

## 🧪 Running Tests

```bash
# Unit test suite (22 tests)
python manage.py test

# Feature test suite (19 tests)
python manage.py test_features
```

---

## 📄 License & Documentation

Detailed architecture specifications and setup walkthroughs:
- [PROJECT_GUIDE.md](PROJECT_GUIDE.md) — Comprehensive Setup & Usage Guide
- [DOCUMENTATION.md](DOCUMENTATION.md) — Architecture & API Specification
