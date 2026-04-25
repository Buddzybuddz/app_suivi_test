import sys

file_path = '/Users/JeremyBaudouin/Dev/App_Suivi_Test/app.js'

with open(file_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Update bubble value and summary text pluralization
for i in range(len(lines)):
    # 1. Remove minus/plus from bubble value
    if 'setSlot("slotMargin", "valMargin", `${isDelay ? "-" : "+"}${marginAbs.toFixed(1)} j`' in lines[i]:
        lines[i] = lines[i].replace('`${isDelay ? "-" : "+"}${marginAbs.toFixed(1)} j`', '`${marginAbs.toFixed(1)} j`')
    
    # 2. Update riskText for delay (not delivered)
    if 'riskText.textContent = `Retard estimé à ${marginAbs.toFixed(2)} jours' in lines[i]:
        # Replacing "jours" with a condition
        lines[i] = lines[i].replace('jours', '${marginAbs <= 1 ? "jour" : "jours"}')
    
    # 3. Update riskText for delivered version delay
    if 'riskText.textContent = isDelayActual ? `Livrée avec un retard de ${marginAbsActual.toFixed(1)} jours` : "Version livrée à temps"' in lines[i]:
         lines[i] = lines[i].replace('jours', '${marginAbsActual <= 1 ? "jour" : "jours"}')

with open(file_path, 'w', encoding='utf-8') as f:
    f.writelines(lines)

print("Updates applied")
