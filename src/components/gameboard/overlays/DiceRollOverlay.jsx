export default function DiceRollOverlay({ diceAnimation, renderDiceRow }) {
  if (!diceAnimation || diceAnimation.settled) return null;
  if (diceAnimation.purpose === "event-damage-sequence" || diceAnimation.purpose === "event-trait-sequence-roll") return null;

  const purposeLabel =
    diceAnimation.purpose === "haunt"
      ? "HAUNT ROLL"
      : diceAnimation.purpose === "event-roll"
        ? "EVENT ROLL"
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

  return (
    <div className="card-overlay card-overlay-animation">
      <div className={`card-modal ${diceAnimation.purpose === "haunt" ? "card-haunt-rolling" : "card-tile-rolling"}`}>
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

