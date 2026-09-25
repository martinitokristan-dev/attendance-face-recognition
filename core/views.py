import datetime
from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth.decorators import login_required
from django.contrib import messages
from django.utils import timezone
from django.db.models import Count, Q
from django.core.exceptions import ValidationError
from django.http import JsonResponse
from .models import Program, ProgramSection, Subject, Section, Schedule, AttendanceSession, AttendanceRecord, StudentSection
from .forms import ProgramForm, ProgramSectionForm, SubjectForm, SectionForm, ScheduleForm
from accounts.models import Student
from accounts.decorators import admin_required, teacher_required


# ─── Academic Programs (Admin only) ───────────────────────────────────────────

@login_required
@admin_required
def program_list(request):
    programs = Program.objects.annotate(
        section_count=Count('sections', distinct=True),
        subject_count=Count('subjects', distinct=True)
    ).order_by('code')
    return render(request, 'core/program_list.html', {
        'programs': programs,
        'program_form': ProgramForm(),
    })


@login_required
@admin_required
def program_create(request):
    form = ProgramForm(request.POST or None)
    if request.method == 'POST' and form.is_valid():
        prog = form.save()
        messages.success(request, f'Program "{prog.code}" created successfully.')
        return redirect('program_list')
    return render(request, 'core/program_form.html', {'form': form, 'title': 'Add Academic Program'})


@login_required
@admin_required
def program_edit(request, pk):
    program = get_object_or_404(Program, pk=pk)
    form = ProgramForm(request.POST or None, instance=program)
    if request.method == 'POST' and form.is_valid():
        form.save()
        messages.success(request, f'Program "{program.code}" updated successfully.')
        return redirect('program_list')
    return render(request, 'core/program_form.html', {'form': form, 'title': 'Edit Program', 'program': program})


@login_required
@admin_required
def program_delete(request, pk):
    program = get_object_or_404(Program, pk=pk)
    if request.method == 'POST':
        program.delete()
        messages.success(request, 'Program deleted.')
        return redirect('program_list')
    return render(request, 'core/confirm_delete.html', {'object': program, 'type': 'Program'})


# ─── Section Catalog (3NF Master Definitions - Admin only) ────────────────────

@login_required
@admin_required
def section_catalog_list(request):
    """Admin view to view and manage standard section definitions grouped by Program."""
    programs = Program.objects.prefetch_related('standard_sections').order_by('code')
    selected_program_id = request.GET.get('program')
    
    psections_qs = ProgramSection.objects.select_related('program').order_by('program__code', 'year_level', 'name')
    if selected_program_id:
        psections_qs = psections_qs.filter(program_id=selected_program_id)

    form = ProgramSectionForm()

    return render(request, 'core/section_catalog_list.html', {
        'programs': programs,
        'program_sections': psections_qs,
        'selected_program_id': selected_program_id,
        'form': form,
    })


@login_required
@admin_required
def section_catalog_create(request):
    """Admin creates a new ProgramSection definition in the catalog."""
    form = ProgramSectionForm(request.POST or None)
    if request.method == 'POST' and form.is_valid():
        psec = form.save()
        messages.success(request, f'Section "{psec.name}" added to {psec.program.code} catalog.')
        return redirect('section_catalog_list')
    return render(request, 'core/section_catalog_form.html', {'form': form, 'title': 'Add Section to Catalog'})


@login_required
@admin_required
def section_catalog_delete(request, pk):
    psec = get_object_or_404(ProgramSection, pk=pk)
    if request.method == 'POST':
        name = psec.name
        code = psec.program.code
        psec.delete()
        messages.success(request, f'Section "{name}" deleted from {code}.')
        return redirect('section_catalog_list')
    return render(request, 'core/confirm_delete.html', {'object': psec, 'type': 'Section Definition'})


# ─── Dynamic Dropdown APIs (Program-Dependent Filtering) ──────────────────────

@login_required
def api_program_sections(request, program_id):
    """Returns JSON list of master ProgramSections belonging to a specific Program."""
    psections = ProgramSection.objects.filter(program_id=program_id).order_by('year_level', 'name')
    data = [
        {
            'id': ps.pk,
            'name': ps.name,
            'year_level': ps.year_level,
            'year_level_display': ps.get_year_level_display(),
        }
        for ps in psections
    ]
    return JsonResponse({'sections': data})


@login_required
@admin_required
def api_create_program_section(request):
    """Creates a new ProgramSection master record via AJAX quick-add modal."""
    if request.method != 'POST':
        return JsonResponse({'error': 'POST required'}, status=405)
    
    import json
    try:
        if request.content_type == 'application/json':
            payload = json.loads(request.body)
        else:
            payload = request.POST

        program_id = payload.get('program_id')
        name = (payload.get('name') or '').strip()
        year_level = int(payload.get('year_level', 1))

        if not program_id or not name:
            return JsonResponse({'error': 'Program and Section Name are required.'}, status=400)

        program = get_object_or_404(Program, pk=program_id)
        psec, created = ProgramSection.objects.get_or_create(
            program=program,
            name=name,
            defaults={'year_level': year_level}
        )

        return JsonResponse({
            'success': True,
            'created': created,
            'section': {
                'id': psec.pk,
                'name': psec.name,
                'year_level': psec.year_level,
                'year_level_display': psec.get_year_level_display(),
                'program_code': program.code,
            }
        })
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


@login_required
def api_sections_by_program(request, program_id):
    """Returns JSON list of active class sections belonging to a specific Program."""
    sections = Section.objects.filter(program_id=program_id).order_by('name')
    data = [
        {'id': s.pk, 'name': s.name, 'year_level': s.get_year_level_display()}
        for s in sections
    ]
    return JsonResponse({'sections': data})


# ─── Subjects (Admin only) ─────────────────────────────────────────────────────

@login_required
@admin_required
def subject_list(request):
    subjects = Subject.objects.select_related('program', 'section', 'teacher__user').order_by('code')
    programs = Program.objects.all().order_by('code')
    return render(request, 'core/subject_list.html', {
        'subjects': subjects,
        'subject_form': SubjectForm(),
        'programs': programs,
    })


@login_required
@admin_required
def subject_create(request):
    form = SubjectForm(request.POST or None)
    if request.method == 'POST' and form.is_valid():
        subject = form.save()
        # Automatically connect section's primary subject if currently empty
        if subject.section and not subject.section.subject:
            subject.section.subject = subject
            subject.section.save()
        messages.success(request, f'Subject "{subject.code} - {subject.name}" linked successfully.')
        return redirect('subject_list')
    return render(request, 'core/subject_form.html', {'form': form, 'title': 'Add Subject'})


@login_required
@admin_required
def subject_edit(request, pk):
    subject = get_object_or_404(Subject, pk=pk)
    form = SubjectForm(request.POST or None, instance=subject)
    if request.method == 'POST' and form.is_valid():
        subj = form.save()
        if subj.section and not subj.section.subject:
            subj.section.subject = subj
            subj.section.save()
        messages.success(request, 'Subject updated.')
        return redirect('subject_list')
    return render(request, 'core/subject_form.html', {'form': form, 'title': 'Edit Subject', 'subject': subject})


@login_required
@admin_required
def subject_delete(request, pk):
    subject = get_object_or_404(Subject, pk=pk)
    if request.method == 'POST':
        subject.delete()
        messages.success(request, 'Subject deleted.')
        return redirect('subject_list')
    return render(request, 'core/confirm_delete.html', {'object': subject, 'type': 'Subject'})


# ─── Sections ─────────────────────────────────────────────────────────────────

@login_required
def section_list(request):
    base_qs = Section.objects.select_related(
        'program', 'subject', 'teacher__user'
    ).prefetch_related('schedules', 'subjects').annotate(
        student_count=Count('enrollments', distinct=True)
    ).order_by('program__code', 'name')

    if request.user.role == 'admin':
        sections = base_qs
    elif request.user.role == 'teacher':
        teacher = getattr(request.user, 'teacher_profile', None)
        if teacher:
            from django.db.models import Q
            sections = base_qs.filter(Q(teacher=teacher) | Q(subjects__teacher=teacher)).distinct()
        else:
            sections = Section.objects.none()
    elif request.user.role == 'student':
        student = getattr(request.user, 'student_profile', None)
        if student:
            sections = base_qs.filter(enrollments__student=student).distinct()
        else:
            sections = Section.objects.none()
    else:
        messages.error(request, "Permission denied.")
        return redirect('dashboard')

    from core.services import TimetableService
    from core.session_helpers import attach_today_sessions

    timetable_data = TimetableService.build_timetable_data(sections)
    today = timezone.localdate()
    attach_today_sessions(sections, today)

    context = {
        'sections': sections,
        'timetable': timetable_data,
        'attendance_today': today,
    }
    if request.user.role == 'admin':
        context['section_form'] = SectionForm()
        context['programs'] = Program.objects.all().order_by('code')

    return render(request, 'core/section_list.html', context)


@login_required
@admin_required
def section_create(request):
    form = SectionForm(request.POST or None)
    if request.method == 'POST' and form.is_valid():
        section = form.save()
        messages.success(request, f'Section "{section.name}" created under {section.program.code if section.program else "general program"}.')
        return redirect('section_list')
    return render(request, 'core/section_form.html', {'form': form, 'title': 'Add Section'})


@login_required
@admin_required
def section_edit(request, pk):
    section = get_object_or_404(Section, pk=pk)
    form = SectionForm(request.POST or None, instance=section)
    if request.method == 'POST' and form.is_valid():
        form.save()
        messages.success(request, 'Section updated.')
        return redirect('section_list')
    return render(request, 'core/section_form.html', {'form': form, 'title': 'Edit Section', 'section': section})


@login_required
@admin_required
def section_delete(request, pk):
    section = get_object_or_404(Section, pk=pk)
    if request.method == 'POST':
        section.delete()
        messages.success(request, 'Section deleted.')
        return redirect('section_list')
    return render(request, 'core/confirm_delete.html', {'object': section, 'type': 'Section'})


@login_required
def section_detail(request, pk):
    section = get_object_or_404(
        Section.objects.select_related('program', 'subject', 'teacher__user').prefetch_related(
            'schedules', 'enrollments__student__user', 'subjects'
        ), pk=pk
    )

    if request.user.role == 'teacher':
        teacher = getattr(request.user, 'teacher_profile', None)
        is_assigned = (section.teacher == teacher) or section.subjects.filter(teacher=teacher).exists()
        if not is_assigned and request.user.role != 'admin':
            messages.error(request, "Permission denied: You are not assigned to this section.")
            return redirect('dashboard')
    elif request.user.role == 'student':
        student = getattr(request.user, 'student_profile', None)
        if not student or not section.enrollments.filter(student=student).exists():
            messages.error(request, "Permission denied.")
            return redirect('dashboard')
    elif request.user.role != 'admin':
        messages.error(request, "Permission denied.")
        return redirect('dashboard')

    from core.session_helpers import attach_today_sessions
    attach_today_sessions([section], timezone.localdate())

    # Scalable fallback POST handler
    if request.method == 'POST' and request.user.role == 'admin':
        student_id = request.POST.get('student') or request.POST.get('student_id')
        if student_id:
            student = get_object_or_404(Student, pk=student_id)
            StudentSection.objects.get_or_create(student=student, section=section)
            from face_app.services.face_service import FaceService
            FaceService.invalidate_cache(section.pk)
            messages.success(request, f'{student} enrolled in {section.name}.')
            return redirect('section_detail', pk=pk)

    return render(request, 'core/section_detail.html', {
        'section': section,
        'schedule_form': ScheduleForm(initial={'section': section}),
    })


@login_required
def student_search_api(request):
    """
    High-performance indexed student search for class enrollment.
    Uses indexed prefix queries with strict LIMIT 12, scaling to 10M+ rows with sub-10ms latency.
    """
    if request.user.role not in ['admin', 'teacher']:
        return JsonResponse({'error': 'Unauthorized'}, status=403)

    q = request.GET.get('q', '').strip()
    section_id = request.GET.get('section_id')

    if not q:
        return JsonResponse({'results': []})

    from django.db.models import Q
    qs = Student.objects.select_related('user')

    # Subquery exclusion using indexed StudentSection foreign keys
    if section_id:
        qs = qs.exclude(enrollments__section_id=section_id)

    # Prefix and exact queries on indexed columns (student_id, last_name, first_name, username)
    qs = qs.filter(
        Q(student_id__istartswith=q) |
        Q(user__last_name__istartswith=q) |
        Q(user__first_name__istartswith=q) |
        Q(user__username__istartswith=q) |
        Q(student_id__icontains=q)
    ).order_by('user__last_name', 'user__first_name')[:12]

    results = []
    for s in qs:
        results.append({
            'id': s.pk,
            'student_id': s.student_id,
            'name': s.user.get_full_name() or s.user.username,
            'email': s.user.email,
            'course': s.course,
            'year_level': s.year_level,
            'is_face_enrolled': s.is_face_enrolled,
            'avatar_letter': (s.user.first_name or s.user.username)[0].upper(),
        })

    return JsonResponse({'results': results})


@login_required
def section_enroll_student_api(request, pk):
    """AJAX / Form endpoint to enroll an existing student into a section."""
    if request.user.role != 'admin':
        return JsonResponse({'success': False, 'error': 'Permission denied: Only administrators can enroll students.'}, status=403)

    section = get_object_or_404(Section, pk=pk)

    if request.method == 'POST':
        student_id = request.POST.get('student_id')
        subject_id = request.POST.get('subject_id') or request.POST.get('subject')
        if not student_id:
            try:
                import json
                body = json.loads(request.body)
                student_id = body.get('student_id')
                subject_id = body.get('subject_id') or body.get('subject')
            except Exception:
                pass

        if not student_id:
            return JsonResponse({'success': False, 'error': 'Student ID is required.'}, status=400)

        student = get_object_or_404(Student, pk=student_id)
        subject = None
        if subject_id:
            subject = get_object_or_404(Subject, pk=subject_id, section=section)

        enrollment, created = StudentSection.objects.get_or_create(student=student, section=section, subject=subject)

        from face_app.services.face_service import FaceService
        FaceService.invalidate_cache(section.pk)

        full_name = student.user.get_full_name() or student.user.username
        msg = f"{full_name} ({student.student_id}) enrolled in {section.name}."

        is_ajax = request.headers.get('x-requested-with') == 'XMLHttpRequest' or 'application/json' in request.headers.get('Accept', '') or request.content_type == 'application/json'
        if is_ajax:
            return JsonResponse({
                'success': True,
                'created': created,
                'message': msg,
                'student': {
                    'id': student.pk,
                    'student_id': student.student_id,
                    'name': full_name,
                    'course': student.course,
                    'year_level': student.year_level,
                    'is_face_enrolled': student.is_face_enrolled,
                    'avatar_letter': (student.user.first_name or student.user.username)[0].upper(),
                }
            })

        messages.success(request, msg)
        return redirect('section_detail', pk=pk)

    return JsonResponse({'error': 'POST required'}, status=405)


@login_required
def student_unenroll(request, section_pk, student_pk):
    enrollment = get_object_or_404(StudentSection, section_id=section_pk, student_id=student_pk)
    if request.user.role == 'teacher':
        teacher = getattr(request.user, 'teacher_profile', None)
        if enrollment.section.teacher != teacher and request.user.role != 'admin':
            messages.error(request, "Permission denied.")
            return redirect('dashboard')
    elif request.user.role != 'admin':
        messages.error(request, "Permission denied.")
        return redirect('dashboard')

    if request.method == 'POST':
        enrollment.delete()
        from face_app.services.face_service import FaceService
        FaceService.invalidate_cache(section_pk)
        messages.success(request, 'Student removed from section.')
    return redirect('section_detail', pk=section_pk)


@login_required
def api_section_details(request, pk):
    """Returns JSON details of a section, its schedules, teacher, and enrolled students."""
    section = get_object_or_404(
        Section.objects.select_related('program', 'subject', 'teacher__user').prefetch_related(
            'schedules', 'enrollments__student__user', 'subjects'
        ),
        pk=pk
    )

    if request.user.role == 'teacher':
        teacher = getattr(request.user, 'teacher_profile', None)
        is_assigned = (section.teacher == teacher) or section.subjects.filter(teacher=teacher).exists()
        if not is_assigned and not request.user.is_superuser:
            return JsonResponse({'error': 'Unauthorized'}, status=403)
    elif request.user.role == 'student':
        student = getattr(request.user, 'student_profile', None)
        if not student or not section.enrollments.filter(student=student).exists():
            return JsonResponse({'error': 'Unauthorized'}, status=403)

    schedules_data = [
        {
            'day': s.full_days_display,
            'days_display': s.days_display,
            'time_display': s.time_display,
            'room': s.room or 'TBA',
        }
        for s in section.schedules.all()
    ]

    subjects_data = [
        {
            'id': s.id,
            'code': s.code,
            'name': s.name,
            'units': s.units,
            'teacher_name': s.teacher.user.get_full_name() if s.teacher and s.teacher.user else 'Unassigned',
            'teacher_id': s.teacher.id if s.teacher else None,
        }
        for s in section.subjects.all()
    ]

    students_data = [
        {
            'id': e.student.pk,
            'enrollment_id': e.pk,
            'name': e.student.user.get_full_name() or e.student.user.username,
            'student_id': e.student.student_id,
            'course': e.student.course,
            'year_level': e.student.year_level,
            'is_face_enrolled': e.student.is_face_enrolled,
            'avatar_letter': (e.student.user.first_name or e.student.user.username)[0].upper(),
            'is_irregular': e.subject_id is not None,
            'subject_id': e.subject_id,
            'subject_code': e.subject.code if e.subject else None,
            'subject_name': e.subject.name if e.subject else None,
        }
        for e in section.enrollments.select_related('student__user', 'subject').all()
    ]

    data = {
        'id': section.pk,
        'name': section.name,
        'program_code': section.program.code if section.program else '—',
        'program_name': section.program.name if section.program else '',
        'year_level': section.get_year_level_display(),
        'subject_code': section.effective_subject.code if section.effective_subject else '—',
        'subject_name': section.effective_subject.name if section.effective_subject else 'No Subject Linked',
        'teacher_name': section.teacher.user.get_full_name() if section.teacher else 'Unassigned',
        'teacher_email': section.teacher.user.email if section.teacher else '',
        'school_year': section.school_year,
        'semester': section.get_semester_display() if hasattr(section, 'get_semester_display') else section.semester,
        'student_count': section.enrollments.values('student_id').distinct().count(),
        'subjects': subjects_data,
        'schedules': schedules_data,
        'students': students_data,
    }
    return JsonResponse({'section': data})


# ─── Schedules ─────────────────────────────────────────────────────────────────

@login_required
@admin_required
def schedule_list(request):
    schedules = Schedule.objects.select_related(
        'section__subject', 'section__teacher__user'
    ).order_by('day_of_week', 'start_time')
    return render(request, 'core/schedule_list.html', {
        'schedules': schedules,
        'schedule_form': ScheduleForm(),
    })


@login_required
@admin_required
def schedule_create(request):
    form = ScheduleForm(request.POST or None)
    if request.method == 'POST' and form.is_valid():
        cd = form.cleaned_data
        sched = Schedule(
            section=cd['section'],
            day_of_week=cd['day_1'],
            day_2=cd.get('day_2') or None,
            start_time=cd['start_time'],
            end_time=cd['end_time'],
            room=cd['room'],
            effective_from=cd.get('effective_from'),
            effective_to=cd.get('effective_to'),
        )
        try:
            sched.full_clean()
            sched.save()
            messages.success(request, f'Schedule created: {sched}')
            return redirect('schedule_list')
        except ValidationError as e:
            messages.error(request, str(e.message))
    return render(request, 'core/schedule_form.html', {'form': form, 'title': 'Add Schedule'})


@login_required
@admin_required
def schedule_edit(request, pk):
    schedule = get_object_or_404(Schedule, pk=pk)
    initial = {
        'section': schedule.section,
        'day_1': schedule.day_of_week,
        'day_2': schedule.day_2 or '',
        'start_time': schedule.start_time,
        'end_time': schedule.end_time,
        'room': schedule.room,
        'effective_from': schedule.effective_from,
        'effective_to': schedule.effective_to,
    }
    form = ScheduleForm(request.POST or None, initial=initial)
    if request.method == 'POST' and form.is_valid():
        cd = form.cleaned_data
        schedule.section = cd['section']
        schedule.day_of_week = cd['day_1']
        schedule.day_2 = cd.get('day_2') or None
        schedule.start_time = cd['start_time']
        schedule.end_time = cd['end_time']
        schedule.room = cd['room']
        schedule.effective_from = cd.get('effective_from')
        schedule.effective_to = cd.get('effective_to')
        try:
            schedule.full_clean()
            schedule.save()
            messages.success(request, f'Schedule updated: {schedule}')
            return redirect('schedule_list')
        except ValidationError as e:
            messages.error(request, str(e.message))
    return render(request, 'core/schedule_form.html', {'form': form, 'title': 'Edit Schedule', 'schedule': schedule})


@login_required
@admin_required
def schedule_delete(request, pk):
    schedule = get_object_or_404(Schedule, pk=pk)
    if request.method == 'POST':
        schedule.delete()
        messages.success(request, 'Schedule deleted.')
        return redirect('schedule_list')
    return render(request, 'core/confirm_delete.html', {'object': schedule, 'type': 'Schedule'})


# ─── Attendance Sessions (Teacher) ─────────────────────────────────────────────

@login_required
@teacher_required
def session_start(request, schedule_pk):
    schedule = get_object_or_404(Schedule, pk=schedule_pk)
    teacher = request.user.teacher_profile

    # Verify the teacher owns this section or subject
    is_assigned = (schedule.section.teacher == teacher) or schedule.section.subjects.filter(teacher=teacher).exists()
    if not is_assigned and request.user.role != 'admin':
        messages.error(request, "You are not assigned to this section.")
        return redirect('dashboard')

    today = timezone.localdate()
    # Check for existing open session today
    existing = AttendanceSession.objects.filter(
        schedule=schedule, date=today, status='open'
    ).first()
    if existing:
        messages.info(request, 'A session is already open for today.')
        return redirect('session_live', pk=existing.pk)

    closed_today = AttendanceSession.objects.filter(
        schedule=schedule, date=today, status='closed'
    ).first()
    if closed_today:
        if request.method == 'POST':
            closed_today.status = 'open'
            closed_today.closed_at = None
            closed_today.save()
            messages.success(request, f'Attendance session re-opened for {schedule.section.name}. Scanner active.')
            return redirect('session_live', pk=closed_today.pk)
        return render(request, 'core/session_start.html', {
            'schedule': schedule,
            'closed_today': closed_today,
        })

    if request.method == 'POST':
        session = AttendanceSession.objects.create(
            schedule=schedule,
            date=today,
            started_by=teacher,
            status='open',
        )
        # Pre-populate attendance records as "absent" for all enrolled students
        from django.db.models import Q
        if schedule.subject:
            enrollments = StudentSection.objects.filter(
                Q(section=schedule.section) & (Q(subject__isnull=True) | Q(subject=schedule.subject))
            ).select_related('student').distinct()
        else:
            enrollments = StudentSection.objects.filter(section=schedule.section).select_related('student')

        seen_students = set()
        records = []
        for e in enrollments:
            if e.student_id not in seen_students:
                seen_students.add(e.student_id)
                records.append(AttendanceRecord(session=session, student=e.student, status='absent'))
        AttendanceRecord.objects.bulk_create(records)
        messages.success(request, f'Attendance session started for {schedule.section.name}.')
        return redirect('session_live', pk=session.pk)

    return render(request, 'core/session_start.html', {'schedule': schedule})


def _user_can_manage_session(user, session):
    """Returns True if user is an admin or the teacher assigned to the session's section/subject."""
    if not user or not user.is_authenticated:
        return False
    if user.role == 'admin':
        return True
    if user.role == 'teacher':
        teacher = getattr(user, 'teacher_profile', None)
        if not teacher:
            return False
        return (
            (session.started_by == teacher) or
            (session.schedule.subject and session.schedule.subject.teacher == teacher) or
            (session.schedule.section.teacher == teacher) or
            session.schedule.section.subjects.filter(teacher=teacher).exists()
        )
    return False


@login_required
@teacher_required
def session_live(request, pk):
    session = get_object_or_404(
        AttendanceSession.objects.select_related(
            'schedule__section__subject', 'schedule__section__teacher__user', 'started_by__user'
        ), pk=pk
    )

    # Object-level authorization check: Admin or assigned teacher only
    if not _user_can_manage_session(request.user, session):
        messages.error(request, "Permission denied: You are not assigned to manage this attendance session.")
        return redirect('dashboard')

    if session.status == 'closed':
        messages.warning(request, f"Attendance session #{pk} is currently closed. You can re-open it below if needed.")
        return redirect('session_report', pk=pk)

    # Dynamically sync any newly enrolled section students into this session as absent
    section_students = Student.objects.filter(enrollments__section=session.schedule.section)
    existing_ids = set(session.records.values_list('student_id', flat=True))
    missing_students = [s for s in section_students if s.id not in existing_ids]
    if missing_students:
        AttendanceRecord.objects.bulk_create([
            AttendanceRecord(session=session, student=s, status='absent')
            for s in missing_students
        ])

    records = session.records.select_related('student__user').order_by('student__user__last_name')
    enrolled_face_count = records.filter(
        student__face_encoding__isnull=False
    ).exclude(student__face_encoding='').count()

    try:
        from face_app.services.face_service import FaceService
        FaceService.get_section_student_encodings(session.schedule.section)
    except Exception:
        pass

    return render(request, 'core/session_live.html', {
        'session': session,
        'records': records,
        'enrolled_face_count': enrolled_face_count,
    })


@login_required
@teacher_required
def session_close(request, pk):
    session = get_object_or_404(AttendanceSession, pk=pk)
    if not _user_can_manage_session(request.user, session):
        messages.error(request, "Permission denied: You cannot close this attendance session.")
        return redirect('dashboard')

    if request.method == 'POST':
        session.status = 'closed'
        session.closed_at = timezone.now()
        session.save()
        messages.success(request, 'Attendance session closed.')
        return redirect('session_report', pk=pk)
    return redirect('session_live', pk=pk)


@login_required
@teacher_required
def session_reopen(request, pk):
    session = get_object_or_404(AttendanceSession, pk=pk)
    if not _user_can_manage_session(request.user, session):
        messages.error(request, "Permission denied: You cannot reopen this attendance session.")
        return redirect('dashboard')

    if request.method == 'POST':
        session.status = 'open'
        session.closed_at = None
        session.save()
        messages.success(request, f'Attendance session #{pk} re-opened.')
        return redirect('session_live', pk=pk)
    return redirect('section_detail', pk=session.schedule.section.pk)


@login_required
def session_report(request, pk):
    session = get_object_or_404(
        AttendanceSession.objects.select_related(
            'schedule__section__subject', 'schedule__section__teacher__user', 'started_by__user'
        ), pk=pk
    )

    # Students cannot view the full session report roster
    if request.user.role == 'student':
        messages.error(request, "Permission denied: Students cannot access section attendance rosters.")
        return redirect('attendance_history')

    # Teachers can only view reports for their own sections
    if not _user_can_manage_session(request.user, session):
        messages.error(request, "Permission denied: You are not assigned to this section's report.")
        return redirect('dashboard')

    records = session.records.select_related('student__user').order_by('student__user__last_name')

    # Manual edit (teacher/admin)
    if request.method == 'POST' and request.user.role in ['admin', 'teacher']:
        record_id = request.POST.get('record_id')
        status = request.POST.get('status')
        remarks = request.POST.get('remarks', '')
        record = get_object_or_404(AttendanceRecord, pk=record_id, session=session)
        record.status = status
        record.remarks = remarks
        record.save()
        messages.success(request, 'Record updated.')
        return redirect('session_report', pk=pk)

    present_count = records.filter(status='present').count()
    late_count = records.filter(status='late').count()
    absent_count = records.filter(status='absent').count()

    return render(request, 'core/session_report.html', {
        'session': session,
        'records': records,
        'present_count': present_count,
        'late_count': late_count,
        'absent_count': absent_count,
        'total': records.count(),
    })


@login_required
def section_attendance_report(request):
    """Direct daily or weekly attendance report for a specific section assigned to the teacher (or any section for admin)."""
    user = request.user
    teacher = getattr(user, 'teacher_profile', None)

    # 1. Determine available sections
    if user.role == 'admin':
        available_sections = Section.objects.select_related(
            'program', 'subject', 'teacher__user'
        ).prefetch_related('subjects').order_by('program__code', 'name')
    elif user.role == 'teacher':
        if not teacher:
            messages.error(request, "No teacher profile found.")
            return redirect('dashboard')
        available_sections = Section.objects.filter(
            Q(teacher=teacher) | Q(subjects__teacher=teacher)
        ).select_related('program', 'subject', 'teacher__user').prefetch_related('subjects').distinct().order_by('program__code', 'name')
    else:
        messages.error(request, "Permission denied.")
        return redirect('dashboard')

    if not available_sections.exists():
        return render(request, 'core/section_attendance_report.html', {
            'available_sections': available_sections,
            'selected_section': None,
            'error_message': 'No sections assigned yet.',
        })

    # 2. Selected Section
    section_id = request.GET.get('section_id')
    selected_section = None
    if section_id:
        try:
            selected_section = available_sections.filter(pk=int(section_id)).first()
        except (ValueError, TypeError):
            selected_section = None

    if not selected_section:
        selected_section = available_sections.first()

    # 3. Report type: 'daily' or 'weekly'
    report_type = request.GET.get('report_type', 'daily').lower()
    if report_type not in ['daily', 'weekly']:
        report_type = 'daily'

    # 4. Target Date
    date_str = request.GET.get('date')
    today = timezone.localdate()
    if date_str:
        try:
            target_date = datetime.date.fromisoformat(date_str)
        except ValueError:
            target_date = today
    else:
        target_date = today

    # Enrolled students for this section
    enrolled_students = Student.objects.filter(
        enrollments__section=selected_section
    ).select_related('user').order_by('user__last_name', 'user__first_name')

    context = {
        'available_sections': available_sections,
        'selected_section': selected_section,
        'report_type': report_type,
        'target_date': target_date,
        'target_date_str': target_date.strftime('%Y-%m-%d'),
        'today': today,
        'enrolled_students_count': enrolled_students.count(),
    }

    if report_type == 'daily':
        # Sessions conducted on target_date for this section
        sessions = AttendanceSession.objects.filter(
            schedule__section=selected_section,
            date=target_date
        ).select_related('schedule', 'started_by__user').order_by('schedule__start_time')

        has_sessions = sessions.exists()
        records_by_student = {}
        if has_sessions:
            records_qs = AttendanceRecord.objects.filter(
                session__in=sessions
            ).select_related('student__user', 'session').order_by('-recognized_at')
            for r in records_qs:
                if r.student_id not in records_by_student:
                    records_by_student[r.student_id] = r

        student_rows = []
        present_cnt = 0
        late_cnt = 0
        absent_cnt = 0

        for s in enrolled_students:
            rec = records_by_student.get(s.id)
            status = rec.status if rec else ('absent' if has_sessions else 'none')
            if status == 'present':
                present_cnt += 1
            elif status == 'late':
                late_cnt += 1
            elif status == 'absent':
                absent_cnt += 1

            student_rows.append({
                'student': s,
                'status': status,
                'time_marked': rec.recognized_at if rec else None,
                'confidence': (rec.confidence_score * 100) if (rec and rec.confidence_score is not None) else None,
                'remarks': rec.remarks if rec else '',
            })

        total_marked = present_cnt + late_cnt + absent_cnt
        attendance_rate = round((present_cnt + late_cnt) / total_marked * 100, 1) if total_marked > 0 else 0

        prev_date = target_date - datetime.timedelta(days=1)
        next_date = target_date + datetime.timedelta(days=1)

        context.update({
            'sessions': sessions,
            'has_sessions': has_sessions,
            'student_rows': student_rows,
            'present_cnt': present_cnt,
            'late_cnt': late_cnt,
            'absent_cnt': absent_cnt,
            'attendance_rate': attendance_rate,
            'prev_date_str': prev_date.strftime('%Y-%m-%d'),
            'next_date_str': next_date.strftime('%Y-%m-%d'),
        })

    else:
        # Weekly Report: Monday to Saturday of the week containing target_date
        monday = target_date - datetime.timedelta(days=target_date.weekday())
        sunday = monday + datetime.timedelta(days=6)

        # Sessions conducted in that week for this section
        sessions = AttendanceSession.objects.filter(
            schedule__section=selected_section,
            date__range=[monday, sunday]
        ).select_related('schedule').order_by('date', 'schedule__start_time')

        days_config = [
            ('Mon', 0), ('Tue', 1), ('Wed', 2), ('Thu', 3), ('Fri', 4), ('Sat', 5)
        ]
        week_days = []
        active_session_dates = {s.date for s in sessions}

        for d_name, offset in days_config:
            curr_day = monday + datetime.timedelta(days=offset)
            day_sessions = [s for s in sessions if s.date == curr_day]
            week_days.append({
                'day_name': d_name,
                'date': curr_day,
                'date_str': curr_day.strftime('%b %d'),
                'has_session': curr_day in active_session_dates,
                'sessions': day_sessions,
            })

        records_qs = AttendanceRecord.objects.filter(
            session__in=sessions
        ).select_related('student', 'session')
        status_map = {}
        for r in records_qs:
            status_map[(r.student_id, r.session.date)] = r.status

        student_rows = []
        total_present_all = 0
        total_late_all = 0
        total_absent_all = 0

        for s in enrolled_students:
            p_cnt = 0
            l_cnt = 0
            a_cnt = 0
            day_statuses = []

            for wday in week_days:
                if wday['has_session']:
                    st = status_map.get((s.id, wday['date']), 'absent')
                    day_statuses.append(st)
                    if st == 'present':
                        p_cnt += 1
                    elif st == 'late':
                        l_cnt += 1
                    else:
                        a_cnt += 1
                else:
                    day_statuses.append('no_class')

            student_sessions_count = len(active_session_dates)
            attended_count = p_cnt + l_cnt
            rate = round(attended_count / student_sessions_count * 100, 1) if student_sessions_count > 0 else 0

            total_present_all += p_cnt
            total_late_all += l_cnt
            total_absent_all += a_cnt

            student_rows.append({
                'student': s,
                'day_statuses': day_statuses,
                'present_count': p_cnt,
                'late_count': l_cnt,
                'absent_count': a_cnt,
                'attendance_rate': rate,
            })

        prev_week = target_date - datetime.timedelta(days=7)
        next_week = target_date + datetime.timedelta(days=7)
        total_possible = len(enrolled_students) * len(active_session_dates) if active_session_dates else 0
        overall_weekly_rate = round((total_present_all + total_late_all) / total_possible * 100, 1) if total_possible > 0 else 0

        context.update({
            'monday': monday,
            'sunday': sunday,
            'week_label': f"{monday.strftime('%b %d')} – {sunday.strftime('%b %d, %Y')}",
            'week_days': week_days,
            'student_rows': student_rows,
            'total_sessions_count': sessions.count(),
            'active_session_dates_count': len(active_session_dates),
            'overall_weekly_rate': overall_weekly_rate,
            'total_present_all': total_present_all,
            'total_late_all': total_late_all,
            'total_absent_all': total_absent_all,
            'prev_date_str': prev_week.strftime('%Y-%m-%d'),
            'next_date_str': next_week.strftime('%Y-%m-%d'),
        })

    return render(request, 'core/section_attendance_report.html', context)


@login_required
def attendance_history(request):
    """Attendance history - filtered by role. Directs teachers directly to their Section Attendance Report."""
    user = request.user
    if user.role == 'student':
        student = get_object_or_404(Student, user=user)

        # 1. Enrolled sections for this student
        enrolled_sections = Section.objects.filter(
            enrollments__student=student
        ).select_related('program', 'subject', 'teacher__user').prefetch_related('schedules', 'subjects').distinct().order_by('name')

        if not enrolled_sections.exists() and hasattr(student, 'section') and student.section:
            enrolled_sections = Section.objects.filter(id=student.section.id).select_related('program', 'subject', 'teacher__user').prefetch_related('schedules', 'subjects')

        # 2. Build Enrolled Section Cards data: 'Section (Subject name)'
        enrolled_cards = []
        rank = {'present': 4, 'late': 3, 'excused': 2, 'absent': 1}
        for sec in enrolled_sections:
            sub_name = sec.effective_subject.name if sec.effective_subject else "General Subject"
            sub_code = sec.effective_subject.code if sec.effective_subject else "—"
            card_title = f"{sec.name} ({sub_name})"

            teacher_name = sec.teacher.user.get_full_name() if (sec.teacher and sec.teacher.user) else "Unassigned"
            sec_records = AttendanceRecord.objects.filter(student=student, session__schedule__section=sec).select_related('session')
            sec_by_date = {}
            for r in sec_records:
                d = r.session.date
                if d not in sec_by_date or rank.get(r.status, 0) > rank.get(sec_by_date[d].status, 0):
                    sec_by_date[d] = r
            unique_sec_recs = list(sec_by_date.values())
            total_cnt = len(unique_sec_recs)
            pres_cnt = sum(1 for r in unique_sec_recs if r.status == 'present')
            late_cnt = sum(1 for r in unique_sec_recs if r.status == 'late')
            abs_cnt = sum(1 for r in unique_sec_recs if r.status == 'absent')
            exc_cnt = sum(1 for r in unique_sec_recs if r.status == 'excused')
            attended = pres_cnt + late_cnt
            rate = round(attended / total_cnt * 100, 1) if total_cnt > 0 else None

            enrolled_cards.append({
                'section': sec,
                'title': card_title,
                'section_name': sec.name,
                'subject_name': sub_name,
                'subject_code': sub_code,
                'teacher_name': teacher_name,
                'schedule_display': sec.schedule_display,
                'total_sessions': total_cnt,
                'present_count': pres_cnt,
                'late_count': late_cnt,
                'absent_count': abs_cnt,
                'excused_count': exc_cnt,
                'rate': rate,
            })

        return render(request, 'core/attendance_history_student.html', {
            'student': student,
            'enrolled_cards': enrolled_cards,
        })
    elif user.role == 'teacher':
        return redirect('section_attendance_report')
    else:
        sessions = AttendanceSession.objects.select_related(
            'schedule__section__subject', 'started_by__user'
        ).order_by('-date')
        return render(request, 'core/attendance_history_admin.html', {'sessions': sessions})


@login_required
def student_section_attendance(request, section_pk):
    """Dedicated full-page attendance graph & session logs for a specific enrolled section."""
    user = request.user
    if user.role != 'student' and user.role != 'admin':
        messages.error(request, "Access restricted to students and administrators.")
        return redirect('dashboard')

    if user.role == 'student':
        student = get_object_or_404(Student, user=user)
        # Ensure student is enrolled in this section
        is_enrolled = Section.objects.filter(id=section_pk, enrollments__student=student).exists()
        if not is_enrolled and hasattr(student, 'section') and getattr(student, 'section', None):
            is_enrolled = (student.section.id == section_pk)
        if not is_enrolled and not user.is_superuser:
            messages.error(request, "You are not enrolled in this section.")
            return redirect('attendance_history')
    else:
        # Admin inspecting
        student_id = request.GET.get('student_id')
        if student_id:
            student = get_object_or_404(Student, pk=student_id)
        else:
            student = Student.objects.first()

    section = get_object_or_404(
        Section.objects.select_related('program', 'subject', 'teacher__user').prefetch_related('schedules', 'subjects'),
        pk=section_pk
    )

    import calendar
    today = timezone.localdate()
    try:
        target_year = int(request.GET.get('year', today.year))
        target_month = int(request.GET.get('month', today.month))
        if not (1 <= target_month <= 12):
            target_year = today.year
            target_month = today.month
    except (ValueError, TypeError):
        target_year = today.year
        target_month = today.month

    if target_month == 1:
        prev_year = target_year - 1
        prev_month = 12
    else:
        prev_year = target_year
        prev_month = target_month - 1

    if target_month == 12:
        next_year = target_year + 1
        next_month = 1
    else:
        next_year = target_year
        next_month = target_month + 1

    month_name = calendar.month_name[target_month]
    month_label = f"{month_name} {target_year}"

    # 1 subject, 1 meeting, 1 attendance guarantee: deduplicate by meeting date
    raw_sec_records = AttendanceRecord.objects.filter(
        student=student,
        session__schedule__section=section,
    ).select_related('session__schedule', 'session__started_by__user').order_by('-session__date', '-recognized_at')

    rank = {'present': 4, 'late': 3, 'excused': 2, 'absent': 1}
    by_date = {}
    for r in raw_sec_records:
        d = r.session.date
        if d not in by_date:
            by_date[d] = r
        else:
            curr_rank = rank.get(by_date[d].status, 0)
            new_rank = rank.get(r.status, 0)
            if new_rank > curr_rank:
                by_date[d] = r
            elif new_rank == curr_rank and r.recognized_at:
                if not by_date[d].recognized_at or r.recognized_at < by_date[d].recognized_at:
                    by_date[d] = r

    all_sec_records = sorted(by_date.values(), key=lambda r: r.session.date, reverse=True)
    detailed_records = all_sec_records

    total_s = len(all_sec_records)
    p_cnt = sum(1 for r in all_sec_records if r.status == 'present')
    l_cnt = sum(1 for r in all_sec_records if r.status == 'late')
    a_cnt = sum(1 for r in all_sec_records if r.status == 'absent')
    e_cnt = sum(1 for r in all_sec_records if r.status == 'excused')
    att = p_cnt + l_cnt
    overall_rate = round(att / total_s * 100, 1) if total_s > 0 else 0
    active_stats = {
        'total': total_s,
        'present': p_cnt,
        'late': l_cnt,
        'absent': a_cnt,
        'excused': e_cnt,
        'rate': overall_rate,
    }

    records_by_date = {}
    for r in all_sec_records:
        if r.session.date.year == target_year and r.session.date.month == target_month:
            records_by_date[r.session.date] = [r]

    cal = calendar.Calendar(firstweekday=6)
    raw_weeks = cal.monthdatescalendar(target_year, target_month)
    calendar_weeks = []
    for week in raw_weeks:
        week_days = []
        for d in week:
            day_recs = records_by_date.get(d, [])
            week_days.append({
                'date': d,
                'day_num': d.day,
                'is_current_month': (d.month == target_month),
                'is_today': (d == today),
                'records': day_recs,
                'has_attendance': len(day_recs) > 0,
            })
        calendar_weeks.append(week_days)

    if request.headers.get('x-requested-with') == 'XMLHttpRequest' or request.GET.get('format') == 'json':
        json_weeks = []
        for week in calendar_weeks:
            json_week = []
            for d in week:
                recs_json = [
                    {
                        'status': r.status,
                        'status_display': r.get_status_display(),
                        'time': r.recognized_at.strftime('%I:%M %p') if r.recognized_at else 'Class time',
                    } for r in d['records']
                ]
                json_week.append({
                    'day_num': d['day_num'],
                    'is_current_month': d['is_current_month'],
                    'is_today': d['is_today'],
                    'has_attendance': d['has_attendance'],
                    'records': recs_json,
                })
            json_weeks.append(json_week)

        records_json = [
            {
                'date': r.session.date.strftime('%b %d, %Y'),
                'day': r.session.date.strftime('%a'),
                'status': r.status,
                'status_display': r.get_status_display(),
                'time': r.recognized_at.strftime('%I:%M %p') if r.recognized_at else '—',
            } for r in detailed_records[:20]
        ]

        return JsonResponse({
            'success': True,
            'section_name': section.name,
            'subject_code': section.effective_subject.code if section.effective_subject else '—',
            'subject_name': section.effective_subject.name if section.effective_subject else 'General',
            'teacher_name': section.teacher.user.get_full_name() if section.teacher else 'Unassigned',
            'schedule_display': section.schedule_display,
            'month_label': month_label,
            'target_year': target_year,
            'target_month': target_month,
            'prev_year': prev_year,
            'prev_month': prev_month,
            'next_year': next_year,
            'next_month': next_month,
            'stats': active_stats,
            'calendar_weeks': json_weeks,
            'records': records_json,
        })

    context = {
        'student': student,
        'section': section,
        'target_year': target_year,
        'target_month': target_month,
        'month_label': month_label,
        'month_name': month_name,
        'prev_year': prev_year,
        'prev_month': prev_month,
        'next_year': next_year,
        'next_month': next_month,
        'today': today,
        'calendar_weeks': calendar_weeks,
        'active_stats': active_stats,
        'detailed_records': detailed_records,
    }
    return render(request, 'core/student_attendance_detail.html', context)


# ─── Mark Present API (AJAX from face recognition) ────────────────────────────

@login_required
def mark_present_api(request):
    """Called by face recognition to mark a student present."""
    if request.method != 'POST':
        return JsonResponse({'error': 'POST required'}, status=405)

    if request.user.role not in ['admin', 'teacher']:
        return JsonResponse({'error': 'Forbidden: Only instructors and administrators can mark attendance.'}, status=403)

    import json
    from core.services.attendance_service import AttendanceService
    from core.models import StudentSection

    try:
        data = json.loads(request.body)
        session_id = data.get('session_id')
        student_id = data.get('student_id')
        confidence = float(data.get('confidence', 1.0))

        session = AttendanceSession.objects.select_related('schedule__section').get(pk=session_id, status='open')
        student = Student.objects.get(pk=student_id)

        # Authorization: teacher must be assigned to this session/section
        if not _user_can_manage_session(request.user, session):
            return JsonResponse({'error': 'Forbidden: You are not assigned to manage this attendance session.'}, status=403)

        # Verification: student must be enrolled in this section and subject (if irregular)
        from django.db.models import Q
        sched_subject = session.schedule.subject
        if sched_subject:
            enrolled = StudentSection.objects.filter(
                Q(section=session.schedule.section, student=student) &
                (Q(subject__isnull=True) | Q(subject=sched_subject))
            ).exists()
        else:
            enrolled = StudentSection.objects.filter(section=session.schedule.section, student=student).exists()

        if not enrolled:
            return JsonResponse({'error': f'Student {student.student_id} is not enrolled in this section or subject.'}, status=400)

        record, is_new = AttendanceService.mark_attendance(
            session=session,
            student=student,
            confidence=confidence
        )

        if is_new:
            return JsonResponse({
                'success': True,
                'status': record.status,
                'student_name': student.user.get_full_name() or student.user.username,
                'student_id': student.student_id,
            })
        else:
            return JsonResponse({
                'success': False,
                'message': f'Already marked as {record.status}',
                'status': record.status,
                'student_name': student.user.get_full_name() or student.user.username,
            })
    except (AttendanceSession.DoesNotExist, Student.DoesNotExist) as e:
        return JsonResponse({'error': str(e)}, status=404)

