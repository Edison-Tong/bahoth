export default function DiceRollOverlay({ diceAnimation, renderDiceRow, isMyTurn = true }) {
  if (!diceAnimation || diceAnimation.settled) return null;
  if (diceAnimation.purpose === "event-damage-sequence" || diceAnimation.purpose === "event-trait-sequence-roll")
    return null;

  const purposeLabel =
    diceAnimation.purpose === "haunt"
      ? "HAUNT ROLL"
      : diceAnimation.purpose === "haunt-action-roll"
        ? "HAUNT ACTION"
        : diceAnimation.purpose === "haunt-action-partial-reroll"
          ? "HAUNT ACTION REROLL"
          : diceAnimation.purpose === "monster-speed-roll"
            ? "MONSTER MOVEMENT"
            : diceAnimation.purpose === "event-roll"
              ? "EVENT ROLL"
              : diceAnimation.purpose === "combat-attacker-roll"
                ? "ATTACKER ROLL"
                : diceAnimation.purpose === "combat-defender-roll"
                  ? "DEFENDER ROLL"
                  : diceAnimation.purpose === "event-damage-roll"
                    ? "EVENT DAMAGE ROLL"
                    : diceAnimation.purpose === "skeleton-key"
                      ? "SKELETON KEY"
                      : diceAnimation.purpose === "mystic-elevator"
                        ? "MYSTIC ELEVATOR"
                        : diceAnimation.purpose === "collapsed"
                          ? "COLLAPSED ROOM"
                          : diceAnimation.purpose === "collapsed-damage"
                            ? "COLLAPSED ROOM — DAMAGE"
                            : "FURNACE ROOM";

  if (isMyTurn === false) {
    return null;
  }

  return (
    <div className="card-overlay card-overlay-animation">
      <div
        className={`card-modal ${
          diceAnimation.purpose === "haunt" || diceAnimation.purpose === "monster-speed-roll"
            ? "card-haunt-rolling"
            : "card-tile-rolling"
        }`}
      >
        <div className="card-type-label">{purposeLabel}</div>
        {renderDiceRow({
          dice: diceAnimation.display,
          modifier: diceAnimation.modifier,
          rolling: true,
        })}
        <h2 className="card-name">Rolling...</h2>
      </div>
    </div>
  );
}
