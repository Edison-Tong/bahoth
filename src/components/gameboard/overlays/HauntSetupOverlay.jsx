function getHaunt1HeroRules() {
  return [
    "Kill the traitor to release Jack's Spirit.",
    "Exorcise Jack's Spirit to win.",
    "Learn about Jack (Library, once per turn): Knowledge roll 5+ gives a Knowledge of Jack token to a hero without one.",
    "Study the Exorcism (Event tile, once per turn): Knowledge roll 5+ places or moves the Exorcism token.",
    "Exorcise Jack's Spirit (same tile, once per turn): Sanity roll 7+ with floor token bonuses wins for heroes.",
  ];
}

function getHaunt1TraitorRules() {
  return [
    "You are still in the house and are the traitor.",
    "Win when all heroes are dead.",
    "When the traitor dies, Jack's Spirit appears at the omen tile farthest from the corpse.",
    "If Jack's Spirit reaches the traitor corpse tile, heal the traitor and return control to your explorer.",
    "Stalk Prey (once per turn): if you have not attacked and no hero is in line of sight, move to any upper/ground tile out of hero line of sight.",
  ];
}

export default function HauntSetupOverlay({ game, hauntDefinition, onAdvanceRules, onBeginHaunt }) {
  if (!game?.hauntState || game.gamePhase !== "hauntSetup") return null;
  if (!hauntDefinition) return null;

  const rulesStep = game.hauntState.rulesView?.step || "heroes-prompt";
  const traitorName = game.players[game.hauntState.traitorPlayerIndex]?.name || "the traitor";
  const isTraitorScreen = rulesStep === "traitor-prompt" || rulesStep === "traitor-rules";
  const panelClass = isTraitorScreen ? "card-haunt-rules-traitor" : "card-haunt-rules-heroes";

  if (rulesStep === "heroes-prompt") {
    return (
      <div className="card-overlay" role="dialog" aria-label="Heroes rules gate">
        <div className={`card-modal card-haunt-setup ${panelClass}`}>
          <div className="card-type-label">HAUNT RULES</div>
          <h2 className="card-name">HEROS RULES</h2>
          <p className="card-description">Traitor player should step away from the computer now.</p>
          <button className="btn btn-primary" onClick={onAdvanceRules}>
            Continue
          </button>
        </div>
      </div>
    );
  }

  if (rulesStep === "heroes-rules") {
    return (
      <div className="card-overlay" role="dialog" aria-label="Heroes rules">
        <div className={`card-modal card-haunt-setup ${panelClass}`}>
          <div className="card-type-label">HAUNT RULES</div>
          <h2 className="card-name">Heroes: {hauntDefinition.title}</h2>
          <p className="card-description">{hauntDefinition.introduction?.heroes || hauntDefinition.summary}</p>
          <div className="card-special">
            <strong>Hero objective</strong>
            <p>{hauntDefinition.objectives?.heroes}</p>
          </div>
          <div className="card-special">
            <strong>Hero rules</strong>
            <ul>
              {getHaunt1HeroRules().map((rule, index) => (
                <li key={`hero-rule-${index}`}>{rule}</li>
              ))}
            </ul>
          </div>
          <button className="btn btn-primary" onClick={onAdvanceRules}>
            Done
          </button>
        </div>
      </div>
    );
  }

  if (rulesStep === "traitor-prompt") {
    return (
      <div className="card-overlay" role="dialog" aria-label="Traitor rules gate">
        <div className={`card-modal card-haunt-setup ${panelClass}`}>
          <div className="card-type-label">HAUNT RULES</div>
          <h2 className="card-name">TRAITORS RULES</h2>
          <p className="card-description">Hero players should step away. {traitorName}, continue when ready.</p>
          <button className="btn btn-primary" onClick={onAdvanceRules}>
            Continue
          </button>
        </div>
      </div>
    );
  }

  if (rulesStep === "traitor-rules") {
    return (
      <div className="card-overlay" role="dialog" aria-label="Traitor rules">
        <div className={`card-modal card-haunt-setup ${panelClass}`}>
          <div className="card-type-label">HAUNT RULES</div>
          <h2 className="card-name">Traitor: {hauntDefinition.title}</h2>
          <p className="card-description">{hauntDefinition.introduction?.traitor || "You smile. Jack is back."}</p>
          <div className="card-special">
            <strong>Traitor objective</strong>
            <p>{hauntDefinition.objectives?.traitor}</p>
          </div>
          <div className="card-special">
            <strong>Traitor rules</strong>
            <ul>
              {getHaunt1TraitorRules().map((rule, index) => (
                <li key={`traitor-rule-${index}`}>{rule}</li>
              ))}
            </ul>
          </div>
          <button className="btn btn-primary" onClick={onAdvanceRules}>
            Done
          </button>
        </div>
      </div>
    );
  }

  if (rulesStep === "completed") {
    return (
      <div className="card-overlay" role="dialog" aria-label="Begin haunt">
        <div className="card-modal card-haunt-setup card-haunt-rules-heroes">
          <div className="card-type-label">HAUNT READY</div>
          <h2 className="card-name">Rules Reviewed</h2>
          <p className="card-description">
            Everyone can return to the computer. Setup-specific actions will be added next.
          </p>
          <button className="btn btn-primary" onClick={onBeginHaunt}>
            Done
          </button>
        </div>
      </div>
    );
  }

  return null;
}
