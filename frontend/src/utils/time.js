/**
 * Time formatting utility for AttendFR.
 * Formats schedules to the school standard format:
 * Single Day: "M 09:00AM-10:30AM", "S 01:30PM-04:30PM"
 * Two Days:   "M/W 04:30PM-06:00PM/04:30PM-06:00PM", "T/TH 06:00PM-07:30PM/06:00PM-07:30PM"
 */

const DAY_MAP = {
  Mon: 'M', Tue: 'T', Wed: 'W', Thu: 'TH', Fri: 'F', Sat: 'S', Sun: 'SU',
  Monday: 'M', Tuesday: 'T', Wednesday: 'W', Thursday: 'TH', Friday: 'F', Saturday: 'S', Sunday: 'SU',
  M: 'M', T: 'T', W: 'W', TH: 'TH', Th: 'TH', F: 'F', S: 'S', Sa: 'S', Su: 'SU', SU: 'SU'
};

/**
 * Converts a time string (e.g. "8:00", "08:00:00", "8:00 AM", "18:00")
 * into 2-digit 12-hour AM/PM format without spaces (e.g. "08:00AM", "06:00PM").
 */
export function toSchoolTimeSingle(t) {
  if (!t) return '';
  const clean = String(t).trim();

  const match = clean.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)?$/i);
  if (match) {
    let h = parseInt(match[1], 10);
    const m = match[2];
    let ampm = match[3] ? match[3].toUpperCase() : '';
    if (!ampm) {
      ampm = h >= 12 ? 'PM' : 'AM';
    }
    h = h % 12 || 12;
    return `${String(h).padStart(2, '0')}:${m}${ampm}`;
  }

  return clean;
}

/**
 * Parses start and end time strings intelligently resolving shared AM/PM
 */
export function parseTimeRangeStrings(startStr, endStr) {
  const s1 = String(startStr || '').trim();
  const s2 = String(endStr || '').trim();

  const m1 = s1.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)?$/i);
  const m2 = s2.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)?$/i);

  if (m1 && m2) {
    let h1 = parseInt(m1[1], 10);
    const min1 = m1[2];
    let ampm1 = m1[3] ? m1[3].toUpperCase() : '';

    let h2 = parseInt(m2[1], 10);
    const min2 = m2[2];
    let ampm2 = m2[3] ? m2[3].toUpperCase() : '';

    if (!ampm2) {
      ampm2 = h2 >= 12 ? 'PM' : 'AM';
    }

    if (!ampm1) {
      if (h1 >= 12) {
        ampm1 = 'PM';
      } else if (ampm2 === 'PM') {
        if (h1 >= 1 && h1 <= 7) {
          ampm1 = 'PM';
        } else if (h1 >= 8 && h1 <= 11) {
          ampm1 = 'AM';
        } else {
          ampm1 = 'PM';
        }
      } else {
        ampm1 = 'AM';
      }
    }

    h1 = h1 % 12 || 12;
    h2 = h2 % 12 || 12;

    return {
      start: `${String(h1).padStart(2, '0')}:${min1}${ampm1}`,
      end: `${String(h2).padStart(2, '0')}:${min2}${ampm2}`,
    };
  }

  return {
    start: toSchoolTimeSingle(s1),
    end: toSchoolTimeSingle(s2),
  };
}

/**
 * Formats a time range slot (e.g. "08:00AM-09:30AM" or with 2 days "08:00AM-09:30AM/08:00AM-09:30AM")
 */
export function formatSchoolTimeSlot(start, end, hasTwoDays = false) {
  const parsed = parseTimeRangeStrings(start, end);
  if (!parsed.start && !parsed.end) return '';
  return `${parsed.start}-${parsed.end}`;
}

/**
 * Splits a fullTime string into school standard multi-line display:
 * Line 1: Day(s) + First Time Slot (e.g. "M/W 08:00AM-09:30AM")
 * Line 2: Slash + Second Time Slot (e.g. "/10:00AM-11:30AM") if different
 * Single-day schedules return 1 element: ["S 01:30PM-04:30PM"]
 */
export function splitScheduleTimeLines(fullTime) {
  if (!fullTime || fullTime === 'No schedule set' || fullTime === '—') {
    return [fullTime || 'No schedule set'];
  }
  const str = String(fullTime).trim();
  const m = str.match(/^([A-Za-z/]+\s+\d{1,2}:\d{2}(?:AM|PM)?-\d{1,2}:\d{2}(?:AM|PM)?)\s*\/\s*(.+)$/i);
  if (m) {
    const firstPart = m[1].trim();
    const secondPart = m[2].trim();
    const firstSlot = firstPart.replace(/^[A-Za-z/]+\s+/, '').trim();
    if (firstSlot.toLowerCase() === secondPart.toLowerCase()) {
      return [firstPart];
    }
    return [firstPart, '/' + secondPart];
  }
  const m2 = str.match(/^(\d{1,2}:\d{2}(?:AM|PM)?-\d{1,2}:\d{2}(?:AM|PM)?)\s*\/\s*(.+)$/i);
  if (m2) {
    const firstPart = m2[1].trim();
    const secondPart = m2[2].trim();
    if (firstPart.toLowerCase() === secondPart.toLowerCase()) {
      return [firstPart];
    }
    return [firstPart, '/' + secondPart];
  }
  return [str];
}

/**
 * Extracts and formats school schedule parts into { fullTime, timeLines, room }
 * fullTime: e.g. "M/W 08:00AM-09:30AM/08:00AM-09:30AM" or "M 09:00AM-10:30AM"
 * timeLines: ["M/W 08:00AM-09:30AM", "/08:00AM-09:30AM"]
 * room: e.g. "CB 224", "Room 101"
 */
export function formatSchoolScheduleParts(item) {
  if (!item) return { fullTime: 'No schedule set', timeLines: ['No schedule set'], room: '' };

  // If item is already an object like Schedule or Section Schedule
  if (typeof item === 'object') {
    let d1 = '';
    let d2 = '';

    if (item.day_of_week) d1 = DAY_MAP[item.day_of_week] || item.day_of_week;
    if (item.day_2) d2 = DAY_MAP[item.day_2] || item.day_2;

    if (!d1 && item.days_display) {
      const parts = item.days_display.split(/[/–-]/);
      d1 = DAY_MAP[parts[0]?.trim()] || parts[0]?.trim() || '';
      if (parts.length > 1) {
        d2 = DAY_MAP[parts[1]?.trim()] || parts[1]?.trim() || '';
      }
    }

    const hasTwoDays = Boolean(d2);
    const daysStr = hasTwoDays ? `${d1}/${d2}` : d1;

    let timeStr = '';
    if (item.start_time && item.end_time) {
      timeStr = formatSchoolTimeSlot(item.start_time, item.end_time, hasTwoDays);
    } else if (item.time_display) {
      timeStr = item.time_display;
      if (timeStr.includes('–') || timeStr.includes(' - ') || !timeStr.match(/\d{2}:\d{2}(?:AM|PM)/)) {
        const parts = timeStr.split(/[-–]| - /).map(s => s.trim());
        if (parts.length >= 2) {
          timeStr = formatSchoolTimeSlot(parts[0], parts[1], hasTwoDays);
        }
      }
    }

    const room = item.room || '';
    const fullTime = [daysStr, timeStr].filter(Boolean).join(' ') || 'No schedule set';

    return {
      days: daysStr,
      time: timeStr,
      fullTime,
      timeLines: splitScheduleTimeLines(fullTime),
      room,
    };
  }

  // If item is a string, e.g. "M–W 8:00–9:30 AM @ CB 224" or "T/TH 06:00PM-07:30PM/06:00PM-07:30PM @ CB 226"
  const str = String(item).trim();
  if (!str || str === 'No schedule set' || str === '—') {
    return { fullTime: 'No schedule set', timeLines: ['No schedule set'], room: '' };
  }

  const atParts = str.split('@');
  const timePart = atParts[0].trim();
  const room = atParts.length > 1 ? atParts[1].trim() : '';

  // Check if timePart already matches school format e.g. "M/W 08:00AM-09:30AM/08:00AM-09:30AM"
  if (timePart.match(/^[A-Z/]+\s+\d{2}:\d{2}(?:AM|PM)-\d{2}:\d{2}(?:AM|PM)/)) {
    return {
      fullTime: timePart,
      timeLines: splitScheduleTimeLines(timePart),
      room,
    };
  }

  // Parse days from timePart (e.g. "M–W 8:00–9:30 AM", "T-TH 6:00-8:30 PM", "S 1:30-4:30 PM")
  const dayMatch = timePart.match(/^([A-Za-z]+(?:[/–-][A-Za-z]+)?)\s+(.*)$/);
  if (dayMatch) {
    const rawDays = dayMatch[1].trim();
    const rawTimes = dayMatch[2].trim();
    const dayParts = rawDays.split(/[/–-]/);
    const d1 = DAY_MAP[dayParts[0]?.trim()] || dayParts[0]?.trim() || '';
    const d2 = dayParts.length > 1 ? (DAY_MAP[dayParts[1]?.trim()] || dayParts[1]?.trim() || '') : '';
    const hasTwoDays = Boolean(d2);
    const daysStr = hasTwoDays ? `${d1}/${d2}` : d1;

    let timeStr = rawTimes;
    const timeParts = rawTimes.split(/[-–]| - /).map(s => s.trim());
    if (timeParts.length >= 2) {
      timeStr = formatSchoolTimeSlot(timeParts[0], timeParts[1], hasTwoDays);
    }

    const fullTime = `${daysStr} ${timeStr}`.trim() || 'No schedule set';
    return {
      days: daysStr,
      time: timeStr,
      fullTime,
      timeLines: splitScheduleTimeLines(fullTime),
      room,
    };
  }

  return {
    fullTime: timePart,
    timeLines: splitScheduleTimeLines(timePart),
    room,
  };
}

export function formatSingleTime(t) {
  return toSchoolTimeSingle(t);
}

export function formatTime12h(timeStr) {
  if (!timeStr) return '—';
  const parts = formatSchoolScheduleParts(timeStr);
  return parts.fullTime || '—';
}
