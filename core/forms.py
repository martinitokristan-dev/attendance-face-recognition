from django import forms
from .models import Program, ProgramSection, Subject, Section, Schedule, AttendanceRecord
from accounts.models import Teacher, Student


class ProgramForm(forms.ModelForm):
    class Meta:
        model = Program
        fields = ['code', 'name', 'college', 'description']
        widgets = {
            'code': forms.TextInput(attrs={'class': 'form-control', 'placeholder': 'e.g. CITEC'}),
            'name': forms.TextInput(attrs={'class': 'form-control', 'placeholder': 'e.g. College of Information, Technology, Entertainment, and Computing'}),
            'college': forms.TextInput(attrs={'class': 'form-control', 'placeholder': 'e.g. Father Saturnino Urios University'}),
            'description': forms.Textarea(attrs={'class': 'form-control', 'rows': 3, 'placeholder': 'College/Program overview'}),
        }


class ProgramSectionForm(forms.ModelForm):
    """Admin form to manage master section definitions (3NF)."""
    program = forms.ModelChoiceField(
        queryset=Program.objects.all(),
        required=True,
        empty_label='Select Academic Program',
        widget=forms.Select(attrs={'class': 'form-select'}),
        label='Academic Program'
    )

    class Meta:
        model = ProgramSection
        fields = ['program', 'name', 'year_level', 'description']
        widgets = {
            'name': forms.TextInput(attrs={'class': 'form-control', 'placeholder': 'e.g. BSCS-3A or IT 44'}),
            'year_level': forms.Select(attrs={'class': 'form-select'}),
            'description': forms.TextInput(attrs={'class': 'form-control', 'placeholder': 'Optional notes / track'}),
        }


class SubjectForm(forms.ModelForm):
    program = forms.ModelChoiceField(
        queryset=Program.objects.all(),
        required=True,
        empty_label='Select Academic Program',
        widget=forms.Select(attrs={'class': 'form-select', 'id': 'id_program', 'onchange': 'filterSectionsByProgram()'}),
        label='Academic Program'
    )
    section = forms.ModelChoiceField(
        queryset=Section.objects.select_related('program').all(),
        required=False,
        empty_label='Select Section (Optional)',
        widget=forms.Select(attrs={'class': 'form-select', 'id': 'id_section'}),
        label='Class Section'
    )
    teacher = forms.ModelChoiceField(
        queryset=Teacher.objects.select_related('user').all(),
        required=False,
        empty_label='Select Assigned Teacher',
        widget=forms.Select(attrs={'class': 'form-select'}),
        label='Instructor / Teacher'
    )

    class Meta:
        model = Subject
        fields = ['program', 'section', 'teacher', 'code', 'name', 'units', 'description']
        widgets = {
            'code': forms.TextInput(attrs={'class': 'form-control', 'placeholder': 'e.g. CS101'}),
            'name': forms.TextInput(attrs={'class': 'form-control', 'placeholder': 'e.g. Introduction to Computing'}),
            'units': forms.NumberInput(attrs={'class': 'form-control', 'min': 1, 'max': 6}),
            'description': forms.Textarea(attrs={'class': 'form-control', 'rows': 3, 'placeholder': 'Course description / topics'}),
        }


class SectionForm(forms.ModelForm):
    """
    3NF Compliant Section Offering Form.
    Admin selects Academic Program -> Section dropdown dynamically filters to that program.
    Selecting a section sets the name and year level cleanly.
    """
    program = forms.ModelChoiceField(
        queryset=Program.objects.all(),
        required=True,
        empty_label='Select Academic Program',
        widget=forms.Select(attrs={'class': 'form-select', 'id': 'id_program', 'onchange': 'onProgramChanged()'}),
        label='Academic Program'
    )
    program_section = forms.ModelChoiceField(
        queryset=ProgramSection.objects.select_related('program').all(),
        required=False,
        empty_label='Select Section',
        widget=forms.Select(attrs={'class': 'form-select', 'id': 'id_section_select', 'onchange': 'onSectionChanged()'}),
        label='Class Section'
    )
    name = forms.CharField(
        required=False,
        widget=forms.HiddenInput(attrs={'id': 'id_name_hidden'}),
        label='Section Name'
    )
    teacher = forms.ModelChoiceField(
        queryset=Teacher.objects.select_related('user').all(),
        required=False,
        empty_label='Select Assigned Teacher',
        widget=forms.Select(attrs={'class': 'form-select'}),
        label='Section Adviser / Teacher'
    )

    class Meta:
        model = Section
        fields = ['program', 'program_section', 'name', 'year_level', 'teacher', 'school_year', 'semester']
        widgets = {
            'year_level': forms.Select(attrs={'class': 'form-select', 'id': 'id_year_level'}),
            'school_year': forms.TextInput(attrs={'class': 'form-control', 'placeholder': '2025-2026'}),
            'semester': forms.Select(attrs={'class': 'form-select'}),
        }

    def clean(self):
        cleaned_data = super().clean()
        program = cleaned_data.get('program')
        program_section = cleaned_data.get('program_section')
        name = cleaned_data.get('name')

        if program_section:
            cleaned_data['name'] = program_section.name
            cleaned_data['year_level'] = program_section.year_level
            cleaned_data['program'] = program_section.program
        elif name and program:
            # Dynamically attach or create the 3NF ProgramSection record
            psec, _ = ProgramSection.objects.get_or_create(
                program=program,
                name=name.strip(),
                defaults={'year_level': cleaned_data.get('year_level', 1)}
            )
            cleaned_data['program_section'] = psec
            cleaned_data['name'] = psec.name
        else:
            self.add_error('program_section', 'Please select a section or add a new one.')

        return cleaned_data


class ScheduleForm(forms.Form):
    """
    Dual-day schedule form.
    Allows specifying a meeting pattern (e.g. Mon+Wed, Tue+Thu)
    and an optional validity window (effective_from / effective_to).
    One form submission creates 1 or 2 Schedule rows.
    """
    DAY_CHOICES_WITH_NONE = [('', 'None (single day)')] + Schedule.DAY_CHOICES

    section = forms.ModelChoiceField(
        queryset=Section.objects.select_related('program').all(),
        empty_label='Select Section',
        widget=forms.Select(attrs={'class': 'form-select'}),
        label='Section'
    )
    day_1 = forms.ChoiceField(
        choices=Schedule.DAY_CHOICES,
        widget=forms.Select(attrs={'class': 'form-select'}),
        label='Day 1'
    )
    day_2 = forms.ChoiceField(
        choices=[('', 'None (single day)')] + list(Schedule.DAY_CHOICES),
        required=False,
        widget=forms.Select(attrs={'class': 'form-select'}),
        label='Day 2'
    )
    start_time = forms.TimeField(
        widget=forms.TimeInput(attrs={'class': 'form-control', 'type': 'time'}),
        label='Start Time'
    )
    end_time = forms.TimeField(
        widget=forms.TimeInput(attrs={'class': 'form-control', 'type': 'time'}),
        label='End Time'
    )
    room = forms.CharField(
        max_length=50,
        widget=forms.TextInput(attrs={'class': 'form-control', 'placeholder': 'e.g. Room 201'}),
        label='Room'
    )
    effective_from = forms.DateField(
        required=False,
        widget=forms.DateInput(attrs={'class': 'form-control', 'type': 'date'}),
        label='Effective From',
        help_text='First date this schedule applies (leave blank for no restriction)'
    )
    effective_to = forms.DateField(
        required=False,
        widget=forms.DateInput(attrs={'class': 'form-control', 'type': 'date'}),
        label='Effective To',
        help_text='Last date this schedule applies (leave blank for no restriction)'
    )

    def clean(self):
        cleaned = super().clean()
        day_1 = cleaned.get('day_1')
        day_2 = cleaned.get('day_2')
        start = cleaned.get('start_time')
        end = cleaned.get('end_time')
        eff_from = cleaned.get('effective_from')
        eff_to = cleaned.get('effective_to')

        if day_2 and day_1 == day_2:
            raise forms.ValidationError('Day 1 and Day 2 cannot be the same day.')
        if start and end and start >= end:
            raise forms.ValidationError('Start time must be before end time.')
        if eff_from and eff_to and eff_from > eff_to:
            raise forms.ValidationError('Effective From date must be before Effective To date.')
        return cleaned


class TeacherScheduleForm(forms.Form):
    """Schedule form filtered to sections assigned to the specific teacher."""
    def __init__(self, teacher, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields['section'].queryset = Section.objects.filter(teacher=teacher)

    DAY_CHOICES_WITH_NONE = [('', 'None (single day)')] + Schedule.DAY_CHOICES

    section = forms.ModelChoiceField(
        queryset=Section.objects.none(),
        empty_label='Select Section',
        widget=forms.Select(attrs={'class': 'form-select'}),
        label='Section'
    )
    day_1 = forms.ChoiceField(
        choices=Schedule.DAY_CHOICES,
        widget=forms.Select(attrs={'class': 'form-select'}),
        label='Day 1'
    )
    day_2 = forms.ChoiceField(
        choices=[('', 'None (single day)')] + list(Schedule.DAY_CHOICES),
        required=False,
        widget=forms.Select(attrs={'class': 'form-select'}),
        label='Day 2'
    )
    start_time = forms.TimeField(
        widget=forms.TimeInput(attrs={'class': 'form-control', 'type': 'time'}),
        label='Start Time'
    )
    end_time = forms.TimeField(
        widget=forms.TimeInput(attrs={'class': 'form-control', 'type': 'time'}),
        label='End Time'
    )
    room = forms.CharField(
        max_length=50,
        widget=forms.TextInput(attrs={'class': 'form-control', 'placeholder': 'e.g. Room 201'}),
        label='Room'
    )
    effective_from = forms.DateField(
        required=False,
        widget=forms.DateInput(attrs={'class': 'form-control', 'type': 'date'}),
        label='Effective From',
    )
    effective_to = forms.DateField(
        required=False,
        widget=forms.DateInput(attrs={'class': 'form-control', 'type': 'date'}),
        label='Effective To',
    )


class EnrollStudentForm(forms.Form):
    """Enroll a student into a section."""
    student = forms.ModelChoiceField(
        queryset=Student.objects.select_related('user').all(),
        widget=forms.Select(attrs={'class': 'form-select'}),
        label='Student'
    )


class AttendanceRecordEditForm(forms.ModelForm):
    class Meta:
        model = AttendanceRecord
        fields = ['status', 'remarks']
        widgets = {
            'status': forms.Select(attrs={'class': 'form-select'}),
            'remarks': forms.TextInput(attrs={'class': 'form-control'}),
        }
