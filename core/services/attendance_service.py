"""
Attendance Service: Handles session management, dynamic late status calculation,
and attendance recording.
"""
from django.conf import settings
from django.utils import timezone
from core.models import AttendanceRecord, StudentSection


class AttendanceService:
    @staticmethod
    def get_late_threshold_minutes():
        """Retrieve late threshold minutes from settings or env (default: 15 mins)."""
        return getattr(settings, 'LATE_THRESHOLD_MINUTES', 15)

    @staticmethod
    def calculate_attendance_status(session, scan_time=None):
        """
        Dynamically determine whether the attendance is 'present' or 'late'.
        When live scanning from camera (scan_time is None), an open session marks as 'present'.
        When a specific scan_time is provided (e.g. historical checks/tests), computes against schedule start_time.
        """
        if scan_time is None:
            return 'present'

        threshold_seconds = AttendanceService.get_late_threshold_minutes() * 60

        # If session was opened recently (within threshold minutes), always count as present
        if session.created_at:
            since_opened = (scan_time - session.created_at).total_seconds()
            if 0 <= since_opened <= threshold_seconds:
                return 'present'

        # Combine session date with schedule start_time
        schedule = session.schedule
        session_start_dt = timezone.make_aware(
            timezone.datetime.combine(session.date, schedule.start_time)
        )
        time_difference = (scan_time - session_start_dt).total_seconds()

        if time_difference > threshold_seconds:
            return 'late'
        return 'present'

    @staticmethod
    def mark_attendance(session, student, confidence=1.0, scan_time=None):
        """
        Marks attendance for a student in an open session.
        If already present/late, updates confidence if better or preserves original scan time.
        """
        if scan_time is None:
            scan_time = timezone.now()

        record, created = AttendanceRecord.objects.get_or_create(
            session=session,
            student=student,
            defaults={'status': 'absent'}
        )

        # If previously absent or newly created, determine status
        is_first_mark = (record.status == 'absent')
        if is_first_mark:
            status = AttendanceService.calculate_attendance_status(session, scan_time)
            record.status = status
            record.recognized_at = scan_time
            record.confidence_score = round(confidence, 4)
            record.save()
            return record, True

        return record, False

    @staticmethod
    def get_session_summary(session):
        """Returns statistics for a given attendance session."""
        records = session.records.all()
        total_enrolled = StudentSection.objects.filter(section=session.schedule.section).count()

        present_count = records.filter(status='present').count()
        late_count = records.filter(status='late').count()
        excused_count = records.filter(status='excused').count()
        absent_count = max(0, total_enrolled - (present_count + late_count + excused_count))

        attended = present_count + late_count
        attendance_rate = round((attended / total_enrolled * 100), 1) if total_enrolled > 0 else 0.0

        return {
            'total_enrolled': total_enrolled,
            'present': present_count,
            'late': late_count,
            'absent': absent_count,
            'excused': excused_count,
            'attendance_rate': attendance_rate,
        }
