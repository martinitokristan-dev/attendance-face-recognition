import os
import glob

# Extra replacements for missed or mangled emojis
REPLACEMENTS = {
    '👩‍<i data-lucide="building"></i>': '<i data-lucide="contact"></i>',
    '➕': '<i data-lucide="plus"></i>',
}

template_dir = os.path.join('c:\\', 'Users', 'John', 'Desktop', 'Attendance-FR', 'templates')
html_files = glob.glob(os.path.join(template_dir, '**', '*.html'), recursive=True)

for filepath in html_files:
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    modified = content
    for old, new in REPLACEMENTS.items():
        modified = modified.replace(old, new)

    if modified != content:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(modified)
        print(f"Fixed {filepath}")

print("Fix complete.")
