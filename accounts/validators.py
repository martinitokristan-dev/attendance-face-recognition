import re
from django.core.exceptions import ValidationError
from django.utils.translation import gettext as _


class ComplexPasswordValidator:
    r"""
    Validates that a password meets complexity rules:
    - Minimum 6 characters
    - At least one uppercase letter (A-Z)
    - At least one lowercase letter (a-z)
    - At least one special character (!@#$%^&*(),.?":{}|<>_+-=[]\/~)
    """

    def __init__(self, min_length=6):
        self.min_length = min_length

    def validate(self, password, user=None):
        errors = []

        if len(password) < self.min_length:
            errors.append(f"Password must be at least {self.min_length} characters long.")

        if not re.search(r'[A-Z]', password):
            errors.append("Password must contain at least one uppercase letter (A-Z).")

        if not re.search(r'[a-z]', password):
            errors.append("Password must contain at least one lowercase letter (a-z).")

        if not re.search(r'[!@#$%^&*(),.?":{}|<>_+\-=\[\]\\/~`]', password):
            errors.append("Password must contain at least one special character (e.g. !@#$%^&*).")

        if errors:
            raise ValidationError(errors)

    def get_help_text(self):
        return _(
            f"Your password must be at least {self.min_length} characters long and include "
            "at least one uppercase letter, one lowercase letter, and one special character."
        )
