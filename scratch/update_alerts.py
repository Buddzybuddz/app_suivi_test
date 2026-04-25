import sys

file_path = '/Users/JeremyBaudouin/Dev/App_Suivi_Test/app.js'

with open(file_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

start_idx = -1
end_idx = -1

for i, line in enumerate(lines):
    if 'const margin = dClient ? getWorkingDaysPrecise(finishDate, dClient) : 0;' in line:
        start_idx = i
        break

if start_idx == -1:
    print("Could not find start index")
    sys.exit(1)

# Find the end of the else block
for i in range(start_idx, len(lines)):
    if 'if (typeof lucide !== "undefined") lucide.createIcons();' in lines[i]:
        # Backtrack to the last } before lucide
        j = i - 1
        while j > start_idx:
            if '}' in lines[j] and 'else' not in lines[j] and 'if' not in lines[j]:
                # This is likely the end of the dashboard else block
                # Wait, let's just find the exact pattern from the previous view
                break
            j -= 1
        end_idx = i
        break

new_content = """            const margin = dClient ? getWorkingDaysPrecise(finishDate, dClient) : 0;
            const isDelay = margin < 0;
            const marginAbs = round05Up(Math.abs(margin));

            let displayFinishDate = finishDate;
            if (isDelay && dClient && fmt(finishDate) === fmt(dClient)) {
                displayFinishDate = addWorkingDays(finishDate, 1);
            }

            const isMaxRecettePassed = dMaxRecette && now > dMaxRecette;
            const hasUnfinishedExecution = viewTickets.some(t => {
                const st = t.statusExecution || 'À exécuter';
                return st !== 'Terminée OK' && st !== 'Terminée KO';
            });
            const maxRecetteAlert = isMaxRecettePassed && hasUnfinishedExecution;
            const maxRecetteColor = maxRecetteAlert ? { bg: "rgba(239, 68, 68, 0.12)", text: "#ef4444" } : null;

            setSlot("slotActualDate", "valActualDate", "", false);
            setSlot("slotMaxRecetteDate", "valMaxRecetteDate", maxRecetteStr, !!dClient, maxRecetteColor);
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
                        if (maxRecetteAlert) {
                            riskText.textContent = `Livraison client OK, mais retard sur le début de recette (date max : ${fmt(dMaxRecette)})`;
                            riskText.style.color = "#f59e0b";
                        } else {
                            riskText.textContent = `Livraison client possible le ${fmt(displayFinishDate)}`;
                            riskText.style.color = "#10b981";
                        }
                    }
                    if (riskIcon) {
                        if (maxRecetteAlert) {
                            riskIcon.innerHTML = '<i data-lucide="alert-circle"></i>';
                            riskIcon.style.background = "rgba(245, 158, 11, 0.1)";
                            riskIcon.style.color = "#f59e0b";
                        } else {
                            riskIcon.innerHTML = '<i data-lucide="check-circle"></i>';
                            riskIcon.style.background = "rgba(16, 185, 129, 0.1)";
                            riskIcon.style.color = "#10b981";
                        }
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

lines[start_idx:end_idx] = [new_content]

with open(file_path, 'w', encoding='utf-8') as f:
    f.writelines(lines)

print("Replacement successful")
