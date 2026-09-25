import os
import glob

# Mapping of emojis to Lucide icon tags
EMOJI_MAP = {
    '🎓': '<i data-lucide="graduation-cap"></i>',
    '🏠': '<i data-lucide="home"></i>',
    '👥': '<i data-lucide="users"></i>',
    '📚': '<i data-lucide="book-open"></i>',
    '🏫': '<i data-lucide="building"></i>',
    '📅': '<i data-lucide="calendar"></i>',
    '📊': '<i data-lucide="bar-chart-2"></i>',
    '📷': '<i data-lucide="camera"></i>',
    '⚙️': '<i data-lucide="settings"></i>',
    '🚪': '<i data-lucide="log-out"></i>',
    '👩‍🏫': '<i data-lucide="contact"></i>',
    '✅': '<i data-lucide="check-circle"></i>',
    '⚡': '<i data-lucide="zap"></i>',
    '🕐': '<i data-lucide="clock"></i>',
    '✏️': '<i data-lucide="edit-2"></i>',
    '🗑️': '<i data-lucide="trash-2"></i>',
    '💾': '<i data-lucide="save"></i>',
    'ℹ️': '<i data-lucide="info"></i>',
    '⚠️': '<i data-lucide="alert-triangle"></i>',
    '❌': '<i data-lucide="x-circle"></i>',
    '🟢': '<i data-lucide="circle-dot"></i>',
    '🟡': '<i data-lucide="circle"></i>',
    '⏰': '<i data-lucide="alarm-clock"></i>',
    '📄': '<i data-lucide="file-text"></i>',
    '▶': '<i data-lucide="play"></i>',
    '⏹': '<i data-lucide="square"></i>',
    '🔍': '<i data-lucide="search"></i>',
    '⏸': '<i data-lucide="pause"></i>',
    '🖨️': '<i data-lucide="printer"></i>',
    '💡': '<i data-lucide="lightbulb"></i>',
    '🎯': '<i data-lucide="target"></i>',
    '🔐': '<i data-lucide="lock"></i>',
    '👤': '<i data-lucide="user"></i>',
    '●': '<i data-lucide="circle-dot"></i>',
}

# Lucide script to inject into base.html
LUCIDE_SCRIPT = """
<script src="https://unpkg.com/lucide@latest"></script>
<script>
  lucide.createIcons();
</script>
</body>
"""

template_dir = os.path.join('c:\\', 'Users', 'John', 'Desktop', 'Attendance-FR', 'templates')
html_files = glob.glob(os.path.join(template_dir, '**', '*.html'), recursive=True)

for filepath in html_files:
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # Special case: inject lucide script into base.html
    if os.path.basename(filepath) == 'base.html':
        if 'lucide.createIcons()' not in content:
            content = content.replace('</body>', LUCIDE_SCRIPT)

    # Replace emojis
    modified = content
    for emoji, icon in EMOJI_MAP.items():
        modified = modified.replace(emoji, icon)

    if modified != content:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(modified)
        print(f"Updated {filepath}")

print("Emoji replacement complete.")
