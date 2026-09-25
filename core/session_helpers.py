"""Helpers for live attendance session state (per schedule / day)."""
from django.utils import timezone

from core.models import AttendanceSession, Schedule

WEEKDAY_TO_SCHED_DAY = {
    0: 'Mon',
    1: 'Tue',
    2: 'Wed',
    3: 'Thu',
    4: 'Fri',
    5: 'Sat',
    6: 'Sun',
}


def attach_today_sessions(sections, today=None):
    """
    Attach `today_session` on each schedule under the given sections (in memory).
    Returns dict schedule_id -> AttendanceSession for templates that need direct lookup.
    """
    today = today or timezone.localdate()
    section_list = list(sections)
    if not section_list:
        return {}

    schedule_ids = Schedule.objects.filter(section__in=section_list).values_list('pk', flat=True)
    sessions = AttendanceSession.objects.filter(
        schedule_id__in=schedule_ids,
        date=today,
    ).select_related('schedule')

    by_schedule = {}
    for session in sessions:
        existing = by_schedule.get(session.schedule_id)
        if not existing or session.created_at > existing.created_at:
            by_schedule[session.schedule_id] = session

    for section in section_list:
        section_schedules = list(section.schedules.all())
        active_sched = None
        for sched in section_schedules:
            sched.today_session = by_schedule.get(sched.pk)
            sched.meets_today = schedule_meets_on_date(sched, today)
            if sched.today_session and (not active_sched or sched.today_session.status == 'open'):
                active_sched = sched
            elif not active_sched and sched.meets_today:
                active_sched = sched
        if not active_sched and section_schedules:
            active_sched = section_schedules[0]
        section.primary_schedule = active_sched

    return by_schedule


def schedule_meets_on_date(schedule, on_date=None):
    """True if this schedule normally meets on the given calendar date."""
    on_date = on_date or timezone.localdate()
    if schedule.effective_from and on_date < schedule.effective_from:
        return False
    if schedule.effective_to and on_date > schedule.effective_to:
        return False
    day_code = WEEKDAY_TO_SCHED_DAY.get(on_date.weekday())
    return day_code in schedule.meeting_days


def today_session_for_schedule(schedule):
    """Return today's AttendanceSession for this schedule, if attached or None."""
    return getattr(schedule, 'today_session', None)


def schedules_meeting_today(sections, today=None):
    """Flat list of (schedule, section) pairs that meet on `today`."""
    today = today or timezone.localdate()
    pairs = []
    for section in sections:
        for sched in section.schedules.all():
            if schedule_meets_on_date(sched, today):
                pairs.append((sched, section))
    pairs.sort(key=lambda pair: (pair[0].start_time, pair[1].name))
    return pairs
