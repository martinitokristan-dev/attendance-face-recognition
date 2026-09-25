"""
Seed script: Creates initial admin, sample teacher, and sample student.
Run with: python seed.py
"""
import os
import sys
import django

# Configure UTF-8 output if possible
if hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'attendance_fr.settings')
django.setup()

from accounts.models import CustomUser, Teacher, Student
from core.models import Subject, Section, Schedule, StudentSection
from datetime import time
from django.utils import timezone

print("[INFO] Seeding database...")

admin_only = '--admin-only' in sys.argv or '-a' in sys.argv or os.getenv('SEED_ADMIN_ONLY', 'False').lower() in ('true', '1')

# ── Admin ─────────────────────────────────────────────────────────────────────
if not CustomUser.objects.filter(username='admin').exists():
    admin = CustomUser.objects.create_superuser(
        username='admin',
        email='admin@attendfr.edu',
        password='admin123',
        first_name='System',
        last_name='Administrator',
        role='admin'
    )
    print("[OK] Admin created: username=admin, password=admin123")
else:
    print("[INFO] Admin already exists.")

if admin_only:
    # Initialize academic programs for dropdown selections
    from core.models import Program
    fsuu_programs = [
        ('CITEC',   'College of Information, Technology, Entertainment, and Computing', 'CITEC'),
        ('CCJE',    'College of Criminal Justice Education',                            'CCJE'),
        ('CTE',     'College of Teacher Education',                                     'CTE'),
        ('CoA',     'College of Accountancy',                                           'CoA'),
        ('CoN',     'College of Nursing',                                               'CoN'),
        ('CAS',     'College of Arts and Sciences',                                     'CAS'),
        ('CORE',    'College of Operations, Resources, and Entrepreneurship',           'CORE'),
        ('CEnTech', 'College of Engineering and Technology',                            'CEnTech'),
        ('CIHT',    'College of Innovative Hospitality and Tourism',                    'CIHT'),
    ]
    for p_code, p_name, p_college in fsuu_programs:
        obj, created = Program.objects.get_or_create(
            code=p_code,
            defaults={'name': p_name, 'college': p_college}
        )
        if not created:
            obj.name = p_name
            obj.college = p_college
            obj.save()
    print(f"[OK] FSUU Academic Colleges initialized ({len(fsuu_programs)} official colleges).")
    print("\n[SUCCESS] Admin-only seed complete!")
    print("  Created Administrator: username=admin, password=admin123")
    print("  Skipped: Zero teachers, zero students, and zero test records created.")
    sys.exit(0)

# ── Teacher ───────────────────────────────────────────────────────────────────
if not CustomUser.objects.filter(username='teacher1').exists():
    t_user = CustomUser.objects.create_user(
        username='teacher1',
        email='teacher1@attendfr.edu',
        password='teacher123',
        first_name='Maria',
        last_name='Santos',
        role='teacher'
    )
    teacher = Teacher.objects.create(
        user=t_user,
        employee_id='EMP-001',
        department='Computer Science',
        specialization='Software Engineering'
    )
    print("[OK] Teacher created: username=teacher1, password=teacher123")
else:
    teacher = Teacher.objects.get(user__username='teacher1')
    print("[INFO] Teacher already exists.")

# ── Student ───────────────────────────────────────────────────────────────────
if not CustomUser.objects.filter(username='student1').exists():
    s_user = CustomUser.objects.create_user(
        username='student1',
        email='student1@attendfr.edu',
        password='student123',
        first_name='Juan',
        last_name='Dela Cruz',
        role='student'
    )
    import json
    import numpy as np
    rng = np.random.RandomState(42)
    vec = rng.randn(128).astype(np.float32)
    vec = (vec / np.linalg.norm(vec)).tolist()
    student = Student.objects.create(
        user=s_user,
        student_id='2024-00001',
        year_level=2,
        course='BSCS',
        face_encoding=json.dumps(vec),
        face_enrolled_at=timezone.now()
    )
    print("[OK] Student created: username=student1, password=student123 (with enrolled face vector)")
else:
    student = Student.objects.get(user__username='student1')
    if not student.face_encoding:
        import json
        import numpy as np
        rng = np.random.RandomState(42)
        vec = rng.randn(128).astype(np.float32)
        vec = (vec / np.linalg.norm(vec)).tolist()
        student.face_encoding = json.dumps(vec)
        student.face_enrolled_at = timezone.now()
        student.save()
        print("[OK] Enrolled synthetic face vector for existing student1.")
    print("[INFO] Student already exists.")

# ── Programs (FSUU Butuan City — Official 2024–2025) ──────────────────────────
from core.models import Program

fsuu_programs = [
    ('CITEC',   'College of Information, Technology, Entertainment, and Computing', 'CITEC'),
    ('CCJE',    'College of Criminal Justice Education',                            'CCJE'),
    ('CTE',     'College of Teacher Education',                                     'CTE'),
    ('CoA',     'College of Accountancy',                                           'CoA'),
    ('CoN',     'College of Nursing',                                               'CoN'),
    ('CAS',     'College of Arts and Sciences',                                     'CAS'),
    ('CORE',    'College of Operations, Resources, and Entrepreneurship',           'CORE'),
    ('CEnTech', 'College of Engineering and Technology',                            'CEnTech'),
    ('CIHT',    'College of Innovative Hospitality and Tourism',                    'CIHT'),
]

for p_code, p_name, p_college in fsuu_programs:
    obj, created = Program.objects.get_or_create(
        code=p_code,
        defaults={'name': p_name, 'college': p_college}
    )
    if not created:
        obj.name = p_name
        obj.college = p_college
        obj.save()

print(f"[OK] FSUU Academic Colleges initialized ({len(fsuu_programs)} official colleges).")
prog_citec = Program.objects.get(code='CITEC')


# ── Section ───────────────────────────────────────────────────────────────────
section, _ = Section.objects.get_or_create(
    name='BSCS-2A',
    defaults={
        'program': prog_citec,
        'year_level': 2,
        'teacher': teacher,
        'school_year': '2025-2026',
        'semester': '1st'
    }
)
if section.program is None:
    section.program = prog_citec
    section.year_level = 2
    section.save()
print(f"[OK] Section: {section}")

# ── Subject ───────────────────────────────────────────────────────────────────
subject, _ = Subject.objects.get_or_create(
    code='CS101',
    defaults={
        'name': 'Introduction to Computing',
        'units': 3,
        'program': prog_citec,
        'section': section,
        'teacher': teacher
    }
)
if subject.program is None:
    subject.program = prog_citec
if subject.section is None:
    subject.section = section
subject.save()

if section.subject is None:
    section.subject = subject
    section.save()
print(f"[OK] Subject: {subject}")

# ── Schedule ──────────────────────────────────────────────────────────────────
if not Schedule.objects.filter(section=section, day_of_week='Mon').exists():
    schedule = Schedule(
        section=section,
        day_of_week='Mon',
        start_time=time(8, 0),
        end_time=time(9, 30),
        room='Room 101'
    )
    schedule.save()
    print(f"[OK] Schedule created: {schedule}")

# ── Enroll student into section ───────────────────────────────────────────────
try:
    student_obj = Student.objects.get(user__username='student1')
    StudentSection.objects.get_or_create(student=student_obj, section=section)
    print(f"[OK] Student enrolled in {section.name}")
except Student.DoesNotExist:
    pass

print("\n[SUCCESS] Seed complete!")
print("\nLogin credentials:")
print("  Admin:   username=admin    password=admin123")
print("  Teacher: username=teacher1 password=teacher123")
print("  Student: username=student1 password=student123")
print("\nStart the server with: python manage.py runserver")
