export default function HauntSetupOverlay({ game, hauntDefinition, onCompleteSetup }) {
  if (!game?.hauntState || game.gamePhase !== "hauntSetup") return null;
  if (!hauntDefinition) return null;

  const traitorIndex = game.hauntState.traitorPlayerIndex;
  const traitor = game.players[traitorIndex];
  const heroes = (game.hauntState.teams?.heroes?.playerIndexes || []).map((index) => game.players[index]).filter(Boolean);

  return (
    <div className="card-overlay" role="dialog" aria-label="Haunt setup">
      <div className="card-modal card-haunt-setup">
        <div className="card-type-label">HAUNT SETUP</div>
        <h2 className="card-name">{hauntDefinition.title}</h2>

        <p className="card-description">{hauntDefinition.introduction?.heroes || hauntDefinition.summary}</p>
        <p className="card-flavor">Traitor: {traitor?.name || "Unknown"}</p>
        <p className="card-flavor">Heroes: {heroes.map((hero) => hero.name).join(", ")}</p>

        <div className="card-special">
          <strong>Hero setup</strong>
          <ul>
            {(game.hauntState.setup?.heroSteps || []).map((step, index) => (
              <li key={`hero-setup-${index}`}>{step}</li>
            ))}
          </ul>
        </div>

        <div className="card-special">
          <strong>Traitor setup</strong>
          <ul>
            {(game.hauntState.setup?.traitorSteps || []).map((step, index) => (
              <li key={`traitor-setup-${index}`}>{step}</li>
            ))}
          </ul>
        </div>

        <div className="card-special">
          <strong>Objectives</strong>
          <p>Heroes: {hauntDefinition.objectives?.heroes}</p>
          <p>Traitor: {hauntDefinition.objectives?.traitor}</p>
        </div>

        <button className="btn btn-primary" onClick={onCompleteSetup}>
          Complete Setup
        </button>
      </div>
    </div>
  );
}
