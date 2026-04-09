import { useState } from "react";
import { formatEventResultLines, getEventRollButtonLabel } from "../events/eventUtils";

function EventCardContent({ card }) {
  const resultLines = formatEventResultLines(card.result);

  return (
    <>
      {card.todo && (
        <div className="card-ability-block">
          <div className="card-ability-label">To Do</div>
          <p className="card-description">{card.todo}</p>
        </div>
      )}
      {card.result && (
        <div className="card-special">
          <div className="card-ability-label">Result</div>
          {resultLines.map((line, index) => (
            <div key={`event-result-${card.id || card.name || "card"}-${index}`} className="card-description">
              {line}
            </div>
          ))}
        </div>
      )}
    </>
  );
}

export function CardAbilityContent({ card }) {
  if (card.type === "event") {
    return <EventCardContent card={card} />;
  }

  const primaryAbility = card.passiveAbility || card.activeAbility || card.description;
  const primaryLabel = card.passiveAbility ? "Passive Ability" : card.activeAbility ? "Active Ability" : null;
  const secondaryAbility = card.passiveAbility && card.activeAbility ? card.activeAbility : card.special;
  const secondaryLabel = card.passiveAbility && card.activeAbility ? "Active Ability" : card.special ? "Special" : null;

  return (
    <>
      {primaryAbility && (
        <div className="card-ability-block">
          {primaryLabel && <div className="card-ability-label">{primaryLabel}</div>}
          <p className="card-description">{primaryAbility}</p>
        </div>
      )}
      {secondaryAbility && (
        <div className="card-special">
          {secondaryLabel && <div className="card-ability-label">{secondaryLabel}</div>}
          {secondaryAbility}
        </div>
      )}
    </>
  );
}

const CARD_TYPE_ICON = { omen: "🔮", event: "⚡", item: "🎒" };

function CardPeek({ drawnCard, currentTurnPlayerName }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className={`card-peek card-peek-${drawnCard.type}${expanded ? " card-peek-expanded" : ""}`}
      style={{ pointerEvents: "auto" }}
    >
      <button
        className="card-peek-toggle"
        onClick={() => setExpanded((v) => !v)}
        aria-label={expanded ? "Collapse card" : "Expand card"}
      >
        <span className="card-peek-icon">{CARD_TYPE_ICON[drawnCard.type] ?? "🃏"}</span>
        <span className="card-peek-type">{drawnCard.type.toUpperCase()}</span>
        <span className="card-peek-name">{drawnCard.name}</span>
        <span className="card-peek-chevron">{expanded ? "▼" : "▲"}</span>
      </button>

      {expanded && (
        <div className="card-peek-body">
          <CardAbilityContent card={drawnCard} />
          {drawnCard.flavor && <p className="card-flavor card-peek-flavor">{drawnCard.flavor}</p>}
        </div>
      )}

      <div className="card-peek-status">
        {currentTurnPlayerName ? `${currentTurnPlayerName} is resolving...` : "Active player is resolving..."}
      </div>
    </div>
  );
}

export function DrawnCardModal({
  drawnCard,
  drawnEventPrimaryAction,
  onDismissCard,
  hauntStarted = false,
  isMyTurn = true,
  currentTurnPlayerName = "",
}) {
  if (!drawnCard) return null;

  // Non-active players: compact expandable banner, board stays fully usable
  if (!isMyTurn) {
    return <CardPeek drawnCard={drawnCard} currentTurnPlayerName={currentTurnPlayerName} />;
  }

  return (
    <div className="card-overlay">
      <div className={`card-modal card-${drawnCard.type}`}>
        <div className="card-type-label">{drawnCard.type.toUpperCase()}</div>
        <h2 className="card-name">{drawnCard.name}</h2>
        <CardAbilityContent card={drawnCard} />
        {drawnCard.flavor && <p className="card-flavor">{drawnCard.flavor}</p>}
        {drawnCard.type === "event" && drawnEventPrimaryAction?.type === "choice" ? (
          <>
            {drawnEventPrimaryAction.prompt && <p className="card-description">{drawnEventPrimaryAction.prompt}</p>}
            <div className="event-option-list">
              {drawnEventPrimaryAction.options.map((option) => {
                const isDisabled = (drawnEventPrimaryAction.disabledOptions || []).includes(option);
                return (
                  <button
                    key={`drawn-event-choice-${option}`}
                    className="btn btn-primary"
                    onClick={() =>
                      onDismissCard({
                        initialEventChoice: option,
                        autoRollIfReady: true,
                      })
                    }
                    disabled={isDisabled}
                    title={isDisabled ? "You have no eligible items to discard." : undefined}
                  >
                    {option}
                  </button>
                );
              })}
            </div>
          </>
        ) : (
          <button
            className="btn btn-primary"
            onClick={() =>
              onDismissCard({
                autoRollIfReady: drawnCard.type === "event" && drawnEventPrimaryAction?.autoRoll,
              })
            }
          >
            {drawnCard.type === "omen"
              ? hauntStarted
                ? "Continue"
                : "Roll for Haunt"
              : drawnCard.type === "event"
                ? drawnEventPrimaryAction?.label || "Continue"
                : "Continue"}
          </button>
        )}
      </div>
    </div>
  );
}

export function EventTileChoiceTargets({
  eventTileChoiceOptions,
  selectedEventTileChoiceId,
  cameraFloor,
  minX,
  minY,
  tileSize,
  gap,
  onSelectOption,
}) {
  return eventTileChoiceOptions
    .filter((option) => option.floor === cameraFloor)
    .map((option) => {
      const left = (option.x - minX) * (tileSize + gap);
      const top = (option.y - minY) * (tileSize + gap);
      return (
        <button
          key={`event-target-${option.id}`}
          className={`event-target-overlay ${selectedEventTileChoiceId === option.id ? "event-target-overlay-selected" : ""}`}
          style={{ left, top, width: tileSize, height: tileSize }}
          onClick={() => onSelectOption(option)}
          title={option.label}
        >
          <span className="explore-icon">✦</span>
        </button>
      );
    });
}

export default function EventResolutionModal({
  eventState,
  currentPlayer,
  diceAnimation,
  rabbitFootPendingReroll,
  statLabels,
  onAdjustEventRollTotal,
  onEventAwaitingChoice,
  onSelectRabbitFootDie,
  onConfirmRabbitFootReroll,
  onContinueEvent,
  renderDiceRow,
  isMyTurn = true,
  currentTurnPlayerName = "",
}) {
  if (!eventState || eventState.awaiting?.type === "tile-choice") return null;

  if (isMyTurn === false) {
    const cardName = eventState.card?.name ?? "Event";
    const summary = eventState.summary ?? "";
    return (
      <div className="mini-peek mini-peek-event">
        <span className="mini-peek-icon">📜</span>
        <div>
          <div className="mini-peek-title">EVENT{currentTurnPlayerName ? ` · ${currentTurnPlayerName}` : ""}</div>
          <div className="mini-peek-label">
            {cardName}
            {summary ? ` — ${summary}` : ""}
          </div>
        </div>
      </div>
    );
  }

  const isRabbitFootSelectionActive =
    !!rabbitFootPendingReroll &&
    !!eventState.lastRoll &&
    Array.isArray(eventState.lastRoll.dice) &&
    diceAnimation?.purpose !== "event-partial-reroll";
  const selectedRabbitFootDieIndex = rabbitFootPendingReroll?.selectedDieIndex;
  const canConfirmRabbitFootReroll =
    isRabbitFootSelectionActive &&
    Number.isInteger(selectedRabbitFootDieIndex) &&
    selectedRabbitFootDieIndex >= 0 &&
    selectedRabbitFootDieIndex < (eventState.lastRoll?.dice?.length || 0);

  return (
    <div className="card-overlay">
      <div className="card-modal card-event card-event-resolution">
        <div className="card-type-label">EVENT</div>
        <h2 className="card-name">{eventState.card.name}</h2>
        <CardAbilityContent card={{ ...eventState.card, type: "event" }} />
        {eventState.rollHistory?.length > 0 && (
          <div className="roll-history">
            {eventState.rollHistory.map((pastRoll, i) => (
              <div key={`roll-history-${i}`} className="roll-history-entry">
                <span className="roll-history-label">{pastRoll.label}:</span>
                <span className="roll-history-dice">{pastRoll.dice.join(", ")}</span>
                <span className="roll-history-total">(= {pastRoll.total})</span>
              </div>
            ))}
          </div>
        )}
        {eventState.summary && !eventState.lastRoll && <p className="card-description">{eventState.summary}</p>}
        {eventState.lastRoll && (
          <>
            {diceAnimation?.purpose === "event-partial-reroll" ? (
              renderDiceRow({ dice: diceAnimation.display, modifier: diceAnimation.modifier, rolling: true })
            ) : isRabbitFootSelectionActive ? (
              <div className="dice-row">
                <div className="dice-container">
                  {eventState.lastRoll.dice.map((die, index) => {
                    const isSelected = index === selectedRabbitFootDieIndex;
                    return (
                      <button
                        key={`rabbit-foot-die-${index}`}
                        type="button"
                        className={isSelected ? "die die-selectable die-selected" : "die die-selectable"}
                        onClick={() => onSelectRabbitFootDie(index)}
                        aria-label={`Select die ${index + 1}`}
                        aria-pressed={isSelected}
                      >
                        {die}
                      </button>
                    );
                  })}
                </div>
                {eventState.lastRoll.modifier && (
                  <div className={`dice-modifier dice-modifier-${eventState.lastRoll.modifier.tone}`}>
                    <div className="dice-modifier-value">{eventState.lastRoll.modifier.value}</div>
                    <div className="dice-modifier-label">{eventState.lastRoll.modifier.label}</div>
                  </div>
                )}
              </div>
            ) : (
              renderDiceRow({ dice: eventState.lastRoll.dice, modifier: eventState.lastRoll.modifier })
            )}
            <div className="dice-total">
              {/^[0-9]+ dice?$/.test(
                (diceAnimation?.purpose === "event-partial-reroll" ? diceAnimation.label : eventState.lastRoll.label) ||
                  ""
              )
                ? diceAnimation?.purpose === "event-partial-reroll"
                  ? diceAnimation.total
                  : eventState.lastRoll.total
                : `${diceAnimation?.purpose === "event-partial-reroll" ? diceAnimation.label : eventState.lastRoll.label}: ${
                    diceAnimation?.purpose === "event-partial-reroll" ? diceAnimation.total : eventState.lastRoll.total
                  }`}
            </div>
            {eventState.summary && <p className="card-description">{eventState.summary}</p>}
            <div className="dev-roll-tools">
              <span className="dev-roll-tools-label">Dev Roll</span>
              <button className="btn btn-secondary" onClick={() => onAdjustEventRollTotal(-1)}>
                -1
              </button>
              <button className="btn btn-secondary" onClick={() => onAdjustEventRollTotal(1)}>
                +1
              </button>
            </div>
            {isRabbitFootSelectionActive && (
              <p className="card-description">
                {canConfirmRabbitFootReroll
                  ? `Selected die ${selectedRabbitFootDieIndex + 1}. Press Reroll.`
                  : "Select one die to reroll with Rabbit's Foot, then press Reroll."}
              </p>
            )}
          </>
        )}
        {eventState.awaiting?.prompt && <p className="card-description">{eventState.awaiting.prompt}</p>}
        {eventState.awaiting?.type === "choice" && (
          <div className="event-option-list">
            {eventState.awaiting.options.map((option) => {
              const isDisabled = (eventState.awaiting.disabledOptions || []).includes(option);
              return (
                <button
                  key={`event-choice-${option}`}
                  className="btn btn-primary"
                  onClick={() => onEventAwaitingChoice(option)}
                  disabled={isDisabled}
                  title={isDisabled ? "You have no eligible items to discard." : undefined}
                >
                  {option}
                </button>
              );
            })}
          </div>
        )}
        {eventState.awaiting?.type === "step-stat-choice" && (
          <div className="event-option-list">
            {eventState.awaiting.options.map((option) => (
              <button
                key={`event-step-stat-${option}`}
                className="btn btn-primary"
                onClick={() => onEventAwaitingChoice(option)}
              >
                {`${statLabels[option]} (${currentPlayer.character[option]?.[currentPlayer.statIndex[option]] ?? 0})`}
              </button>
            ))}
          </div>
        )}
        {eventState.awaiting?.type === "stat-choice" && (
          <div className="event-option-list">
            {eventState.awaiting.options.map((option) => (
              <button
                key={`event-stat-${option}`}
                className="btn btn-primary"
                onClick={() => onEventAwaitingChoice(option)}
              >
                {`${statLabels[option]} (${currentPlayer.character[option]?.[currentPlayer.statIndex[option]] ?? 0})`}
              </button>
            ))}
          </div>
        )}
        {eventState.awaiting?.type === "item-choice" && (
          <div className="event-option-list">
            {eventState.awaiting.options.map((option) => (
              <button
                key={`event-item-${option.value}`}
                className="btn btn-primary"
                onClick={() => onEventAwaitingChoice(String(option.value))}
              >
                {option.label}
              </button>
            ))}
          </div>
        )}
        {eventState.awaiting?.type === "tile-choice" && (
          <p className="card-description">Select a highlighted tile on the board.</p>
        )}
        {eventState.awaiting?.type === "roll-ready" && (
          <button className="btn btn-primary" onClick={() => onEventAwaitingChoice("roll")}>
            {getEventRollButtonLabel(eventState.awaiting.baseDiceCount || 0)}
          </button>
        )}
        {eventState.awaiting?.type === "trait-roll-sequence-ready" && (
          <button className="btn btn-primary" onClick={() => onEventAwaitingChoice("roll-sequence")}>
            Roll
          </button>
        )}
        {(eventState.awaiting?.type === "trait-roll-sequence-rolling" ||
          eventState.awaiting?.type === "trait-roll-sequence-complete") && (
          <>
            <div className="event-option-list event-sequence-grid">
              {eventState.awaiting.stats.map((stat, index) => {
                const result = eventState.awaiting.results?.[index];
                const isRollingNow =
                  eventState.awaiting.type === "trait-roll-sequence-rolling" &&
                  eventState.awaiting.currentIndex === index &&
                  diceAnimation?.purpose === "event-trait-sequence-roll";
                const isPartialRerollNow =
                  eventState.awaiting.type === "trait-roll-sequence-complete" &&
                  diceAnimation?.purpose === "event-partial-reroll" &&
                  Number(diceAnimation.sequenceResultIndex) === index;

                return (
                  <div key={`event-trait-sequence-${stat}-${index}`}>
                    <p className="card-description">{`${statLabels[stat]} Roll`}</p>
                    {result?.dice && renderDiceRow({ dice: result.dice, modifier: result.modifier })}
                    {isRollingNow &&
                      renderDiceRow({ dice: diceAnimation.display, modifier: diceAnimation.modifier, rolling: true })}
                    {isPartialRerollNow &&
                      renderDiceRow({ dice: diceAnimation.display, modifier: diceAnimation.modifier, rolling: true })}
                    {result && <p className="card-description">Result: {result.total}</p>}
                  </div>
                );
              })}
            </div>
            {eventState.awaiting?.type === "trait-roll-sequence-complete" && (
              <button className="btn btn-primary" onClick={onContinueEvent}>
                Continue
              </button>
            )}
          </>
        )}
        {eventState.awaiting?.type === "rolling" && (
          <>
            {diceAnimation?.purpose === "event-roll" &&
              renderDiceRow({ dice: diceAnimation.display, modifier: diceAnimation.modifier, rolling: true })}
            <p className="card-description">Rolling...</p>
            {diceAnimation?.settled && (
              <button className="btn btn-primary" onClick={onContinueEvent}>
                Recover
              </button>
            )}
          </>
        )}
        {(eventState.awaiting?.type === "event-damage-sequence-ready" ||
          eventState.awaiting?.type === "event-damage-sequence-rolling" ||
          eventState.awaiting?.type === "event-damage-sequence-complete") && (
          <>
            <div className="event-option-list event-sequence-grid">
              {eventState.awaiting.effects.map((effect, index) => {
                const rolledEffect = eventState.awaiting.results?.[index];
                const isRollingNow =
                  eventState.awaiting.type === "event-damage-sequence-rolling" &&
                  eventState.awaiting.currentIndex === index &&
                  diceAnimation?.purpose === "event-damage-sequence";

                return (
                  <div key={`event-damage-sequence-${effect.damageType}-${index}`}>
                    <p className="card-description">
                      {`${effect.damageType === "physical" ? "Physical" : "Mental"} Damage Roll`}
                    </p>
                    {rolledEffect?.rolledDice && renderDiceRow({ dice: rolledEffect.rolledDice, modifier: null })}
                    {isRollingNow && renderDiceRow({ dice: diceAnimation.display, modifier: null, rolling: true })}
                    {rolledEffect?.resolvedAmount !== undefined && (
                      <p className="card-description">Result: {rolledEffect.resolvedAmount}</p>
                    )}
                  </div>
                );
              })}
            </div>
            {eventState.awaiting?.type === "event-damage-sequence-complete" && (
              <button className="btn btn-primary" onClick={onContinueEvent}>
                Okay
              </button>
            )}
          </>
        )}
        {!eventState.awaiting && isRabbitFootSelectionActive && (
          <button
            className="btn btn-primary"
            onClick={onConfirmRabbitFootReroll}
            disabled={!canConfirmRabbitFootReroll}
          >
            Reroll
          </button>
        )}
        {!eventState.awaiting && !isRabbitFootSelectionActive && (
          <button className="btn btn-primary" onClick={onContinueEvent}>
            Continue
          </button>
        )}
      </div>
    </div>
  );
}
