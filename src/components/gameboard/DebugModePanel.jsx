const STAT_ICONS = {
  might: "Might",
  speed: "Speed",
  sanity: "Sanity",
  knowledge: "Knowledge",
};

export default function DebugModePanel({
  game,
  isOpen,
  onClose,
  playerStatOrder,
  debugTileCatalog,
  selectedTileId,
  onTileChange,
  tileRotation,
  onTileRotationChange,
  rotationOptions,
  rotationDisabled,
  placementModeActive,
  selectedPlacementLabel,
  onStartPlacementMode,
  onCancelPlacementMode,
  onConfirmPlacement,
  selectedPlacementKey,
  placementOptions,
  grantType,
  onGrantTypeChange,
  grantPlayerIndex,
  onGrantPlayerChange,
  grantCardId,
  onGrantCardChange,
  grantOptions,
  onGrantCard,
  eventPlayerIndex,
  onEventPlayerChange,
  eventCardId,
  onEventCardChange,
  eventOptions,
  onActivateEvent,
  removeType,
  onRemoveTypeChange,
  removePlayerIndex,
  onRemovePlayerChange,
  removeCardKey,
  onRemoveCardKeyChange,
  removableCards,
  onRemoveCard,
  onSetPlayerStat,
}) {
  if (!isOpen) return null;

  return (
    <div className="debug-panel" role="dialog" aria-label="Debug mode">
      <div className="debug-panel-header">
        <h3>Debug Mode</h3>
        <button className="btn btn-secondary" type="button" onClick={onClose}>
          Close
        </button>
      </div>

      <div className="debug-section">
        <h4>Player Stats</h4>
        <div className="debug-player-grid">
          {game.players.map((player, playerIndex) => (
            <div key={`debug-player-${playerIndex}`} className="debug-player-card">
              <div className="debug-player-name" style={{ color: player.color }}>
                {player.name}
              </div>
              {playerStatOrder.map((stat) => (
                <div key={`debug-stat-${playerIndex}-${stat}`} className="debug-stat-row">
                  <span className="debug-stat-label">{STAT_ICONS[stat]}</span>
                  <div className="debug-stat-buttons">
                    {player.character[stat].map((value, statIndex) => {
                      const isCurrent = player.statIndex[stat] === statIndex;
                      return (
                        <button
                          key={`debug-stat-value-${playerIndex}-${stat}-${statIndex}`}
                          type="button"
                          className={`btn ${isCurrent ? "btn-primary" : "btn-secondary"}`}
                          onClick={() => onSetPlayerStat(playerIndex, stat, statIndex)}
                        >
                          {value}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      <div className="debug-section">
        <h4>Place Any Tile</h4>
        <div className="debug-form-row">
          <label>Tile</label>
          <select
            value={selectedTileId}
            onChange={(event) => onTileChange(event.target.value)}
            disabled={debugTileCatalog.length === 0}
          >
            {debugTileCatalog.length === 0 ? (
              <option value="">No available tiles</option>
            ) : (
              debugTileCatalog.map((tile) => (
                <option key={`debug-tile-${tile.id}`} value={tile.id}>
                  {tile.name} ({tile.floors.join("/")})
                </option>
              ))
            )}
          </select>
        </div>
        <div className="debug-form-row">
          <label>Rotation</label>
          <select
            value={tileRotation}
            onChange={(event) => onTileRotationChange(Number(event.target.value))}
            disabled={rotationDisabled}
          >
            {rotationDisabled ? (
              <option value={tileRotation}>Select a board spot first</option>
            ) : (
              rotationOptions.map((rotation) => (
                <option key={`debug-rotation-${rotation}`} value={rotation}>
                  {rotation * 90} degrees
                </option>
              ))
            )}
          </select>
        </div>
        <div className="debug-form-row">
          <label>Placement Flow</label>
          {!placementModeActive ? (
            <button
              className="btn btn-primary"
              type="button"
              disabled={placementOptions.length === 0}
              onClick={onStartPlacementMode}
            >
              Place Now
            </button>
          ) : (
            <>
              <div className="debug-inline-note">Select a highlighted spot on the board, then confirm.</div>
              <div className="debug-inline-note">
                {selectedPlacementKey ? `Selected: ${selectedPlacementLabel}` : "No spot selected yet."}
              </div>
              <div className="debug-button-row">
                <button
                  className="btn btn-primary"
                  type="button"
                  disabled={!selectedPlacementKey}
                  onClick={onConfirmPlacement}
                >
                  Confirm Placement
                </button>
                <button className="btn btn-secondary" type="button" onClick={onCancelPlacementMode}>
                  Cancel
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="debug-section">
        <h4>Grant Undrawn Item/Omen</h4>
        <div className="debug-form-row">
          <label>Type</label>
          <select value={grantType} onChange={(event) => onGrantTypeChange(event.target.value)}>
            <option value="item">Item</option>
            <option value="omen">Omen</option>
          </select>
        </div>
        <div className="debug-form-row">
          <label>Player</label>
          <select value={grantPlayerIndex} onChange={(event) => onGrantPlayerChange(Number(event.target.value))}>
            {game.players.map((player, playerIndex) => (
              <option key={`debug-grant-player-${playerIndex}`} value={playerIndex}>
                {player.name}
              </option>
            ))}
          </select>
        </div>
        <div className="debug-form-row">
          <label>Undrawn Card</label>
          <select value={grantCardId} onChange={(event) => onGrantCardChange(event.target.value)}>
            {grantOptions.length === 0 && <option value="">No cards left</option>}
            {grantOptions.map((option) => (
              <option key={`debug-grant-card-${option.id}`} value={option.id}>
                {option.name} x{option.count}
              </option>
            ))}
          </select>
        </div>
        <button
          className="btn btn-primary"
          type="button"
          disabled={!grantCardId || grantOptions.length === 0}
          onClick={onGrantCard}
        >
          Grant Card
        </button>
      </div>

      <div className="debug-section">
        <h4>Activate Event For Any Character</h4>
        <div className="debug-form-row">
          <label>Character</label>
          <select value={eventPlayerIndex} onChange={(event) => onEventPlayerChange(Number(event.target.value))}>
            {game.players.map((player, playerIndex) => (
              <option key={`debug-event-player-${playerIndex}`} value={playerIndex}>
                {player.name}
              </option>
            ))}
          </select>
        </div>
        <div className="debug-form-row">
          <label>Event Card</label>
          <select value={eventCardId} onChange={(event) => onEventCardChange(event.target.value)}>
            {eventOptions.length === 0 && <option value="">No events left</option>}
            {eventOptions.map((option) => (
              <option key={`debug-event-card-${option.id}`} value={option.id}>
                {option.name} x{option.count}
              </option>
            ))}
          </select>
        </div>
        <button
          className="btn btn-primary"
          type="button"
          disabled={!eventCardId || eventOptions.length === 0}
          onClick={onActivateEvent}
        >
          Activate Event
        </button>
      </div>

      <div className="debug-section">
        <h4>Take Card From Player</h4>
        <div className="debug-form-row">
          <label>Type</label>
          <select value={removeType} onChange={(event) => onRemoveTypeChange(event.target.value)}>
            <option value="item">Item</option>
            <option value="omen">Omen</option>
          </select>
        </div>
        <div className="debug-form-row">
          <label>Player</label>
          <select value={removePlayerIndex} onChange={(event) => onRemovePlayerChange(Number(event.target.value))}>
            {game.players.map((player, playerIndex) => (
              <option key={`debug-remove-player-${playerIndex}`} value={playerIndex}>
                {player.name}
              </option>
            ))}
          </select>
        </div>
        <div className="debug-form-row">
          <label>Owned Card</label>
          <select value={removeCardKey} onChange={(event) => onRemoveCardKeyChange(event.target.value)}>
            {removableCards.length === 0 && <option value="">No cards of this type</option>}
            {removableCards.map((card, index) => (
              <option key={`debug-remove-card-${card.id}-${index}`} value={card.key}>
                {card.name}
              </option>
            ))}
          </select>
        </div>
        <button
          className="btn btn-primary"
          type="button"
          disabled={!removeCardKey || removableCards.length === 0}
          onClick={onRemoveCard}
        >
          Take Card
        </button>
      </div>
    </div>
  );
}
