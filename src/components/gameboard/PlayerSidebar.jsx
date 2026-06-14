/* [SIDEBAR] [OVERLAY] Collapsible sidebar listing all players' stats, inventory, and omens. Also shows haunt-specific UI (Jack's Spirit tracker, knowledge tokens) when haunt is active. */
import { getHauntMonsterCardState, getHauntPlayerTokensState } from "../../haunts/hauntDomain";

export default function PlayerSidebar({
  game,
  expandedSidebarPlayers,
  toggleSidebarPlayer,
  PLAYER_STAT_ORDER,
  STAT_ICONS,
  STAT_LABELS,
  CRITICAL_STAT_INDEX,
  formatStatTrackValue,
  handleViewOwnedCard,
  onQuit,
}) {
  const traitorPlayerIndex = game?.hauntState?.traitorPlayerIndex;

  // Single hook — each haunt runtime provides its own monster card data.
  const monsterCard = getHauntMonsterCardState(game);

  /* [SIDEBAR] [MONSTER] Renders the haunt-specific monster stat card below the traitor's player card. */
  function renderMonsterCard() {
    if (!monsterCard) return null;
    const { name, emoji, stats, movesLeft, speedRollLabel, isCurrentTurn } = monsterCard;
    const displayName = emoji ? `${emoji} ${name}` : name;
    return (
      <div
        key={`sidebar-monster-${name}`}
        className={`sidebar-player sidebar-monster ${isCurrentTurn ? "sidebar-current" : ""}`}
      >
        <div className="sidebar-header sidebar-header-static">
          <div className="sidebar-name sidebar-name-monster">
            {displayName} {isCurrentTurn && "◄"}
            <span className="sidebar-monster-badge">Monster</span>
          </div>
        </div>
        <div className="sidebar-char">Monster Card</div>
        <div className="sidebar-stats sidebar-stats-expanded sidebar-monster-stats">
          <div className="sidebar-monster-trait-grid">
            {PLAYER_STAT_ORDER.map((stat) => (
              <div key={`monster-${stat}`} className="sidebar-monster-trait-cell">
                <div className="sidebar-stat-label sidebar-monster-trait-label">
                  <span>{STAT_ICONS[stat]}</span>
                  <span>{STAT_LABELS[stat]}</span>
                </div>
                <div className="sidebar-monster-stat-value">{stats?.[stat] ?? 0}</div>
              </div>
            ))}
          </div>
          <div className="sidebar-monster-movement">
            <div className="sidebar-stat-label">
              <span>Movement</span>
            </div>
            <div className="sidebar-monster-stat-value">{movesLeft}</div>
          </div>
          <div className="sidebar-monster-roll">Speed roll: {speedRollLabel}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="player-sidebar">
      {game.players.map((p, i) => {
        const isCurrent = i === game.currentPlayerIndex;
        const isExpanded = isCurrent || expandedSidebarPlayers.has(i);
        const isTraitor = traitorPlayerIndex === i;
        const hauntTokens = getHauntPlayerTokensState(game, i);
        return (
          <div key={`sidebar-entry-${i}`} className="sidebar-entry">
            <div
              className={`sidebar-player ${isCurrent ? "sidebar-current" : ""} ${isExpanded ? "sidebar-expanded" : "sidebar-collapsed"} ${!p.isAlive ? "sidebar-dead" : ""} ${isTraitor ? "sidebar-traitor" : ""}`}
              style={{ borderColor: isCurrent ? p.color : "transparent" }}
            >
              <button className="sidebar-header" onClick={() => toggleSidebarPlayer(i)} type="button">
                <div className="sidebar-name" style={{ color: p.color }}>
                  {p.name} {isCurrent && "◄"}
                  {isTraitor && <span className="sidebar-traitor-badge">Traitor</span>}
                </div>
                <span className={`sidebar-toggle ${isExpanded ? "sidebar-toggle-expanded" : ""}`} aria-hidden="true">
                  ▾
                </span>
              </button>
              <div className="sidebar-char">{p.character.name}</div>
              {!isExpanded && (
                <div className="sidebar-stats-summary">
                  {PLAYER_STAT_ORDER.map((stat) => (
                    <span key={`${p.name}-${stat}-summary`} className="sidebar-stats-summary-item">
                      <span>{STAT_ICONS[stat]}</span>
                      <span>{formatStatTrackValue(p.character[stat][p.statIndex[stat]])}</span>
                    </span>
                  ))}
                </div>
              )}
              <div className={`sidebar-stats ${isExpanded ? "sidebar-stats-expanded" : "sidebar-stats-collapsed"}`}>
                {PLAYER_STAT_ORDER.map((stat) => (
                  <div key={`${p.name}-${stat}`} className="sidebar-stat-row">
                    <div className="sidebar-stat-label">
                      <span>{STAT_ICONS[stat]}</span>
                      <span>{STAT_LABELS[stat]}</span>
                    </div>
                    <div className="sidebar-stat-track" aria-label={`${p.name} ${STAT_LABELS[stat]} track`}>
                      {p.character[stat].map((value, index) => (
                        <div
                          key={`${p.name}-${stat}-${index}`}
                          className={[
                            "sidebar-stat-cell",
                            index === p.statIndex[stat] ? "sidebar-stat-cell-current" : "",
                            index === p.character.startIndex[stat] ? "sidebar-stat-cell-start" : "",
                            index === CRITICAL_STAT_INDEX ? "sidebar-stat-cell-critical" : "",
                            value === 0 ? "sidebar-stat-cell-zero" : "",
                          ]
                            .filter(Boolean)
                            .join(" ")}
                        >
                          {formatStatTrackValue(value)}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
                <div className="sidebar-card-groups">
                  <div className="sidebar-card-group">
                    <div className="sidebar-card-group-header">
                      <span>Items</span>
                      <span>{p.inventory.length}</span>
                    </div>
                    {p.inventory.length > 0 ? (
                      <div className="sidebar-card-list">
                        {p.inventory.map((card, cardIndex) => (
                          <button
                            key={`${p.name}-item-${card.id}-${cardIndex}`}
                            type="button"
                            className="sidebar-card-chip sidebar-card-chip-item"
                            onClick={() =>
                              handleViewOwnedCard(
                                {
                                  ...card,
                                  ownerCollection: "inventory",
                                  ownerCardIndex: cardIndex,
                                },
                                p.name,
                                i,
                                "inventory",
                                cardIndex
                              )
                            }
                          >
                            {card.name}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="sidebar-card-empty">No items</div>
                    )}
                  </div>
                  <div className="sidebar-card-group">
                    <div className="sidebar-card-group-header">
                      <span>Omens</span>
                      <span>{p.omens.length}</span>
                    </div>
                    {p.omens.length > 0 ? (
                      <div className="sidebar-card-list">
                        {p.omens.map((card, cardIndex) => (
                          <button
                            key={`${p.name}-omen-${card.id}-${cardIndex}`}
                            type="button"
                            className="sidebar-card-chip sidebar-card-chip-omen"
                            onClick={() =>
                              handleViewOwnedCard(
                                {
                                  ...card,
                                  ownerCollection: "omens",
                                  ownerCardIndex: cardIndex,
                                },
                                p.name,
                                i,
                                "omens",
                                cardIndex
                              )
                            }
                          >
                            {card.name}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="sidebar-card-empty">No omens</div>
                    )}
                  </div>
                  <div className="sidebar-card-group">
                    <div className="sidebar-card-group-header">
                      <span>Tokens</span>
                      <span>{hauntTokens.length}</span>
                    </div>
                    {hauntTokens.length > 0 ? (
                      <div className="sidebar-card-list">
                        {hauntTokens.map((token, tokenIndex) => (
                          <span
                            key={`${p.name}-haunt-token-${tokenIndex}`}
                            className="sidebar-card-chip sidebar-card-chip-token"
                          >
                            {token.label}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <div className="sidebar-card-empty">No tokens</div>
                    )}
                  </div>
                </div>
              </div>
            </div>
            {i === traitorPlayerIndex && renderMonsterCard()}
          </div>
        );
      })}
      <button className="btn btn-danger sidebar-quit" onClick={onQuit}>
        Quit Game
      </button>
    </div>
  );
}
