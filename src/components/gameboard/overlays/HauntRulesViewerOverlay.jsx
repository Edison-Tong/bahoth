import { useEffect, useState } from "react";
import { HeroRulesPage, TraitorRulesPage } from "./HauntSetupOverlay";

export default function HauntRulesViewerOverlay({ role, hauntDefinition, traitorName, onClose }) {
  const [step, setStep] = useState("prompt");

  useEffect(() => {
    setStep("prompt");
  }, [role]);

  if (!role || !hauntDefinition) return null;

  const isTraitorView = role === "traitor";
  const panelClass = isTraitorView ? "card-haunt-rules-traitor" : "card-haunt-rules-heroes";

  if (step === "prompt") {
    return (
      <div className="card-overlay" role="dialog" aria-label="Haunt rules gate">
        <div className={`card-modal card-haunt-setup ${panelClass}`}>
          <div className="card-type-label">HAUNT RULES</div>
          <h2 className="card-name">{isTraitorView ? "TRAITORS RULES" : "HEROS RULES"}</h2>
          <p className="card-description">
            {isTraitorView
              ? `Hero players should step away. ${traitorName}, continue when ready.`
              : "Traitor player should step away from the computer now."}
          </p>
          <div className="haunt-rules-viewer-actions">
            <button className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={() => setStep("rules")}>
              Continue
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (isTraitorView) {
    return <TraitorRulesPage hauntDefinition={hauntDefinition} onDone={onClose} />;
  }

  return <HeroRulesPage hauntDefinition={hauntDefinition} onDone={onClose} />;
}
