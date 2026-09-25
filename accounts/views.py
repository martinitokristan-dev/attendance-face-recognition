from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth import login, logout
from django.contrib.auth.decorators import login_required
from django.contrib import messages
from django.db import transaction
from django.urls import reverse
from .forms import (
    LoginForm, AdminUserCreateForm, TeacherProfileForm,
    UserEditForm, StudentRegisterForm
)
from .models import CustomUser, Teacher, Student
from .decorators import admin_required


def login_view(request):
    """Custom login with role-based redirect."""
    if request.user.is_authenticated:
        return redirect('dashboard')

    form = LoginForm(request, data=request.POST or None)
    if request.method == 'POST':
        if form.is_valid():
            user = form.get_user()
            login(request, user)
            messages.success(request, f'Welcome back, {user.get_full_name() or user.username}!')
            return redirect('dashboard')
        # Do not add messages.error; form.errors/non_field_errors already renders the message clearly

    return render(request, 'accounts/login.html', {'form': form})


@login_required
def logout_view(request):
    logout(request)
    messages.info(request, 'You have been logged out.')
    return redirect('login')


@login_required
def dashboard_view(request):
    """Route to role-specific dashboard."""
    user = request.user
    context = {'user': user}

    if user.role == 'admin':
        from core.models import Subject, Section, Schedule, AttendanceSession
        from django.utils import timezone
        from django.db.models import Q

        today = timezone.localdate()
        context['total_teachers'] = Teacher.objects.count()
        context['total_students'] = Student.objects.count()
        context['total_subjects'] = Subject.objects.count()
        context['total_sections'] = Section.objects.count()
        context['open_sessions_count'] = AttendanceSession.objects.filter(status='open').count()
        context['sessions_today_count'] = AttendanceSession.objects.filter(date=today).count()
        context['sessions_today_closed'] = AttendanceSession.objects.filter(
            date=today, status='closed'
        ).count()
        face_enrolled = Student.objects.exclude(
            Q(face_encoding__isnull=True) | Q(face_encoding='')
        ).count()
        context['face_enrolled_count'] = face_enrolled
        total_st = context['total_students']
        context['face_enrollment_pct'] = round(face_enrolled / total_st * 100, 1) if total_st else 0
        context['recent_sessions'] = AttendanceSession.objects.select_related(
            'schedule__section__subject', 'started_by__user'
        ).order_by('-date', '-created_at')[:8]
        context['today'] = today
        return render(request, 'accounts/dashboard_admin.html', context)

    elif user.role == 'teacher':
        try:
            teacher = user.teacher_profile
            from core.models import Section, AttendanceSession, StudentSection, Schedule
            from django.db.models import Q

            sections = Section.objects.filter(
                Q(teacher=teacher) | Q(subjects__teacher=teacher)
            ).select_related('program', 'subject', 'teacher__user').prefetch_related(
                'schedules', 'enrollments__student__user', 'subjects'
            ).distinct().order_by('program__code', 'name')

            recent_sessions = AttendanceSession.objects.filter(
                Q(started_by=teacher) | Q(schedule__section__in=sections)
            ).select_related('schedule__section__subject', 'schedule__section__program').distinct().order_by('-date', '-created_at')[:8]

            total_students = StudentSection.objects.filter(section__in=sections).values('student_id').distinct().count()
            total_schedules = Schedule.objects.filter(section__in=sections).count()
            open_sessions_count = AttendanceSession.objects.filter(
                Q(started_by=teacher) | Q(schedule__section__in=sections),
                status='open'
            ).distinct().count()

            context['teacher'] = teacher
            context['sections'] = sections
            context['recent_sessions'] = recent_sessions
            context['total_students'] = total_students
            context['total_schedules'] = total_schedules
            context['open_sessions_count'] = open_sessions_count

            from core.session_helpers import attach_today_sessions
            from django.utils import timezone
            today = timezone.localdate()
            attach_today_sessions(sections, today)
            context['attendance_today'] = today

            from core.session_helpers import schedules_meeting_today
            context['today_schedule_items'] = schedules_meeting_today(sections, today)

            today_sessions = AttendanceSession.objects.filter(
                Q(started_by=teacher) | Q(schedule__section__in=sections),
                date=today,
            ).select_related('schedule__section__subject').distinct().order_by('-created_at')
            context['today_class_sessions'] = today_sessions

            finalized_today = today_sessions.filter(status='closed').count()
            context['finalized_today_count'] = finalized_today
            context['open_today_sessions'] = today_sessions.filter(status='open')
            not_enrolled_face = StudentSection.objects.filter(
                section__in=sections,
            ).filter(
                Q(student__face_encoding__isnull=True) | Q(student__face_encoding='')
            ).values('student_id').distinct().count()
            context['students_need_face_count'] = not_enrolled_face
        except Teacher.DoesNotExist:
            messages.warning(request, 'Teacher profile not set up. Contact admin.')
            context['teacher'] = None
        return render(request, 'accounts/dashboard_teacher.html', context)

    elif user.role == 'student':
        try:
            student = user.student_profile
            from core.models import AttendanceRecord, Section
            from core.models import AttendanceSession
            from django.db.models import Count, Q

            records_qs = AttendanceRecord.objects.filter(
                student=student
            ).select_related(
                'session__schedule__section__subject',
                'session__schedule__section__program',
            ).order_by('-session__date')
            records = records_qs[:15]

            section = student.section if hasattr(student, 'section') else None
            enrolled_sections = Section.objects.filter(
                enrollments__student=student
            ).select_related('program', 'subject', 'teacher__user').prefetch_related('schedules', 'subjects').distinct()

            from core.services import TimetableService
            timetable_data = TimetableService.build_timetable_data(enrolled_sections)

            totals = records_qs.aggregate(
                present=Count('id', filter=Q(status='present')),
                late=Count('id', filter=Q(status='late')),
                absent=Count('id', filter=Q(status='absent')),
                excused=Count('id', filter=Q(status='excused')),
            )
            attended = (totals['present'] or 0) + (totals['late'] or 0)
            total_logged = records_qs.count()
            overall_rate = round(attended / total_logged * 100, 1) if total_logged else 0

            section_summaries = []
            for sec in enrolled_sections:
                sec_records = records_qs.filter(session__schedule__section=sec)
                sec_total = sec_records.count()
                sec_present = sec_records.filter(status='present').count()
                sec_late = sec_records.filter(status='late').count()
                sec_absent = sec_records.filter(status='absent').count()
                sec_attended = sec_present + sec_late
                sec_rate = round(sec_attended / sec_total * 100, 1) if sec_total else None
                last_rec = sec_records.first()
                section_summaries.append({
                    'section': sec,
                    'total_sessions': sec_total,
                    'present': sec_present,
                    'late': sec_late,
                    'absent': sec_absent,
                    'rate': sec_rate,
                    'last_date': last_rec.session.date if last_rec else None,
                    'last_status': last_rec.status if last_rec else None,
                })

            context['student'] = student
            context['records'] = records
            context['section'] = section
            context['enrolled_sections'] = enrolled_sections
            context['timetable'] = timetable_data
            context['attendance_totals'] = totals
            context['overall_rate'] = overall_rate
            context['total_logged'] = total_logged
            context['section_summaries'] = section_summaries
            context['upcoming_sessions'] = AttendanceSession.objects.filter(
                schedule__section__in=enrolled_sections,
                status='closed',
            ).select_related('schedule__section__subject').order_by('-date')[:5]
        except Student.DoesNotExist:
            messages.warning(request, 'Student profile not set up. Contact admin.')
        return render(request, 'accounts/dashboard_student.html', context)

    return redirect('login')


# ─── Admin: User Management ────────────────────────────────────────────────────

@login_required
@admin_required
def user_list_view(request):
    role_filter = request.GET.get('role', '').strip().lower()
    search_query = request.GET.get('q', '').strip()

    qs = CustomUser.objects.select_related('teacher_profile', 'student_profile').all()

    if role_filter in ['admin', 'teacher', 'student']:
        qs = qs.filter(role=role_filter)

    if search_query:
        from django.db.models import Q
        qs = qs.filter(
            Q(username__icontains=search_query) |
            Q(first_name__icontains=search_query) |
            Q(last_name__icontains=search_query) |
            Q(email__icontains=search_query) |
            Q(student_profile__student_id__icontains=search_query) |
            Q(teacher_profile__employee_id__icontains=search_query)
        )

    users = qs.order_by('role', 'last_name', 'first_name', 'username')

    counts = {
        'all': CustomUser.objects.count(),
        'student': CustomUser.objects.filter(role='student').count(),
        'teacher': CustomUser.objects.filter(role='teacher').count(),
        'admin': CustomUser.objects.filter(role='admin').count(),
    }

    return render(request, 'accounts/user_list.html', {
        'users': users,
        'selected_role': role_filter,
        'search_query': search_query,
        'counts': counts,
        'user_form': AdminUserCreateForm(),
        'teacher_form': TeacherProfileForm(),
    })


@login_required
@admin_required
def user_create_view(request):
    user_form = AdminUserCreateForm(request.POST or None)
    teacher_form = TeacherProfileForm(request.POST or None)

    if request.method == 'POST':
        role = request.POST.get('role', 'teacher')
        user_form = AdminUserCreateForm(request.POST)

        if user_form.is_valid():
            with transaction.atomic():
                user = user_form.save()
                if role == 'teacher':
                    t_form = TeacherProfileForm(request.POST)
                    if t_form.is_valid():
                        teacher = t_form.save(commit=False)
                        teacher.user = user
                        teacher.save()
                messages.success(request, f'{user.get_role_display()} "{user.get_full_name() or user.username}" created successfully.')
                return redirect('user_list')
        else:
            messages.error(request, 'Please fix the errors below.')

    return render(request, 'accounts/user_create.html', {
        'user_form': user_form,
        'teacher_form': teacher_form,
    })


@login_required
def student_register_view(request):
    """
    Streamlined student registration flow accessible to Admin & Teachers.
    Creates user, creates student profile, assigns to section, and immediately
    redirects to face enrollment.
    """
    if request.user.role != 'admin':
        messages.error(request, "Permission denied: Only administrators can register students.")
        return redirect('dashboard')

    initial_data = {}
    section_id = request.GET.get('section_id')
    if section_id:
        initial_data['section'] = section_id

    form = StudentRegisterForm(user=request.user, data=request.POST or None, initial=initial_data)

    if request.method == 'POST' and form.is_valid():
        from core.models import StudentSection
        from face_app.services.face_service import FaceService

        cd = form.cleaned_data
        student_id = cd['student_id']
        first_name = cd['first_name']
        last_name = cd['last_name']
        email = cd['email'] or f"{student_id.lower().replace('-', '')}@attendfr.edu"
        course = cd['course']
        year_level = cd['year_level']
        section = cd.get('section')
        password = cd['password'] or 'student123'

        from accounts.username_utils import username_from_student_id
        username = username_from_student_id(student_id)

        with transaction.atomic():
            user = CustomUser.objects.create_user(
                username=username,
                email=email,
                password=password,
                first_name=first_name,
                last_name=last_name,
                role='student'
            )
            student = Student.objects.create(
                user=user,
                student_id=student_id,
                course=course,
                year_level=year_level
            )
            if section:
                StudentSection.objects.get_or_create(student=student, section=section)
                FaceService.invalidate_cache(section.pk)

        messages.success(
            request,
            f'Student {student_id} ({first_name} {last_name}) registered successfully! Capture face now to activate biometric attendance.'
        )
        return redirect(f"{reverse('enroll_face')}?student_id={student.pk}")

    return render(request, 'accounts/student_register.html', {
        'form': form,
        'section_id': section_id,
    })


@login_required
@admin_required
def user_edit_view(request, pk):
    target_user = get_object_or_404(CustomUser, pk=pk)
    form = UserEditForm(request.POST or None, request.FILES or None, instance=target_user)
    if request.method == 'POST' and form.is_valid():
        form.save()
        messages.success(request, 'User updated successfully.')
        return redirect('user_list')
    return render(request, 'accounts/user_edit.html', {'form': form, 'target_user': target_user})


@login_required
@admin_required
def user_delete_view(request, pk):
    target_user = get_object_or_404(CustomUser, pk=pk)
    if request.method == 'POST':
        name = target_user.get_full_name() or target_user.username
        target_user.delete()
        messages.success(request, f'User "{name}" deleted.')
        return redirect('user_list')
    return render(request, 'accounts/user_confirm_delete.html', {'target_user': target_user})


@login_required
def profile_view(request):
    form = UserEditForm(request.POST or None, request.FILES or None, instance=request.user)
    if request.method == 'POST' and form.is_valid():
        form.save()
        messages.success(request, 'Profile updated successfully.')
        return redirect('profile')
    return render(request, 'accounts/profile.html', {'form': form})
