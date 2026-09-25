"""
Attendance Service
Handles business logic for attendance sessions and records.
Extracted from api_views.py (AttendanceSessionStartAPIView, ManualAttendanceMarkAPIView,
StudentAttendanceOverviewAPIView, StudentSectionCalendarAPIView).
"""
import calendar as cal_module
from django.db import transaction
from django.db.models import Q
from django.utils import timezone

from core.models import (
    Schedule, Section, AttendanceSession, AttendanceRecord, StudentSection, Student
)


# ── Time Formatting Helper ───────────────────────────────────────────────────

def _fmt_time_12h(t):
    """Format a time object as 12-hour AM/PM string."""
    h = t.hour % 12 or 12
    period = 'AM' if t.hour < 12 else 'PM'
    return f"{h}:{t.minute:02d} {period}"


# ── Attendance Session Service ───────────────────────────────────────────────

class AttendanceService:

    @staticmethod
    def verify_teacher_assignment(teacher, schedule):
        """Returns True if teacher is assigned to the schedule, False otherwise."""
        return (
            (schedule.subject and schedule.subject.teacher == teacher) or
            (schedule.section.teacher == teacher) or
            schedule.section.subjects.filter(teacher=teacher).exists()
        )

    @staticmethod
    def validate_schedule_time_window(schedule):
        """
        Validates that the current time falls within the schedule's class window.
        Returns an error message string if outside the window, or None if allowed.
        """
        today = timezone.localdate()
        now_time = timezone.localtime(timezone.now()).time()
        sched_start = schedule.start_time
        sched_end = schedule.end_time

        weekday_map = {0: 'Mon', 1: 'Tue', 2: 'Wed', 3: 'Thu', 4: 'Fri', 5: 'Sat', 6: 'Sun'}
        today_code = weekday_map.get(today.weekday(), '')
        meeting_days = schedule.meeting_days if hasattr(schedule, 'meeting_days') else [schedule.day_of_week]

        if today_code not in meeting_days:
            day_names = ' & '.join(
                schedule.full_days_display.split(' & ')
                if hasattr(schedule, 'full_days_display')
                else meeting_days
            )
            return f"Attendance cannot be started today. This class only meets on {day_names}."

        if now_time < sched_start:
            return (
                f"It's too early to start attendance. "
                f"Your class schedule begins at {_fmt_time_12h(sched_start)}. "
                f"Please wait until the class starts."
            )

        if now_time > sched_end:
            return (
                f"Attendance cannot be started. Your class schedule already ended at {_fmt_time_12h(sched_end)}. "
                f"The window for taking attendance has passed."
            )

        return None  # All good

    @staticmethod
    @transaction.atomic
    def start_session(schedule, teacher=None):
        """
        Creates a new attendance session for today and pre-populates absent records.
        Returns (session, created=True).
        """
        today = timezone.localdate()
        session = AttendanceSession.objects.create(
            schedule=schedule,
            date=today,
            started_by=teacher,
            status='open',
        )

        # FSUU Butuan irregular student logic:
        # Regular block students (subject is null) take all subjects in section.
        # Irregular students (subject matches) take only that specific subject.
        if schedule.subject:
            enrollments = StudentSection.objects.filter(
                Q(section=schedule.section) & (Q(subject__isnull=True) | Q(subject=schedule.subject))
            ).select_related('student').distinct()
        else:
            enrollments = StudentSection.objects.filter(
                section=schedule.section
            ).select_related('student')

        seen = set()
        records = []
        for e in enrollments:
            if e.student_id not in seen:
                seen.add(e.student_id)
                records.append(AttendanceRecord(session=session, student=e.student, status='absent'))
        AttendanceRecord.objects.bulk_create(records)

        return session

    @staticmethod
    def close_session(session):
        """Closes an attendance session."""
        session.status = 'closed'
        session.closed_at = timezone.now()
        session.save(update_fields=['status', 'closed_at'])
        return session

    @staticmethod
    def reopen_session(session):
        """Reopens a closed attendance session."""
        session.status = 'open'
        session.closed_at = None
        session.save(update_fields=['status', 'closed_at'])
        return session

    @staticmethod
    def mark_manual(session, student, status_val):
        """
        Manually marks or updates an attendance record for a student.
        Returns the AttendanceRecord.
        """
        record, _ = AttendanceRecord.objects.get_or_create(
            session=session,
            student=student,
            defaults={'status': status_val},
        )
        record.status = status_val
        if status_val in ['present', 'late']:
            record.recognized_at = timezone.now()
        record.save()
        return record

    @classmethod
    def get_student_overview(cls, student):
        return AttendanceReportService.get_student_overview(student)

    @classmethod
    def get_student_section_calendar(cls, student, section, target_year, target_month):
        return AttendanceReportService.get_student_section_calendar(student, section, target_year, target_month)




# ── Report Service ───────────────────────────────────────────────────────────

class AttendanceReportService:

    STATUS_RANK = {'present': 4, 'late': 3, 'excused': 2, 'absent': 1}

    @classmethod
    def _deduplicate_by_date(cls, records):
        """Deduplicate attendance records by date, keeping the highest-ranked status."""
        by_date = {}
        for r in records:
            d = r.session.date
            if d not in by_date or cls.STATUS_RANK.get(r.status, 0) > cls.STATUS_RANK.get(by_date[d].status, 0):
                by_date[d] = r
        return sorted(by_date.values(), key=lambda r: r.session.date, reverse=True)

    @classmethod
    def get_student_overview(cls, student):
        """
        Returns the full student attendance overview dict used by the API.
        """
        enrolled_sections = Section.objects.filter(
            enrollments__student=student
        ).select_related('program', 'subject', 'teacher__user').prefetch_related(
            'schedules', 'subjects'
        ).distinct().order_by('name')

        if not enrolled_sections.exists() and hasattr(student, 'section') and student.section:
            enrolled_sections = Section.objects.filter(
                id=student.section.id
            ).select_related('program', 'subject', 'teacher__user').prefetch_related('schedules', 'subjects')

        enrolled_cards = []
        total_present_all = total_late_all = total_absent_all = total_excused_all = total_sessions_all = 0

        for sec in enrolled_sections:
            sub_name = sec.effective_subject.name if sec.effective_subject else "General Subject"
            sub_code = sec.effective_subject.code if sec.effective_subject else "—"
            teacher_name = sec.teacher.user.get_full_name() if (sec.teacher and sec.teacher.user) else "Unassigned"

            raw_recs = AttendanceRecord.objects.filter(
                student=student, session__schedule__section=sec
            ).select_related('session').order_by('-session__date')

            unique_recs = cls._deduplicate_by_date(raw_recs)
            total_cnt = len(unique_recs)
            pres_cnt = sum(1 for r in unique_recs if r.status == 'present')
            late_cnt = sum(1 for r in unique_recs if r.status == 'late')
            abs_cnt = sum(1 for r in unique_recs if r.status == 'absent')
            exc_cnt = sum(1 for r in unique_recs if r.status == 'excused')
            attended = pres_cnt + late_cnt
            rate = round(attended / total_cnt * 100, 1) if total_cnt > 0 else None

            last_rec = unique_recs[0] if unique_recs else None

            total_present_all += pres_cnt
            total_late_all += late_cnt
            total_absent_all += abs_cnt
            total_excused_all += exc_cnt
            total_sessions_all += total_cnt

            enrolled_cards.append({
                'section_id': sec.id,
                'title': f"{sec.name} ({sub_name})",
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
                'last_date': last_rec.session.date.strftime('%b %d, %Y') if last_rec else None,
                'last_status': last_rec.status if last_rec else None,
            })

        overall_attended = total_present_all + total_late_all
        overall_rate = round(overall_attended / total_sessions_all * 100, 1) if total_sessions_all > 0 else 0

        # Recent 25 records
        recent_records = []
        raw_recs_recent = AttendanceRecord.objects.filter(
            student=student
        ).select_related(
            'session__schedule__section__subject',
            'session__schedule__section',
        ).order_by('-session__date', '-recognized_at')[:25]

        for r in raw_recs_recent:
            sec_obj = r.session.schedule.section if (r.session and r.session.schedule) else None
            eff_sub = sec_obj.effective_subject if sec_obj else None
            recent_records.append({
                'id': r.id,
                'date': r.session.date.strftime('%b %d, %Y'),
                'subject_code': eff_sub.code if eff_sub else '—',
                'subject_name': eff_sub.name if eff_sub else 'General',
                'section_name': sec_obj.name if sec_obj else '—',
                'status': r.status,
                'status_display': r.get_status_display(),
                'time': r.recognized_at.strftime('%I:%M:%S %p') if r.recognized_at else '—',
            })

        return {
            'student': {
                'id': student.id,
                'full_name': student.user.get_full_name() or student.user.username,
                'username': student.user.username,
                'student_id': student.student_id,
                'course': student.course,
                'year_level': student.year_level,
                'is_face_enrolled': student.is_face_enrolled,
                'face_enrolled_at': student.face_enrolled_at.isoformat() if student.face_enrolled_at else None,
                'profile_image': student.user.profile_image.url if student.user.profile_image else None,
            },
            'overall_stats': {
                'rate': overall_rate,
                'total_sessions': total_sessions_all,
                'present': total_present_all,
                'late': total_late_all,
                'absent': total_absent_all,
                'excused': total_excused_all,
            },
            'enrolled_cards': enrolled_cards,
            'recent_records': recent_records,
        }

    @classmethod
    def get_student_section_calendar(cls, student, section, target_year, target_month):
        """
        Returns calendar view + stats for a student in a given section and month.
        """
        today = timezone.localdate()

        # Previous / next month navigation
        if target_month == 1:
            prev_year, prev_month = target_year - 1, 12
        else:
            prev_year, prev_month = target_year, target_month - 1

        if target_month == 12:
            next_year, next_month = target_year + 1, 1
        else:
            next_year, next_month = target_year, target_month + 1

        month_label = f"{cal_module.month_name[target_month]} {target_year}"

        raw_recs = AttendanceRecord.objects.filter(
            student=student,
            session__schedule__section=section,
        ).select_related('session__schedule', 'session__started_by__user').order_by(
            '-session__date', '-recognized_at'
        )

        all_sec_records = cls._deduplicate_by_date(raw_recs)

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
                d_key = r.session.date
                records_by_date.setdefault(d_key, []).append(r)

        calendar_obj = cal_module.Calendar(firstweekday=6)
        raw_weeks = calendar_obj.monthdatescalendar(target_year, target_month)
        json_weeks = []
        for week in raw_weeks:
            json_week = []
            for d in week:
                day_recs = records_by_date.get(d, [])
                recs_json = [
                    {
                        'status': r.status,
                        'status_display': r.get_status_display(),
                        'time': r.recognized_at.strftime('%I:%M %p') if r.recognized_at else 'Class time',
                        'raw_time': r.recognized_at.strftime('%I:%M:%S %p') if r.recognized_at else '',
                    }
                    for r in day_recs
                ]
                json_week.append({
                    'date': d.isoformat(),
                    'day_num': d.day,
                    'is_current_month': (d.month == target_month),
                    'is_today': (d == today),
                    'has_attendance': len(day_recs) > 0,
                    'records': recs_json,
                })
            json_weeks.append(json_week)

        records_json = [
            {
                'id': r.id,
                'date': r.session.date.strftime('%b %d, %Y'),
                'day': r.session.date.strftime('%a'),
                'status': r.status,
                'status_display': r.get_status_display(),
                'time': r.recognized_at.strftime('%I:%M:%S %p') if r.recognized_at else 'Class time',
                'raw_date': r.session.date.isoformat(),
            }
            for r in all_sec_records
        ]

        eff_sub = section.effective_subject
        return {
            'success': True,
            'student_name': student.user.get_full_name() or student.user.username,
            'student_id': student.student_id,
            'section_name': section.name,
            'subject_code': eff_sub.code if eff_sub else '—',
            'subject_name': eff_sub.name if eff_sub else 'General',
            'teacher_name': section.teacher.user.get_full_name() if (section.teacher and section.teacher.user) else 'Unassigned',
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
            'session_logs': records_json,
            'records': records_json,
        }
