export default function HauntActionRollOverlay({
  game,
  diceAnimation,
  hauntActionRollPreview,
  onContinue,
  renderDiceRow,
  isMyTurn = true,
}) {
  const rollState = game?.hauntActionRoll;
  if (!rollState || rollState.status !== "rolled-pending-continue" || rollState.isCollapsedRoll) return null;
  if (diceAnimation?.purpose === "haunt-action-roll" || diceAnimation?.purpose === "haunt-action-partial-reroll") {
    return null;
  }

  const lastRoll = rollState.lastRoll || { dice: [], total: null, modifier: null };

  if (isMyTurn === false) {
    const outcomeLabel = hauntActionRollPreview?.outcomeLabel || "Result";
    const total = hauntActionRollPreview?.totalLabel || lastRoll.total || 0;
    return (
      <div className="mini-peek mini-peek-haunt">
        <span className="mini-peek-icon">🎲</span>
        <div>
          <div className="mini-peek-title">HAUNT ACTION • Total: {total}</div>
          <div className="mini-peek-label">{outcomeLabel}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="card-overlay" role="dialog" aria-label="Haunt action roll result">
      <div className="card-modal card-haunt-rolling">
        <div className="card-type-label">HAUNT ACTION</div>
        <h2 className="card-name">{hauntActionRollPreview?.title || "Action Roll"}</h2>

        {renderDiceRow({
          dice: Array.isArray(lastRoll.dice) ? lastRoll.dice : [],
          modifier: lastRoll.modifier || null,
          rolling: false,
        })}

        <p className="dice-total">Total: {hauntActionRollPreview?.totalLabel || lastRoll.total || 0}</p>
        {hauntActionRollPreview?.thresholdLabel && (
          <p className="dice-target">{hauntActionRollPreview.thresholdLabel}</p>
        )}

        <div className="card-special">
          <strong>{hauntActionRollPreview?.outcomeLabel || "Result"}</strong>
          <p>{hauntActionRollPreview?.outcomeDescription || "Press Continue to apply this result."}</p>
        </div>

        <button className="btn btn-confirm" onClick={onContinue}>
          Continue
        </button>
      </div>
    </div>
  );
}
