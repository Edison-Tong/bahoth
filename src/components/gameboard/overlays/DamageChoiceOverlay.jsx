export default function DamageChoiceOverlay({
  damageChoice,
  currentPlayer,
  damageAllocated,
  damageRemaining,
  canConfirmDamageChoice,
  damagePreview,
  statLabels,
  criticalStatIndex,
  formatStatTrackValue,
  getStatTrackCellClass,
  formatSourceNames,
  onToggleDamageConversion,
  onAdjustDamageAllocation,
  onConfirmDamageChoice,
}) {
  function describePostDamageEffects(effects) {
    if (!effects || effects.length === 0) return "";
    return effects
      .map((effect) => `gain ${effect.amount} ${statLabels[effect.stat]} from ${effect.sourceName}`)
      .join(" and ");
  }

  if (!damageChoice) return null;

  return (
    <div className="card-overlay">
      <div className="card-modal card-damage-choice">
        <div className="card-type-label">
          {damageChoice.adjustmentMode === "increase" ? "STAT GAIN" : `${damageChoice.damageType.toUpperCase()} DAMAGE`}
        </div>
        <h2 className="card-name">
          {damageChoice.adjustmentMode === "increase" ? "Choose where the gain goes" : "Choose where the damage goes"}
        </h2>
        <p className="card-description">
          {damageChoice.adjustmentMode === "increase" ? (
            `Assign ${damageChoice.amount} point${damageChoice.amount === 1 ? "" : "s"} of gain to ${damageChoice.playerName}.`
          ) : damageChoice.allowPartial ? (
            `Assign up to ${damageChoice.amount} point${damageChoice.amount === 1 ? "" : "s"} of ${damageChoice.damageType} damage to ${damageChoice.playerName}.`
          ) : (
            `Assign ${damageChoice.amount} point${damageChoice.amount === 1 ? "" : "s"} of ${damageChoice.damageType} damage to ${damageChoice.playerName}.`
          )}
        </p>

        {damageChoice.adjustmentMode !== "increase" && damageChoice.canConvertToGeneral && (
          <div className="damage-conversion-panel">
            <div className="damage-conversion-copy">
              {damageChoice.damageType === "general"
                ? `Taking this as General damage via ${formatSourceNames(damageChoice.conversionSourceNames)}.`
                : `${formatSourceNames(damageChoice.conversionSourceNames)} can convert this to General damage.`}
            </div>
            <button className="btn btn-secondary damage-conversion-button" onClick={onToggleDamageConversion}>
              {damageChoice.damageType === "general" ? `Use ${damageChoice.originalDamageType} damage` : "Take as General Damage"}
            </button>
          </div>
        )}

        {damageChoice.adjustmentMode !== "increase" && damageChoice.postDamageEffects.length > 0 && (
          <p className="damage-choice-hint">After taking damage: {describePostDamageEffects(damageChoice.postDamageEffects)}.</p>
        )}

        <p className="damage-choice-hint">
          Use {damageChoice.adjustmentMode === "increase" ? "+" : "-"} to assign this change to a trait.
        </p>

        <div className="damage-choice-status">
          <span>Assigned: {damageAllocated}</span>
          <span>Remaining: {damageRemaining}</span>
        </div>

        <div className="damage-choice-list">
          {damageChoice.allowedStats.map((stat) => {
            const assigned = damageChoice.allocation[stat] || 0;
            const currentIndex = currentPlayer.statIndex[stat];
            const previewIndex = damagePreview[stat];
            const maxIncrease = currentPlayer.character[stat].length - 1 - currentIndex;
            const canAllocate =
              damageChoice.adjustmentMode === "increase"
                ? damageRemaining > 0 && assigned < maxIncrease
                : damageRemaining > 0 && assigned < currentIndex;

            const canUndo = assigned > 0;
            const minusDelta = damageChoice.adjustmentMode === "increase" ? -1 : 1;
            const plusDelta = damageChoice.adjustmentMode === "increase" ? 1 : -1;
            const minusEnabled = minusDelta > 0 ? canAllocate : canUndo;
            const plusEnabled = plusDelta > 0 ? canAllocate : canUndo;

            return (
              <div key={stat} className="damage-choice-row">
                <div className="damage-choice-stat">
                  <div className="damage-choice-stat-header">
                    <div className="damage-choice-stat-name">{statLabels[stat]}</div>
                  </div>
                  <div className="stat-track-numbers" aria-label={`${statLabels[stat]} track`}>
                    {currentPlayer.character[stat].map((value, index) => (
                      <div
                        key={`${stat}-${index}`}
                        className={[
                          getStatTrackCellClass(index, currentIndex, previewIndex, damageChoice.adjustmentMode),
                          index === criticalStatIndex ? "stat-track-cell-critical" : "",
                          value === 0 ? "stat-track-cell-zero" : "",
                        ]
                          .filter(Boolean)
                          .join(" ")}
                      >
                        {formatStatTrackValue(value)}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="damage-choice-controls">
                  <button
                    className="btn btn-secondary damage-choice-button"
                    onClick={() => onAdjustDamageAllocation(stat, minusDelta)}
                    disabled={!minusEnabled}
                    aria-label={`- ${statLabels[stat]}`}
                  >
                    -
                  </button>
                  <div className="damage-choice-count">{assigned}</div>
                  <button
                    className="btn btn-primary damage-choice-button"
                    onClick={() => onAdjustDamageAllocation(stat, plusDelta)}
                    disabled={!plusEnabled}
                    aria-label={`+ ${statLabels[stat]}`}
                  >
                    +
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <button className="btn btn-primary" onClick={onConfirmDamageChoice} disabled={!canConfirmDamageChoice}>
          {damageChoice.adjustmentMode === "increase" ? "Apply gain" : "Apply damage"}
        </button>
      </div>
    </div>
  );
}

