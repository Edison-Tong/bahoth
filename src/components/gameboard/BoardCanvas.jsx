import { EventTileChoiceTargets } from "../EventResolutionModal";

export default function BoardCanvas({
  boardRef,
  cameraFloor,
  game,
  currentPlayer,
  floorTiles,
  playersOnFloor,
  tradeState,
  validMoves,
  pendingSpecialPlacementTargets,
  minX,
  minY,
  gridWidth,
  gridHeight,
  TILE_SIZE,
  GAP,
  eventTileChoiceOptions,
  selectedEventTileChoiceId,
  handleEventTileChoice,
  handleAction,
  handlePlacePendingSpecialTile,
  handleMoveDogToken,
  dogMoveOptionsOnFloor,
}) {
  return (
    <div className="board-container" ref={boardRef}>
      <div className="board-scroll">
        <div className="board-grid" style={{ width: gridWidth, height: gridHeight }}>
          {/* Movement path line */}
          {game.movePath.filter((p) => p.floor === cameraFloor).length >= 2 && (
            <svg className="path-svg" style={{ width: gridWidth, height: gridHeight }}>
              <polyline
                points={game.movePath
                  .filter((p) => p.floor === cameraFloor)
                  .map((p) => {
                    const cx = (p.x - minX) * (TILE_SIZE + GAP) + TILE_SIZE / 2;
                    const cy = (p.y - minY) * (TILE_SIZE + GAP) + TILE_SIZE / 2;
                    return `${cx},${cy}`;
                  })
                  .join(" ")}
                className="path-line"
                style={{ stroke: currentPlayer.color }}
              />
            </svg>
          )}

          {/* Placed tiles */}
          {floorTiles.map((tile) => {
            const left = (tile.x - minX) * (TILE_SIZE + GAP);
            const top = (tile.y - minY) * (TILE_SIZE + GAP);
            const tilePlayersHere = playersOnFloor.filter((p) => p.x === tile.x && p.y === tile.y);
            const isCurrentTile = currentPlayer.x === tile.x && currentPlayer.y === tile.y && currentPlayer.floor === cameraFloor;

            return (
              <div
                key={tile.id + tile.x + tile.y}
                className={`board-tile ${isCurrentTile ? "board-tile-current" : ""} ${tile.cardType ? "board-tile-" + tile.cardType : ""}`}
                style={{ left, top, width: TILE_SIZE, height: TILE_SIZE }}
              >
                {tile.description && <div className="tile-tooltip">{tile.description}</div>}
                <div className="tile-name">{tile.name}</div>
                {tile.cardType && <div className={`tile-type tile-type-${tile.cardType}`}>{tile.cardType}</div>}
                {tile.obstacle && <div className="tile-obstacle">Obstacle</div>}
                {tile.tokens?.length > 0 && (
                  <div className="tile-token-list">
                    {tile.tokens.map((token, tokenIndex) => (
                      <div
                        key={`${tile.id}-token-${token.type}-${tokenIndex}`}
                        className={`tile-token tile-token-${token.type}`}
                      >
                        {token.type.replace(/-/g, " ")}
                      </div>
                    ))}
                  </div>
                )}
                {/* Door indicators */}
                <div className="tile-doors">
                  {tile.doors.map((d) => (
                    <div key={d} className={`door door-${d}`} />
                  ))}
                </div>

                {/* Player tokens */}
                {tilePlayersHere.length > 0 && (
                  <div className="tile-players">
                    {tilePlayersHere.map((p) => (
                      <div key={p.index} className="player-token" style={{ background: p.color }} title={p.name}>
                        {p.name.charAt(0)}
                      </div>
                    ))}
                  </div>
                )}

                {tradeState?.mode === "dog-remote" && tradeState.floor === cameraFloor && tradeState.x === tile.x && tradeState.y === tile.y && (
                  <div className="player-token" title="Dog">
                    🐕
                  </div>
                )}
              </div>
            );
          })}

          {/* Pending explore placeholder / rotate preview */}
          {game.pendingExplore &&
            game.pendingExplore.floor === cameraFloor &&
            (() => {
              const pe = game.pendingExplore;
              const left = (pe.x - minX) * (TILE_SIZE + GAP);
              const top = (pe.y - minY) * (TILE_SIZE + GAP);
              const tilePlayersHere = playersOnFloor.filter((p) => p.x === pe.x && p.y === pe.y);
              const isRotating = game.turnPhase === "rotate";
              const previewDoors = isRotating ? pe.validRotations[pe.rotationIndex] : [];

              return (
                <div
                  key="pending-explore"
                  className={`board-tile ${isRotating ? "board-tile-rotate" : "board-tile-pending"}`}
                  style={{ left, top, width: TILE_SIZE, height: TILE_SIZE }}
                >
                  {isRotating ? (
                    <>
                      <div className="tile-name">{pe.tile.name}</div>
                      {pe.tile.cardType && <div className={`tile-type tile-type-${pe.tile.cardType}`}>{pe.tile.cardType}</div>}
                      <div className="tile-doors">
                        {previewDoors.map((d) => (
                          <div key={d} className={`door door-${d}`} />
                        ))}
                      </div>
                    </>
                  ) : (
                    <div className="tile-name" style={{ color: "var(--accent)" }}>
                      ?
                    </div>
                  )}
                  {tilePlayersHere.length > 0 && (
                    <div className="tile-players">
                      {tilePlayersHere.map((p) => (
                        <div key={p.index} className="player-token" style={{ background: p.color }} title={p.name}>
                          {p.name.charAt(0)}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}

          {/* Explore/move targets */}
          {!tradeState &&
            !game.pendingExplore &&
            validMoves.map((m) => {
              // Don't show target if there's already a tile there (move targets are on existing tiles)
              if (m.type === "move") return null;
              const left = (m.x - minX) * (TILE_SIZE + GAP);
              const top = (m.y - minY) * (TILE_SIZE + GAP);
              return (
                <button
                  key={`target-${m.x}-${m.y}`}
                  className="explore-target"
                  style={{ left, top, width: TILE_SIZE, height: TILE_SIZE }}
                  onClick={() => handleAction(m)}
                >
                  <span className="explore-icon">?</span>
                </button>
              );
            })}

          {game.pendingSpecialPlacement &&
            pendingSpecialPlacementTargets.map((placement) => {
              const left = (placement.x - minX) * (TILE_SIZE + GAP);
              const top = (placement.y - minY) * (TILE_SIZE + GAP);
              return (
                <button
                  key={`special-placement-${placement.floor}-${placement.x}-${placement.y}`}
                  className="explore-target"
                  style={{ left, top, width: TILE_SIZE, height: TILE_SIZE }}
                  onClick={() => handlePlacePendingSpecialTile(placement)}
                >
                  <span className="explore-icon">⇵</span>
                </button>
              );
            })}

          <EventTileChoiceTargets
            eventTileChoiceOptions={eventTileChoiceOptions}
            selectedEventTileChoiceId={selectedEventTileChoiceId}
            cameraFloor={cameraFloor}
            minX={minX}
            minY={minY}
            onSelectOption={handleEventTileChoice}
          />

          {/* Clickable overlay on existing tiles for movement/backtrack */}
          {!tradeState &&
            validMoves
              .filter((m) => m.type === "move" || m.type === "backtrack" || m.type === "wall-move")
              .map((m) => {
                const left = (m.x - minX) * (TILE_SIZE + GAP);
                const top = (m.y - minY) * (TILE_SIZE + GAP);
                return (
                  <button
                    key={`move-${m.x}-${m.y}`}
                    className={m.type === "backtrack" ? "backtrack-overlay" : "move-overlay"}
                    style={{ left, top, width: TILE_SIZE, height: TILE_SIZE }}
                    onClick={() => handleAction(m)}
                  />
                );
              })}

          {tradeState?.phase === "move" &&
            dogMoveOptionsOnFloor.map((move) => {
              const left = (move.x - minX) * (TILE_SIZE + GAP);
              const top = (move.y - minY) * (TILE_SIZE + GAP);
              return (
                <button
                  key={`dog-move-${move.floor}-${move.x}-${move.y}`}
                  className="move-overlay"
                  style={{ left, top, width: TILE_SIZE, height: TILE_SIZE }}
                  onClick={() => handleMoveDogToken(move)}
                  title={`Dog move cost: ${move.cost}`}
                />
              );
            })}
        </div>
      </div>
    </div>
  );
}

