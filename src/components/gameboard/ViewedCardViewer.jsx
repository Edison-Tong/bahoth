import { CardAbilityContent } from "../EventResolutionModal";

export default function ViewedCardViewer({
  viewedCard,
  viewedCardActiveAbilityState,
  showMoveConfirmUseNowDisabled,
  canStartCardAttack,
  cardAttackTargets,
  handleStartCardAttack,
  handleUseViewedCardActiveAbilityNow,
  handleChooseActiveAbilityValue,
  handleCloseViewedCard,
}) {
  if (!viewedCard) return null;

  const showCardAttackButtons =
    viewedCard.activeAbilityRule?.trigger === "attack" && viewedCard.ownerIndex != null && canStartCardAttack;

  return (
    <div className="sidebar-card-viewer" role="dialog" aria-label={`${viewedCard.type} details`}>
      <div className={`card-modal card-${viewedCard.type} card-viewer`}>
        <div className="card-type-label">{viewedCard.type.toUpperCase()}</div>
        <h2 className="card-name">{viewedCard.name}</h2>
        <div className="card-owner-label">Held by {viewedCard.ownerName}</div>
        <CardAbilityContent card={viewedCard} />

        {(viewedCardActiveAbilityState?.canUseNow || showMoveConfirmUseNowDisabled) && (
          <span title={showMoveConfirmUseNowDisabled ? "Confirm your move to use" : ""}>
            <button
              className="btn btn-primary"
              onClick={handleUseViewedCardActiveAbilityNow}
              disabled={!viewedCardActiveAbilityState?.canUseNow}
            >
              Use now
            </button>
          </span>
        )}

        {viewedCard.showUseNowPicker && viewedCardActiveAbilityState?.requiresValueSelection && (
          <div className="event-option-list" style={{ marginTop: "0.75rem" }}>
            {viewedCardActiveAbilityState.valueOptions.map((option) => {
              const optionValue = typeof option === "object" && option !== null ? option.value : option;
              const optionLabel = typeof option === "object" && option !== null ? option.label : option;
              return (
                <button
                  key={`active-ability-value-${String(optionValue)}`}
                  className="btn btn-secondary"
                  onClick={() => handleChooseActiveAbilityValue(optionValue)}
                  disabled={showMoveConfirmUseNowDisabled}
                >
                  {optionLabel}
                </button>
              );
            })}
          </div>
        )}

        {showCardAttackButtons && cardAttackTargets.length > 0 && (
          <div className="event-option-list" style={{ marginTop: "0.75rem" }}>
            {cardAttackTargets.map(({ player, playerIndex }) => (
              <button
                key={`card-attack-${playerIndex}`}
                className="btn btn-danger"
                onClick={() => handleStartCardAttack(playerIndex)}
                disabled={showMoveConfirmUseNowDisabled}
              >
                Attack {player.name}
              </button>
            ))}
          </div>
        )}

        {viewedCard.flavor && <p className="card-flavor">{viewedCard.flavor}</p>}

        <button className="btn btn-primary" onClick={handleCloseViewedCard}>
          Close
        </button>
      </div>
    </div>
  );
}
