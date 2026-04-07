export default function HauntActionRollOverlay({
  game,
  diceAnimation,
  hauntActionRollPreview,
  onContinue,
  renderDiceRow,
}) {
  const rollState = game?.hauntActionRoll;
  if (!rollState || rollState.status !== "rolled-pending-continue" || rollState.isCollapsedRoll) return null;
  if (diceAnimation?.purpose === "haunt-action-roll" || diceAnimation?.purpose === "haunt-action-partial-reroll") {
    return null;
  }

  const lastRoll = rollState.lastRoll || { dice: [], total: null, modifier: null };

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
