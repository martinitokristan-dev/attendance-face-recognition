"""
Attendance Serializers
Handles serialization and input validation for attendance sessions, records, and marking.
"""
from rest_framework import serializers
from core.models import AttendanceSession, AttendanceRecord
from core.serializers import AttendanceRecordSerializer, AttendanceSessionSerializer


class AttendanceSessionStartSerializer(serializers.Serializer):
    """Validates payload for starting or resuming an attendance session."""
    schedule_id = serializers.IntegerField(required=True)


class ManualAttendanceMarkSerializer(serializers.Serializer):
    """Validates payload for manually marking student attendance."""
    session_id = serializers.IntegerField(required=True)
    student_id = serializers.IntegerField(required=True)
    status = serializers.ChoiceField(choices=['present', 'late', 'absent', 'excused'], default='present')
    notes = serializers.CharField(required=False, allow_blank=True, default='')
