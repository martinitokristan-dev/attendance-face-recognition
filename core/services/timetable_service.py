import json


class TimetableService:
    DAY_KEYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
    DAY_NAMES = {
        'Mon': 'Monday',
        'Tue': 'Tuesday',
        'Wed': 'Wednesday',
        'Thu': 'Thursday',
        'Fri': 'Friday',
        'Sat': 'Saturday',
        'Sun': 'Sunday',
    }

    # Authentic URIOS green + distinct harmonious palettes for each subject
    PALETTES = [
        {
            'name': 'urios-green',
            'bg': 'rgba(163, 217, 119, 0.28)',
            'bg_solid': '#d6f0be',
            'border': '#7eb852',
            'text': '#1f480f',
            'badge': '#2e7d32',
        },
        {
            'name': 'sky-blue',
            'bg': 'rgba(125, 211, 252, 0.28)',
            'bg_solid': '#dcf0fa',
            'border': '#38bdf8',
            'text': '#0369a1',
            'badge': '#0284c7',
        },
        {
            'name': 'warm-amber',
            'bg': 'rgba(253, 224, 71, 0.28)',
            'bg_solid': '#fef3c7',
            'border': '#f59e0b',
            'text': '#854d0e',
            'badge': '#b45309',
        },
        {
            'name': 'soft-purple',
            'bg': 'rgba(216, 180, 254, 0.28)',
            'bg_solid': '#f3e8ff',
            'border': '#a855f7',
            'text': '#581c87',
            'badge': '#6b21a8',
        },
        {
            'name': 'mint-teal',
            'bg': 'rgba(94, 234, 212, 0.28)',
            'bg_solid': '#ccfbf1',
            'border': '#14b8a6',
            'text': '#134e4a',
            'badge': '#0f766e',
        },
        {
            'name': 'coral-rose',
            'bg': 'rgba(253, 164, 175, 0.28)',
            'bg_solid': '#ffe4e6',
            'border': '#f43f5e',
            'text': '#881337',
            'badge': '#be123c',
        },
    ]

    GRID_START_HOUR = 7    # 07:00 AM
    GRID_END_HOUR = 22      # 10:00 PM
    PIXELS_PER_HOUR = 56    # Pixels per hour

    @classmethod
    def build_timetable_data(cls, sections):
        """
        Builds structured timetable data for a collection of sections.
        """
        time_slots = []
        for h in range(cls.GRID_START_HOUR, cls.GRID_END_HOUR):
            period = 'AM' if h < 12 else 'PM'
            hour12 = h % 12 or 12
            time_slots.append({
                'hour': h,
                'label': f"{hour12:02d}:00 {period}",
                'label_half': f"{hour12:02d}:30 {period}",
                'top': (h - cls.GRID_START_HOUR) * cls.PIXELS_PER_HOUR,
            })

        day_columns = {day: [] for day in cls.DAY_KEYS}
        palette_map = {}
        palette_idx = 0
        schedules_data = []

        for section in sections:
            sec_key = section.id
            if sec_key not in palette_map:
                palette_map[sec_key] = cls.PALETTES[palette_idx % len(cls.PALETTES)]
                palette_idx += 1
            palette = palette_map[sec_key]

            subj = section.effective_subject
            subj_code = subj.code if subj else (section.program.code if section.program else '—')
            subj_name = subj.name if subj else section.name

            for sched in section.schedules.all():
                start_min = sched.start_time.hour * 60 + sched.start_time.minute
                end_min = sched.end_time.hour * 60 + sched.end_time.minute
                duration_min = max(end_min - start_min, 30)

                top_px = ((start_min - (cls.GRID_START_HOUR * 60)) / 60.0) * cls.PIXELS_PER_HOUR
                height_px = (duration_min / 60.0) * cls.PIXELS_PER_HOUR

                # Support multi-day schedules (e.g. T-TH places on Tue and Thu)
                days_to_plot = [sched.day_of_week]
                if sched.day_2 and sched.day_2 != sched.day_of_week:
                    days_to_plot.append(sched.day_2)

                schedules_data.append({
                    'schedule_id': sched.id,
                    'section_id': section.id,
                    'section_name': section.name,
                    'program': section.program.code if section.program else '',
                    'subject_code': subj_code,
                    'subject_name': subj_name,
                    'room': sched.room,
                    'days': days_to_plot,
                    'start_time': sched.start_time.strftime('%H:%M'),
                    'end_time': sched.end_time.strftime('%H:%M'),
                    'time_display': sched.time_display,
                    'days_display': sched.days_display,
                })

                for d in days_to_plot:
                    if d in day_columns:
                        day_columns[d].append({
                            'schedule_id': sched.id,
                            'section_id': section.id,
                            'section_name': section.name,
                            'program_code': section.program.code if section.program else '',
                            'subject_code': subj_code,
                            'subject_name': subj_name,
                            'room': sched.room,
                            'time_display': sched.time_display,
                            'days_display': sched.days_display,
                            'top': round(top_px, 1),
                            'height': round(height_px, 1),
                            'palette': palette,
                        })

        columns_list = []
        total_events = 0
        for day in cls.DAY_KEYS:
            events = sorted(day_columns[day], key=lambda x: x['top'])
            total_events += len(events)
            columns_list.append({
                'key': day,
                'name': cls.DAY_NAMES[day],
                'events': events,
            })

        total_grid_height = (cls.GRID_END_HOUR - cls.GRID_START_HOUR) * cls.PIXELS_PER_HOUR

        return {
            'time_slots': time_slots,
            'columns': columns_list,
            'grid_height': total_grid_height,
            'total_events': total_events,
            'pixels_per_hour': cls.PIXELS_PER_HOUR,
            'start_hour': cls.GRID_START_HOUR,
            'end_hour': cls.GRID_END_HOUR,
            'schedules_json': json.dumps(schedules_data),
        }
