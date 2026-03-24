function CombatRollSummary({ label, state, playerName }) {
  if (!state || state.total == null) {
    return (
      <div className="combat-roll-card combat-roll-card-pending">
        <div className="combat-roll-label">{label}</div>
        <div className="combat-roll-name">{playerName}</div>
        <div className="combat-roll-value">Waiting...</div>
      </div>
    );
  }

  return (
    <div className="combat-roll-card">
      <div className="combat-roll-label">{label}</div>
      <div className="combat-roll-name">{playerName}</div>
      <div className="combat-roll-value">{state.total}</div>
      <div className="dice-container combat-roll-dice-container">
        {state.dice.map((die, index) => (
          <div key={`combat-die-${label}-${index}`} className="die">
            {die}
          </div>
        ))}
      </div>
      {(state.itemMessages || []).length > 0 && (
        <div className="combat-roll-detail">{state.itemMessages.join(" | ")}</div>
      )}
    </div>
  );
}

export default function CombatOverlay({
  combatState,
  diceAnimation,
  players,
  attackerItemOptions,
  defenderItemOptions,
  onRollAttacker,
  onRollDefender,
  onUseAttackerItem,
  onUseDefenderItem,
  onContinueAttacker,
  onContinueDefender,
  onAdvanceResolution,
}) {
  if (!combatState) return null;

  const isCombatRollAnimating =
    !!diceAnimation &&
    (diceAnimation.purpose === "combat-attacker-roll" || diceAnimation.purpose === "combat-defender-roll") &&
    !diceAnimation.settled;

  if (isCombatRollAnimating) return null;

  const attacker = players[combatState.attackerIndex];
  const defender = players[combatState.defenderIndex];
  const attackerName = attacker?.name || "Attacker";
  const defenderName = defender?.name || "Defender";

  const phase = combatState.phase;
  const outcome = combatState.outcome || null;

  return (
    <div className="card-overlay" role="dialog" aria-label="Combat">
      <div className="card-modal card-combat">
        <div className="card-type-label">COMBAT</div>
        <h2 className="card-name">
          {attackerName} vs {defenderName}
        </h2>

        <div className="combat-roll-grid">
          <CombatRollSummary label="Attacker" state={combatState.attacker} playerName={attackerName} />
          <CombatRollSummary label="Defender" state={combatState.defender} playerName={defenderName} />
        </div>

        {phase === "attacker-roll" && (
          <div className="combat-controls">
            <p className="card-description">Attacker rolls Might first.</p>
            <button className="btn btn-primary" onClick={onRollAttacker}>
              Roll Attacker
            </button>
          </div>
        )}

        {phase === "attacker-item" && (
          <div className="combat-controls">
            <div className="combat-item-buttons">
              {attackerItemOptions.map((item) => (
                <button
                  key={item.key}
                  className="btn btn-secondary"
                  onClick={() => onUseAttackerItem(item.key)}
                  disabled={!item.canUse}
                  title={item.disabledReason || undefined}
                >
                  Use {item.name}
                </button>
              ))}
            </div>
            <button className="btn btn-primary" onClick={onContinueAttacker}>
              Continue
            </button>
          </div>
        )}

        {phase === "defender-roll" && (
          <div className="combat-controls">
            <p className="card-description">Defender rolls Might.</p>
            <button className="btn btn-primary" onClick={onRollDefender}>
              Roll Defender
            </button>
          </div>
        )}

        {phase === "defender-item" && (
          <div className="combat-controls">
            <div className="combat-item-buttons">
              {defenderItemOptions.map((item) => (
                <button
                  key={item.key}
                  className="btn btn-secondary"
                  onClick={() => onUseDefenderItem(item.key)}
                  disabled={!item.canUse}
                  title={item.disabledReason || undefined}
                >
                  Use {item.name}
                </button>
              ))}
            </div>
            <button className="btn btn-primary" onClick={onContinueDefender}>
              Continue
            </button>
          </div>
        )}

        {phase === "resolution" && outcome && (
          <div className="combat-controls">
            <p className="card-description">
              {outcome.tie
                ? `Tie at ${outcome.attackerTotal}. No damage dealt.`
                : `${outcome.winnerName} wins. ${outcome.loserName} takes ${outcome.damage} Physical damage.`}
            </p>
            <button className="btn btn-primary" onClick={onAdvanceResolution}>
              {outcome.tie ? "Continue" : "Allocate Damage"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
