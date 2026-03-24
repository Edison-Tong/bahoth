import { isItemTradeLockedThisTurn } from "../../omens/dogAbility";

export default function TradeViewer({ game, tradeState, handlers, actionsDisabled = false }) {
  const {
    handleToggleDogOwnerGive,
    handleToggleDogOwnerGiveOmen,
    handleToggleDogTargetGive,
    handleToggleDogTargetGiveOmen,
    handleConfirmDogTrade,
    handleBackToDogMove,
    handleCancelDogTrade,
  } = handlers || {};

  if (!tradeState || tradeState.phase !== "trade") return null;

  const owner = game.players[tradeState.ownerIndex];
  const selectedTarget = game.players[tradeState.targetPlayerIndex];
  const selectedTargetIndex = tradeState.targetPlayerIndex;

  return (
    <div className="sidebar-card-viewer" role="dialog" aria-label="Trade">
      <div className="card-modal card-viewer">
        <div className="card-type-label">TRADE</div>
        <h2 className="card-name">{tradeState.mode === "dog-remote" ? "Dog Trade" : "Player Trade"}</h2>

        <>
          {tradeState.mode === "dog-remote" ? (
            <p>
              Dog is on {tradeState.floor}. Pick any cards Dog carries from {owner?.name} and cards the target willingly
              sends back.
            </p>
          ) : (
            <p>Choose any number of cards each player gives. Trade completes only when both agree.</p>
          )}

          <div style={{ marginBottom: "0.75rem" }}>
            Trading with <strong>{selectedTarget?.name || "Unknown"}</strong>
          </div>

          <h3 style={{ marginTop: 0 }}>Send From {owner?.name}</h3>
          <div className="event-option-list" style={{ marginBottom: "0.75rem" }}>
            {[
              ...(owner?.inventory || []).map((card, index) => ({
                kind: "item",
                index,
                card,
                selected: (tradeState.ownerGiveIndexes || []).includes(index),
                locked: isItemTradeLockedThisTurn(card, game.turnNumber),
              })),
              ...(owner?.omens || []).map((card, index) => {
                const isActiveDogOmen = tradeState.mode === "dog-remote" && index === tradeState.dogOmenIndex;
                return {
                  kind: "omen",
                  index,
                  card,
                  selected: (tradeState.ownerGiveOmenIndexes || []).includes(index),
                  locked: isActiveDogOmen || isItemTradeLockedThisTurn(card, game.turnNumber),
                  lockReason: isActiveDogOmen ? " (currently in use)" : "",
                };
              }),
            ].map((entry) => (
              <button
                key={`trade-owner-give-${entry.kind}-${entry.index}`}
                className={`${entry.selected ? "btn btn-primary" : "btn btn-secondary"} trade-option-btn trade-option-${entry.kind}`}
                onClick={() =>
                  entry.kind === "item"
                    ? handleToggleDogOwnerGive(entry.index)
                    : handleToggleDogOwnerGiveOmen(entry.index)
                }
                disabled={actionsDisabled || entry.locked}
              >
                {entry.selected ? "[Send] " : ""}
                {entry.card.name}
                {entry.locked ? entry.lockReason || " (used this turn)" : ""}
              </button>
            ))}
            {(owner?.inventory || []).length + (owner?.omens || []).length === 0 && (
              <div className="sidebar-card-empty">No cards to send</div>
            )}
          </div>

          <h3 style={{ marginTop: 0 }}>Receive From {selectedTarget?.name || "Target"}</h3>
          <div className="event-option-list" style={{ marginBottom: "0.75rem" }}>
            {[
              ...(selectedTarget?.inventory || []).map((card, index) => ({
                kind: "item",
                index,
                card,
                selected: (tradeState.targetGiveIndexes || []).includes(index),
                locked: isItemTradeLockedThisTurn(card, game.turnNumber),
              })),
              ...(selectedTarget?.omens || []).map((card, index) => ({
                kind: "omen",
                index,
                card,
                selected: (tradeState.targetGiveOmenIndexes || []).includes(index),
                locked: isItemTradeLockedThisTurn(card, game.turnNumber),
              })),
            ].map((entry) => (
              <button
                key={`trade-target-give-${selectedTargetIndex}-${entry.kind}-${entry.index}`}
                className={`${entry.selected ? "btn btn-primary" : "btn btn-secondary"} trade-option-btn trade-option-${entry.kind}`}
                onClick={() =>
                  entry.kind === "item"
                    ? handleToggleDogTargetGive(entry.index)
                    : handleToggleDogTargetGiveOmen(entry.index)
                }
                disabled={actionsDisabled || entry.locked}
              >
                {entry.selected ? "[Offer] " : ""}
                {entry.card.name}
                {entry.locked ? " (used this turn)" : ""}
              </button>
            ))}
            {(selectedTarget?.inventory || []).length + (selectedTarget?.omens || []).length === 0 && (
              <div className="sidebar-card-empty">No cards offered</div>
            )}
          </div>
        </>

        <button className="btn btn-primary" onClick={handleConfirmDogTrade} disabled={actionsDisabled}>
          Confirm Trade
        </button>
        {tradeState.mode === "dog-remote" && (
          <button className="btn btn-secondary" onClick={handleBackToDogMove} disabled={actionsDisabled}>
            Back to Dog Movement
          </button>
        )}
        <button className="btn btn-secondary" onClick={handleCancelDogTrade} disabled={actionsDisabled}>
          Cancel
        </button>
      </div>
    </div>
  );
}
