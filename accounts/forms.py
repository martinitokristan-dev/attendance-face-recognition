from django import forms
from django.contrib.auth.forms import AuthenticationForm, UserCreationForm
from .models import CustomUser, Teacher, Student


class LoginForm(AuthenticationForm):
    username = forms.CharField(
        widget=forms.TextInput(attrs={'class': 'form-control', 'placeholder': 'Username or Student ID', 'autofocus': True})
    )
    password = forms.CharField(
        widget=forms.PasswordInput(attrs={'class': 'form-control', 'placeholder': 'Password'})
    )


STAFF_ROLE_CHOICES = (
    ('teacher', 'Teacher'),
    ('admin', 'Admin'),
)


class AdminUserCreateForm(UserCreationForm):
    """Used by admin to create staff/faculty users (Teacher, Admin)."""
    first_name = forms.CharField(max_length=50, required=True, widget=forms.TextInput(attrs={'class': 'form-control'}))
    last_name = forms.CharField(max_length=50, required=True, widget=forms.TextInput(attrs={'class': 'form-control'}))
    email = forms.EmailField(required=True, widget=forms.EmailInput(attrs={'class': 'form-control'}))
    role = forms.ChoiceField(choices=STAFF_ROLE_CHOICES, widget=forms.Select(attrs={'class': 'form-select'}))
    phone = forms.CharField(max_length=20, required=False, widget=forms.TextInput(attrs={'class': 'form-control'}))

    class Meta:
        model = CustomUser
        fields = ['username', 'first_name', 'last_name', 'email', 'role', 'phone', 'password1', 'password2']
        widgets = {
            'username': forms.TextInput(attrs={'class': 'form-control'}),
        }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields['password1'].widget.attrs.update({'class': 'form-control'})
        self.fields['password2'].widget.attrs.update({'class': 'form-control'})


class TeacherProfileForm(forms.ModelForm):
    department = forms.ChoiceField(
        required=False,
        widget=forms.Select(attrs={'class': 'form-select'}),
        label='Department / Program',
        help_text='Select the academic department or college'
    )

    class Meta:
        model = Teacher
        fields = ['employee_id', 'department', 'specialization']
        labels = {
            'employee_id': 'Faculty ID (FAC-ID)',
            'department': 'Department / Program',
        }
        widgets = {
            'employee_id': forms.TextInput(attrs={
                'class': 'form-control',
                'placeholder': 'e.g. FAC-2026-001',
            }),
            'specialization': forms.TextInput(attrs={
                'class': 'form-control',
                'placeholder': 'e.g. Software Engineering',
            }),
        }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        from core.models import Program
        try:
            programs = Program.objects.all().order_by('code')
            choices = [('', 'Select Program / Department')]
            seen = set()
            for p in programs:
                label = f"{p.code} - {p.name}" if p.name and p.name != p.code else p.code
                val = p.name or p.code
                choices.append((val, label))
                seen.add(val)
                seen.add(p.code)

            if self.instance and getattr(self.instance, 'pk', None) and self.instance.department:
                if self.instance.department not in seen:
                    choices.append((self.instance.department, self.instance.department))
                    seen.add(self.instance.department)

            dept_input = self.data.get('department') if self.data else None
            if dept_input and dept_input not in seen:
                choices.append((dept_input, dept_input))
                seen.add(dept_input)

            self.fields['department'].choices = choices
        except Exception:
            self.fields['department'].choices = [('', 'Select Program / Department')]


class StudentProfileForm(forms.ModelForm):
    class Meta:
        model = Student
        fields = ['student_id', 'year_level', 'course']
        widgets = {
            'student_id': forms.TextInput(attrs={'class': 'form-control'}),
            'year_level': forms.NumberInput(attrs={'class': 'form-control'}),
            'course': forms.TextInput(attrs={'class': 'form-control'}),
        }


class UserEditForm(forms.ModelForm):
    class Meta:
        model = CustomUser
        fields = ['first_name', 'last_name', 'email', 'phone', 'profile_image']
        widgets = {
            'first_name': forms.TextInput(attrs={'class': 'form-control'}),
            'last_name': forms.TextInput(attrs={'class': 'form-control'}),
            'email': forms.EmailInput(attrs={'class': 'form-control'}),
            'phone': forms.TextInput(attrs={'class': 'form-control'}),
            'profile_image': forms.FileInput(attrs={'class': 'form-control'}),
        }


class StudentRegisterForm(forms.Form):
    """Convenient streamlined form to register a new student and directly assign to a section."""
    student_id = forms.CharField(
        max_length=30, required=True,
        widget=forms.TextInput(attrs={'class': 'form-control', 'placeholder': 'e.g. 2024-00002'})
    )
    first_name = forms.CharField(
        max_length=50, required=True,
        widget=forms.TextInput(attrs={'class': 'form-control', 'placeholder': 'First Name'})
    )
    last_name = forms.CharField(
        max_length=50, required=True,
        widget=forms.TextInput(attrs={'class': 'form-control', 'placeholder': 'Last Name'})
    )
    email = forms.EmailField(
        required=False,
        widget=forms.EmailInput(attrs={'class': 'form-control', 'placeholder': 'Optional (defaults to <id>@attendfr.edu)'})
    )
    course = forms.CharField(
        max_length=100, initial='BSCS', required=True,
        widget=forms.TextInput(attrs={'class': 'form-control', 'placeholder': 'e.g. BSCS, BSIT'})
    )
    year_level = forms.IntegerField(
        initial=1, min_value=1, max_value=6, required=True,
        widget=forms.NumberInput(attrs={'class': 'form-control'})
    )
    section = forms.ModelChoiceField(
        queryset=None,
        required=False,
        empty_label='Select Section (Optional)',
        widget=forms.Select(attrs={'class': 'form-select'})
    )
    password = forms.CharField(
        required=False,
        widget=forms.PasswordInput(attrs={'class': 'form-control', 'placeholder': 'Default: student123 if blank'})
    )

    def __init__(self, user=None, *args, **kwargs):
        super().__init__(*args, **kwargs)
        from core.models import Section
        if user and user.role == 'teacher':
            teacher = getattr(user, 'teacher_profile', None)
            self.fields['section'].queryset = Section.objects.filter(teacher=teacher) if teacher else Section.objects.none()
        else:
            self.fields['section'].queryset = Section.objects.select_related('subject', 'teacher__user').all()

    def clean_student_id(self):
        sid = self.cleaned_data['student_id'].strip()
        if Student.objects.filter(student_id=sid).exists():
            raise forms.ValidationError(f"A student with Student ID '{sid}' already exists.")
        return sid

    def clean_password(self):
        pwd = self.cleaned_data.get('password')
        if pwd:
            from django.contrib.auth.password_validation import validate_password
            validate_password(pwd)
        return pwd

