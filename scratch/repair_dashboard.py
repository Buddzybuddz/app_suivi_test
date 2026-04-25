import sys

file_path = '/Users/JeremyBaudouin/Dev/App_Suivi_Test/app.js'

with open(file_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Target block to replace (from setSlot("slotClientDate", ...) approx line 2101)
# Search for the start and end of the block
start_idx = -1
end_idx = -1

for i, line in enumerate(lines):
    if 'setSlot("slotClientDate"' in line and i > 2090:
        start_idx = i
        break

if start_idx == -1:
    print("Could not find start index")
    sys.exit(1)

# Search for the end of the if (riskIcon && riskText && currentVersion) block
# It ends with } followed by if (typeof lucide !== "undefined")
for i in range(start_idx, len(lines)):
    if 'if (typeof lucide !== "undefined") lucide.createIcons();' in lines[i]:
        end_idx = i
        break

if end_idx == -1:
    print("Could not find end index")
    sys.exit(1)

new_block = """        setSlot("slotClientDate", "valClientDate", fmt(dClient), !!dClient);
        
        if (dActual) {
            setSlot("slotActualDate", "valActualDate", fmt(dActual), true);
            setSlot("slotMaxRecetteDate", "valMaxRecetteDate", "", false);
            setSlot("slotPossibleDate", "valPossibleDate", "", false);
            
            if (dClient) {
                const finalMargin = getWorkingDaysPrecise(dActual, dClient);
                const isDelayActual = finalMargin < 0;
                const marginAbsActual = round05Up(Math.abs(finalMargin));
                
                if (isDelayActual) {
                    const color = { bg: "rgba(239, 68, 68, 0.08)", text: "#ef4444" };
                    setSlot("slotMargin", "valMargin", `-${marginAbsActual.toFixed(1)} j`, true, color, "labelMargin", "Retard");
                } else {
                    setSlot("slotMargin", "valMargin", "", false);
                }
                
                if (riskTitle) riskTitle.textContent = "";
                if (riskText) {
                    riskText.textContent = isDelayActual ? `Livrée avec un retard de ${marginAbsActual.toFixed(1)} jours` : "Version livrée à temps";
                    riskText.style.color = isDelayActual ? "#ef4444" : "#10b981";
                }
                if (riskIcon) {
                    riskIcon.innerHTML = isDelayActual ? '<i data-lucide="alert-triangle"></i>' : '<i data-lucide="check-circle"></i>';
                    riskIcon.style.background = isDelayActual ? "rgba(239, 68, 68, 0.1)" : "rgba(16, 185, 129, 0.1)";
                    riskIcon.style.color = isDelayActual ? "#ef4444" : "#10b981";
                }
            } else {
                setSlot("slotMargin", "valMargin", "", false);
                if (riskText) riskText.textContent = "";
            }
        } else {
            const margin = dClient ? getWorkingDaysPrecise(finishDate, dClient) : 0;
            const isDelay = margin < 0;
            const marginAbs = round05Up(Math.abs(margin));

            let displayFinishDate = finishDate;
            if (isDelay && dClient && fmt(finishDate) === fmt(dClient)) {
                // Si retard mais même jour affiché, on pousse au lendemain ouvré pour la clarté
                displayFinishDate = addWorkingDays(finishDate, 1);
            }

            setSlot("slotActualDate", "valActualDate", "", false);
            setSlot("slotMaxRecetteDate", "valMaxRecetteDate", maxRecetteStr, !!dClient);
            setSlot("slotPossibleDate", "valPossibleDate", fmt(displayFinishDate), true);
            
            if (dClient) {
                const color = isDelay 
                    ? { bg: "rgba(239, 68, 68, 0.08)", text: "#ef4444" }
                    : { bg: "rgba(16, 185, 129, 0.08)", text: "#10b981" };
                
                setSlot("slotMargin", "valMargin", `${isDelay ? "-" : "+"}${marginAbs.toFixed(1)} j`, true, color, "labelMargin", isDelay ? "Retard" : "Marge");
                
                if (isDelay) {
                    if (riskText) {
                        riskText.textContent = `Retard estimé à ${marginAbs.toFixed(2)} jours, livraison client possible le ${fmt(displayFinishDate)}`;
                        riskText.style.color = "#ef4444";
                    }
                    if (riskIcon) {
                        riskIcon.innerHTML = '<i data-lucide="alert-triangle"></i>';
                        riskIcon.style.background = "rgba(239, 68, 68, 0.1)";
                        riskIcon.style.color = "#ef4444";
                    }
                } else {
                    if (riskText) {
                        riskText.textContent = `Livraison client possible le ${fmt(displayFinishDate)}`;
                        riskText.style.color = "#10b981";
                    }
                    if (riskIcon) {
                        riskIcon.innerHTML = '<i data-lucide="check-circle"></i>';
                        riskIcon.style.background = "rgba(16, 185, 129, 0.1)";
                        riskIcon.style.color = "#10b981";
                    }
                }
            } else {
                setSlot("slotMargin", "valMargin", "", false);
                if (riskText) {
                    riskText.textContent = "Date de livraison client non définie";
                    riskText.style.color = "var(--text-muted)";
                }
            }
        }
"""

# The script should keep the end_idx line which is 'if (typeof lucide !== "undefined") lucide.createIcons();'
lines[start_idx:end_idx] = [new_block]

with open(file_path, 'w', encoding='utf-8') as f:
    f.writelines(lines)

print(f"Successfully replaced block from line {start_idx+1} to {end_idx}")
