import re

from accounts.models import CustomUser


def username_from_student_id(student_id: str, exclude_user_id: int | None = None) -> str:
    """Login username equals student ID (sanitized); no s_ prefix."""
    raw = (student_id or '').strip()
    base = re.sub(r'[^\w.@+-]', '', raw)
    if not base:
        base = 'student'
    username = base
    suffix = 2
    qs = CustomUser.objects.all()
    if exclude_user_id:
        qs = qs.exclude(pk=exclude_user_id)
    while qs.filter(username=username).exists():
        username = f'{base}_{suffix}'
        suffix += 1
    return username
