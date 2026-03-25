export default function GameBoardActions({
  eventState,
  selectedEventTileChoiceId,
  handleConfirmEventTileChoice,
  tradeState,
  game,
  handleConfirmMove,
  stairTarget,
  stairIsBacktrack,
  handleChangeFloor,
  canUseMysticElevator,
  handleRollMysticElevator,
  canUseSecretPassage,
  secretPassageTargets,
  handleUseSecretPassage,
  currentPlayer,
  handleRotateTile,
  handlePlaceTile,
  isItemAbilityTileChoiceAwaiting,
  endTurnPreviewPlayerName,
  handleEndTurn,
  playerTradeTargetsOnTile,
  handleStartPlayerTrade,
  combatTargetsOnTile,
  handleStartCombat,
  dogStairMoveOption,
  handleMoveDogToken,
  dogStairDestination,
  dogTradeTargetsOnTile,
  handleStartDogTrade,
  handleCancelDogTrade,
  controlsDisabled,
}) {
  const isPathTracking = !tradeState && game.turnPhase === "move" && game.movePath.length > 1;

  return (
    <div className="game-actions">
      {eventState?.awaiting?.type === "tile-choice" && (
        <button
          className="btn btn-confirm"
          onClick={handleConfirmEventTileChoice}
          disabled={controlsDisabled || !selectedEventTileChoiceId}
        >
          Confirm Placement
        </button>
      )}
      {!tradeState && game.turnPhase === "move" && game.movePath.length > 1 && (
        <button className="btn btn-confirm" onClick={handleConfirmMove} disabled={controlsDisabled}>
          Move Here
        </button>
      )}
      {!tradeState && stairTarget && (
        <button className="btn btn-stairs" onClick={handleChangeFloor} disabled={controlsDisabled}>
          {stairIsBacktrack ? `Go back to ${stairTarget.name}` : `Move to ${stairTarget.name}`}
        </button>
      )}
      {!tradeState && !isPathTracking && canUseMysticElevator && (
        <button className="btn btn-stairs" onClick={handleRollMysticElevator} disabled={controlsDisabled}>
          Use Elevator
        </button>
      )}
      {!tradeState &&
        !isPathTracking &&
        canUseSecretPassage &&
        secretPassageTargets.map((target) => (
          <button
            key={`secret-passage-${target.floor}-${target.x}-${target.y}`}
            className="btn btn-stairs"
            onClick={() => handleUseSecretPassage(target)}
            disabled={controlsDisabled || currentPlayer.movesLeft < 1}
          >
            {`Move to ${target.name} (${target.floor})`}
          </button>
        ))}
      {game.turnPhase === "rotate" && (
        <>
          <button className="btn btn-rotate" onClick={() => handleRotateTile(-1)} disabled={controlsDisabled}>
            ↺ Rotate Left
          </button>
          <button className="btn btn-confirm" onClick={handlePlaceTile} disabled={controlsDisabled}>
            Place Tile
          </button>
          <button className="btn btn-rotate" onClick={() => handleRotateTile(1)} disabled={controlsDisabled}>
            Rotate Right ↻
          </button>
        </>
      )}
      {(game.turnPhase === "endTurn" || game.turnPhase === "move") &&
        !game.pendingExplore &&
        !tradeState &&
        !isPathTracking &&
        !isItemAbilityTileChoiceAwaiting(eventState) && (
          <button className="btn btn-primary" onClick={handleEndTurn} disabled={controlsDisabled}>
            End Turn — Pass to {endTurnPreviewPlayerName}
          </button>
        )}

      {!tradeState &&
        game.turnPhase === "move" &&
        !game.pendingExplore &&
        !isPathTracking &&
        !isItemAbilityTileChoiceAwaiting(eventState) &&
        combatTargetsOnTile.length > 0 &&
        combatTargetsOnTile.map(({ player, playerIndex }) => (
          <button
            key={`combat-start-${playerIndex}`}
            className="btn btn-danger"
            onClick={() => handleStartCombat(playerIndex)}
            disabled={controlsDisabled}
          >
            Attack {player.name}
          </button>
        ))}

      {!tradeState &&
        game.turnPhase === "move" &&
        !game.pendingExplore &&
        !isPathTracking &&
        !isItemAbilityTileChoiceAwaiting(eventState) &&
        playerTradeTargetsOnTile.length > 0 &&
        playerTradeTargetsOnTile.map(({ player, playerIndex }) => (
          <button
            key={`player-trade-start-${playerIndex}`}
            className="btn btn-trade"
            onClick={() => handleStartPlayerTrade(playerIndex)}
            disabled={controlsDisabled}
          >
            Trade with {player.name}
          </button>
        ))}

      {tradeState?.phase === "move" && (
        <>
          <button className="btn btn-secondary" disabled>
            Dog moves left: {tradeState.movesLeft}
          </button>
          {dogStairMoveOption && (
            <button
              className="btn btn-stairs"
              onClick={() => handleMoveDogToken(dogStairMoveOption)}
              disabled={controlsDisabled}
            >
              Move Dog to {dogStairDestination?.name || "connected tile"} ({dogStairMoveOption.floor})
            </button>
          )}
          {dogTradeTargetsOnTile.map(({ player, playerIndex }) => (
            <button
              key={`dog-trade-start-${playerIndex}`}
              className="btn btn-trade"
              onClick={() => handleStartDogTrade(playerIndex)}
              disabled={controlsDisabled}
            >
              Trade with {player.name}
            </button>
          ))}
          <button className="btn btn-secondary" onClick={handleCancelDogTrade} disabled={controlsDisabled}>
            Cancel Dog Ability
          </button>
        </>
      )}
    </div>
  );
}
