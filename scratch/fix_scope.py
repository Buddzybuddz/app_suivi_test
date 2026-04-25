import sys

file_path = '/Users/JeremyBaudouin/Dev/App_Suivi_Test/app.js'

with open(file_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Fix the scope of dMaxRecette
# 1. Remove the 'const' from inside the if(dClient) block
# 2. Declare 'let dMaxRecette = null' above it.

start_search = -1
for i, line in enumerate(lines):
    if 'let maxRecetteStr = "—";' in line:
        start_search = i
        break

if start_search == -1:
    print("Could not find start search")
    sys.exit(1)

# Modify lines to include dMaxRecette declaration
lines.insert(start_search, '        let dMaxRecette = null;\n')

# Now find the definition inside if(dClient)
for i in range(start_search + 1, len(lines)):
    if 'const dMaxRecette = addWorkingDays(dClient, -executionWithMargin);' in lines[i]:
        lines[i] = lines[i].replace('const dMaxRecette', 'dMaxRecette')
        break

with open(file_path, 'w', encoding='utf-8') as f:
    f.writelines(lines)

print("Scope fixed")
