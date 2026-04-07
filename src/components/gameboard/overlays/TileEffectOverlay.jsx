export default function TileEffectOverlay({
  game,
  statLabels,
  isSkeletonKeyResultEffect,
  renderDiceRow,
  onSelectRabbitFootDie,
  onConfirmRabbitFootReroll,
  onChooseNecklaceOfTeethStat,
  onSkipNecklaceOfTeethGain,
  onDrawIdolEventCard,
  onSkipIdolEventCard,
  onRollCollapsedStability,
  onContinueCollapsedRoll,
  onStartCollapsedDamage,
  onDismissTileEffect,
}) {
  if (!game?.tileEffect) return null;
  const te = game.tileEffect;

  const isRabbitFootSkeletonKey =
    isSkeletonKeyResultEffect(te) && game.rabbitFootPendingReroll?.sourceType === "skeleton-key-roll";
  const isRabbitFootCollapsedRoll =
    te.type === "collapsed-roll-result" && game.rabbitFootPendingReroll?.sourceType === "haunt-action-roll";

  const modalTone =
    te.type === "laundry-chute"
      ? "card-tile-neutral"
      : te.type === "collapsed-prompt"
        ? "card-tile-danger"
        : te.type === "collapsed-roll-result"
          ? te.total >= 5
            ? "card-tile-safe"
            : "card-tile-danger"
          : te.type === "collapsed-pending"
            ? "card-tile-danger"
            : te.damage > 0 || te.collapsed
              ? "card-tile-danger"
              : "card-tile-safe";

  return (
    <div className="card-overlay">
      <div className={`card-modal card-tile-effect ${modalTone}`}>
        <div className="card-type-label">{te.tileName}</div>

        {te.dice &&
          !isRabbitFootSkeletonKey &&
          !isRabbitFootCollapsedRoll &&
          renderDiceRow({ dice: te.dice, modifier: te.diceModifier, rolling: false })}

        {te.total !== undefined && <div className="dice-total">Total: {te.total}</div>}

        {te.collapsed && te.damageDice.length > 0 && (
          <>
            <div className="dice-total" style={{ marginTop: "0.5rem" }}>
              Damage roll:
            </div>
            {renderDiceRow({ dice: te.damageDice, modifier: te.damageDiceModifier, rolling: false })}
          </>
        )}

        {isRabbitFootSkeletonKey && (
          <div className="dice-row">
            <div className="dice-container">
              {(te.dice || []).map((die, index) => {
                const selected = game.rabbitFootPendingReroll?.selectedDieIndex === index;
                return (
                  <button
                    key={`skeleton-key-rabbit-foot-die-${index}`}
                    type="button"
                    className={selected ? "die die-selectable die-selected" : "die die-selectable"}
                    onClick={() => onSelectRabbitFootDie(index)}
                  >
                    {die}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {isRabbitFootCollapsedRoll && (
          <div className="dice-row">
            <div className="dice-container">
              {(te.dice || []).map((die, index) => {
                const selected = game.rabbitFootPendingReroll?.selectedDieIndex === index;
                return (
                  <button
                    key={`collapsed-rabbit-foot-die-${index}`}
                    type="button"
                    className={selected ? "die die-selectable die-selected" : "die die-selectable"}
                    onClick={() => onSelectRabbitFootDie(index)}
                  >
                    {die}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <p className="card-description">{te.message}</p>

        {isRabbitFootSkeletonKey || isRabbitFootCollapsedRoll ? (
          <button
            className="btn btn-primary"
            onClick={onConfirmRabbitFootReroll}
            disabled={!Number.isInteger(game.rabbitFootPendingReroll?.selectedDieIndex)}
          >
            Reroll
          </button>
        ) : te.type === "necklace-of-teeth-choice" ? (
          <>
            <div className="event-option-list" style={{ marginTop: "0.75rem" }}>
              {(te.statOptions || []).map((stat) => (
                <button
                  key={`necklace-stat-${stat}`}
                  className="btn btn-secondary"
                  onClick={() => onChooseNecklaceOfTeethStat(stat)}
                >
                  Gain 1 {statLabels[stat]}
                </button>
              ))}
            </div>
            <button className="btn btn-primary" onClick={onSkipNecklaceOfTeethGain}>
              Skip
            </button>
          </>
        ) : te.type === "idol-event-choice" ? (
          <>
            <button className="btn btn-secondary" onClick={onDrawIdolEventCard}>
              Draw Event card
            </button>
            <button className="btn btn-primary" onClick={onSkipIdolEventCard}>
              Skip Event card
            </button>
          </>
        ) : te.type === "collapsed-roll-result" ? (
          <button className="btn btn-primary" onClick={onContinueCollapsedRoll}>
            Continue
          </button>
        ) : te.type === "collapsed-prompt" ? (
          <button className="btn btn-primary" onClick={onRollCollapsedStability}>
            Roll for Stability
          </button>
        ) : te.type === "collapsed-pending" ? (
          <button className="btn btn-primary" onClick={onStartCollapsedDamage}>
            Roll for damage
          </button>
        ) : (
          <button className="btn btn-primary" onClick={onDismissTileEffect}>
            {te.type === "mystic-elevator-result" && te.pendingSpecialPlacement ? "Choose doorway" : "Continue"}
          </button>
        )}
      </div>
    </div>
  );
}
