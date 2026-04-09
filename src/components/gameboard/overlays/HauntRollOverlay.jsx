export default function HauntRollOverlay({ game, diceAnimation, onDismissHauntRoll, renderDiceRow, isMyTurn = true }) {
  if (!game?.hauntRoll) return null;
  if (!diceAnimation?.settled || diceAnimation.purpose !== "haunt") return null;

  const { hauntTriggered, total, omenCount, dice } = game.hauntRoll;

  if (isMyTurn === false) {
    return (
      <div className={`mini-peek ${hauntTriggered ? "mini-peek-haunt" : "mini-peek-safe"}`}>
        <span className="mini-peek-icon">{hauntTriggered ? "💀" : "🕯️"}</span>
        <div>
          <div className="mini-peek-title">HAUNT ROLL • Total: {total}</div>
          <div className="mini-peek-label">{hauntTriggered ? "The Haunt Begins!" : "Safe… for now."}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="card-overlay">
      <div className={`card-modal ${hauntTriggered ? "card-haunt-triggered" : "card-haunt-safe"}`}>
        <div className="card-type-label">HAUNT ROLL</div>
        {renderDiceRow({ dice, modifier: null, rolling: false })}
        <div className="dice-total">Total: {total}</div>
        <div className="dice-target">Need less than 5 to be safe</div>
        <h2 className="card-name">{hauntTriggered ? "THE HAUNT BEGINS!" : "Safe... for now."}</h2>
        <p className="card-description">
          {hauntTriggered
            ? `Rolled ${total} with ${omenCount} dice — 5 or higher! The haunt is upon you!`
            : `Rolled ${total} with ${omenCount} dice — less than 5. The house spares you... for now.`}
        </p>
        <button className="btn btn-primary" onClick={onDismissHauntRoll}>
          Continue
        </button>
      </div>
    </div>
  );
}
