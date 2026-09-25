import glob

replacements = {
    '\U0001f4cb': '<i data-lucide="clipboard-list"></i>',
    '\U0001f441': '<i data-lucide="eye"></i>',
}

files = glob.glob('templates/**/*.html', recursive=True)
for f in files:
    with open(f, encoding='utf-8') as fp:
        content = fp.read()
    modified = content
    for emoji, icon in replacements.items():
        modified = modified.replace(emoji, icon)
    if modified != content:
        with open(f, 'w', encoding='utf-8') as fp:
            fp.write(modified)
        print('Fixed:', f)
print('Done.')
