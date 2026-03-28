import { getHauntActionAvailabilityState } from "../../../haunts/hauntDomain";

export default function HauntActionOverlay({ game, hauntDefinition, canUseLearnAboutJack, onUseLearnAboutJack }) {
  if (!game?.hauntState || game.gamePhase !== "hauntActive") return null;
  if (!hauntDefinition) return null;

  const traitorIndex = game.hauntState.traitorPlayerIndex;
  const currentPlayer = game.players[game.currentPlayerIndex];
  const isTraitorTurn = game.currentPlayerIndex === traitorIndex;
  const tokenHolders = game.hauntState.scenarioState?.revealedKnowledgeOfJackHolders || [];
  const hauntActionAvailability = getHauntActionAvailabilityState(game, { hauntActionLocked: false });

  return (
    <div className="sidebar-card-viewer haunt-action-viewer" role="dialog" aria-label="Haunt actions">
      <div className="card-modal card-haunt-active card-viewer">
        <div className="card-type-label">HAUNT ACTIVE</div>
        <h2 className="card-name">{hauntDefinition.title}</h2>

        <p className="card-description">
          Turn: <strong>{currentPlayer?.name}</strong> ({isTraitorTurn ? "Traitor" : "Hero"})
        </p>

        <div className="card-special">
          <strong>Hero objective</strong>
          <p>{hauntDefinition.objectives?.heroes}</p>
          <strong>Traitor objective</strong>
          <p>{hauntDefinition.objectives?.traitor}</p>
          <strong>Knowledge of Jack holders</strong>
          <p>
            {tokenHolders.length > 0
              ? tokenHolders
                  .map((index) => game.players[index]?.name)
                  .filter(Boolean)
                  .join(", ")
              : "None"}
          </p>
        </div>

        {hauntActionAvailability.learnAboutJack && (
          <button className="btn btn-primary" onClick={onUseLearnAboutJack} disabled={!canUseLearnAboutJack}>
            Learn about Jack (Library)
          </button>
        )}
      </div>
    </div>
  );
}
