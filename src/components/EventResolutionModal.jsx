import { formatEventResultLines, getEventRollButtonLabel } from "../events/eventUtils";

const TILE_SIZE = 100;
const GAP = 4;

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

export function DrawnCardModal({ drawnCard, drawnEventPrimaryAction, onDismissCard }) {
  if (!drawnCard) return null;

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
              {drawnEventPrimaryAction.options.map((option) => (
                <button
                  key={`drawn-event-choice-${option}`}
                  className="btn btn-primary"
                  onClick={() =>
                    onDismissCard({
                      initialEventChoice: option,
                      autoRollIfReady: true,
                    })
                  }
                >
                  {option}
                </button>
              ))}
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
              ? "Roll for Haunt"
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
  onSelectOption,
}) {
  return eventTileChoiceOptions
    .filter((option) => option.floor === cameraFloor)
    .map((option) => {
      const left = (option.x - minX) * (TILE_SIZE + GAP);
      const top = (option.y - minY) * (TILE_SIZE + GAP);
      return (
        <button
          key={`event-target-${option.id}`}
          className={`event-target-overlay ${selectedEventTileChoiceId === option.id ? "event-target-overlay-selected" : ""}`}
          style={{ left, top, width: TILE_SIZE, height: TILE_SIZE }}
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
  statLabels,
  onAdjustEventRollTotal,
  onEventAwaitingChoice,
  onContinueEvent,
  renderDiceRow,
}) {
  if (!eventState || eventState.awaiting?.type === "tile-choice") return null;

  return (
    <div className="card-overlay">
      <div className="card-modal card-event-resolution">
        <div className="card-type-label">EVENT</div>
        <h2 className="card-name">{eventState.card.name}</h2>
        {eventState.summary && !eventState.lastRoll && <p className="card-description">{eventState.summary}</p>}
        {eventState.lastRoll && (
          <>
            {diceAnimation?.purpose === "event-partial-reroll"
              ? renderDiceRow({ dice: diceAnimation.display, modifier: diceAnimation.modifier, rolling: true })
              : renderDiceRow({ dice: eventState.lastRoll.dice, modifier: eventState.lastRoll.modifier })}
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
          </>
        )}
        {eventState.awaiting?.prompt && <p className="card-description">{eventState.awaiting.prompt}</p>}
        {eventState.awaiting?.type === "choice" && (
          <div className="event-option-list">
            {eventState.awaiting.options.map((option) => (
              <button
                key={`event-choice-${option}`}
                className="btn btn-primary"
                onClick={() => onEventAwaitingChoice(option)}
              >
                {option}
              </button>
            ))}
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
        {!eventState.awaiting && (
          <button className="btn btn-primary" onClick={onContinueEvent}>
            Continue
          </button>
        )}
      </div>
    </div>
  );
}
