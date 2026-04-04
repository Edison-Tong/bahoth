import { useEffect, useState } from "react";
import "./App.css";
import { CHARACTERS } from "./characters";
import GameBoard from "./GameBoard";
import { API_BASE_URL } from "./config/api";

const PLAYER_COLORS = ["#c0392b", "#2980b9", "#27ae60", "#f39c12", "#8e44ad", "#e67e22"];

function generateGameCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 5; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

function App() {
  // Screens: 'mode' | 'online-name' | 'online-menu' | 'online-lobby'
  //        | 'local-count' | 'local-names' | 'local-lobby'
  const [screen, setScreen] = useState("mode");

  // Online state
  const [playerName, setPlayerName] = useState("");
  const [gameCode, setGameCode] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [players, setPlayers] = useState([]);
  const [isHost, setIsHost] = useState(false);

  // Pass-and-play state
  const [localPlayerCount, setLocalPlayerCount] = useState(3);
  const [localNames, setLocalNames] = useState([]);
  const [currentNameIndex, setCurrentNameIndex] = useState(0);
  const [currentNameInput, setCurrentNameInput] = useState("");
  // Character select state
  const [pickingPlayerIndex, setPickingPlayerIndex] = useState(0);
  const [characterChoices, setCharacterChoices] = useState({}); // { playerIndex: character }
  const [backendStatus, setBackendStatus] = useState("checking");

  useEffect(() => {
    const abortController = new AbortController();
    const timeoutId = setTimeout(() => abortController.abort(), 4500);

    fetch(`${API_BASE_URL}/health`, { signal: abortController.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Health check failed: ${response.status}`);
        setBackendStatus("connected");
      })
      .catch(() => {
        setBackendStatus("offline");
      })
      .finally(() => {
        clearTimeout(timeoutId);
      });

    return () => {
      clearTimeout(timeoutId);
      abortController.abort();
    };
  }, []);

  function renderBackendStatus() {
    const statusLabel =
      backendStatus === "connected" ? "Backend: Connected" : backendStatus === "offline" ? "Backend: Offline" : "Backend: Checking...";
    const statusClass =
      backendStatus === "connected"
        ? "backend-status backend-status-connected"
        : backendStatus === "offline"
          ? "backend-status backend-status-offline"
          : "backend-status backend-status-checking";

    return <div className={statusClass}>{statusLabel}</div>;
  }
  // --- Online handlers ---

  function handleNameSubmit(e) {
    e.preventDefault();
    if (playerName.trim()) setScreen("online-menu");
  }

  function handleCreateGame() {
    const code = generateGameCode();
    setGameCode(code);
    setIsHost(true);
    setPlayers([{ name: playerName, color: PLAYER_COLORS[0], isHost: true }]);
    setScreen("online-lobby");
  }

  function handleJoinGame(e) {
    e.preventDefault();
    if (!joinCode.trim()) return;
    setGameCode(joinCode.trim().toUpperCase());
    setIsHost(false);
    setPlayers([
      { name: "Host Player", color: PLAYER_COLORS[0], isHost: true },
      { name: playerName, color: PLAYER_COLORS[1], isHost: false },
    ]);
    setScreen("online-lobby");
  }

  function handleLeaveGame() {
    setGameCode("");
    setJoinCode("");
    setPlayers([]);
    setIsHost(false);
    setScreen("online-menu");
  }

  // --- Pass-and-play handlers ---

  function handleCountSubmit(count) {
    setLocalPlayerCount(count);
    setLocalNames([]);
    setCurrentNameIndex(0);
    setCurrentNameInput("");
    setScreen("local-names");
  }

  function handleLocalNameSubmit(e) {
    e.preventDefault();
    if (!currentNameInput.trim()) return;

    const updatedNames = [...localNames, currentNameInput.trim()];
    setLocalNames(updatedNames);
    setCurrentNameInput("");

    if (updatedNames.length >= localPlayerCount) {
      // All names entered — go to lobby
      setPlayers(
        updatedNames.map((name, i) => ({
          name,
          color: PLAYER_COLORS[i % PLAYER_COLORS.length],
          isHost: false,
        }))
      );
      setScreen("local-lobby");
    } else {
      setCurrentNameIndex(updatedNames.length);
    }
  }

  function handleLocalLeave() {
    setLocalNames([]);
    setCurrentNameIndex(0);
    setCurrentNameInput("");
    setPlayers([]);
    setCharacterChoices({});
    setPickingPlayerIndex(0);
    setScreen("mode");
  }

  // --- Character select handlers ---

  function handleStartCharacterSelect() {
    setPickingPlayerIndex(0);
    setCharacterChoices({});
    setScreen("char-select");
  }

  function handlePickCharacter(character) {
    const updated = { ...characterChoices, [pickingPlayerIndex]: character };
    setCharacterChoices(updated);

    if (pickingPlayerIndex + 1 >= players.length) {
      const finalPlayers = players.map((p, i) => ({
        ...p,
        character: updated[i],
        color: updated[i].color,
      }));
      setPlayers(finalPlayers);
      setScreen("game");
    } else {
      setPickingPlayerIndex(pickingPlayerIndex + 1);
    }
  }

  function getChosenCharacterNames() {
    return Object.values(characterChoices).map((c) => c.name);
  }

  // =====================
  //       SCREENS
  // =====================

  // --- Mode Select ---
  if (screen === "mode") {
    return (
      <div className="app">
        {renderBackendStatus()}
        <h1 className="title">Betrayal at House on the Hill</h1>
        <p className="subtitle">A web adaptation for remote play</p>

        <div className="mode-screen">
          <button className="mode-card" onClick={() => setScreen("online-name")}>
            <span className="mode-icon">🌐</span>
            <span className="mode-label">Online Play</span>
            <span className="mode-desc">Play with friends on different devices</span>
          </button>

          <button className="mode-card" onClick={() => setScreen("local-count")}>
            <span className="mode-icon">🖥️</span>
            <span className="mode-label">Pass & Play</span>
            <span className="mode-desc">Play on the same computer, taking turns</span>
          </button>
        </div>
      </div>
    );
  }

  // --- Online: Name Entry ---
  if (screen === "online-name") {
    return (
      <div className="app">
        {renderBackendStatus()}
        <h1 className="title">Online Play</h1>
        <p className="subtitle">Enter your name to get started</p>

        <form className="name-screen" onSubmit={handleNameSubmit}>
          <input
            className="input"
            type="text"
            placeholder="Enter your name"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            autoFocus
            maxLength={20}
          />
          <div className="name-buttons">
            <button className="btn btn-secondary" type="button" onClick={() => setScreen("mode")}>
              Back
            </button>
            <button className="btn btn-primary" type="submit" disabled={!playerName.trim()}>
              Continue
            </button>
          </div>
        </form>
      </div>
    );
  }

  // --- Online: Menu ---
  if (screen === "online-menu") {
    return (
      <div className="app">
        {renderBackendStatus()}
        <h1 className="title">Online Play</h1>
        <p className="subtitle">Host a new game or join an existing one</p>

        <div className="menu-screen">
          <p className="welcome">
            Welcome, {playerName}
            <button className="btn-link" onClick={() => setScreen("online-name")}>
              (edit name)
            </button>
          </p>

          <div className="menu-buttons">
            <button className="btn btn-primary" onClick={handleCreateGame}>
              Create New Game
            </button>

            <p className="divider">— or —</p>

            <form className="join-row" onSubmit={handleJoinGame}>
              <input
                className="input"
                type="text"
                placeholder="Game code"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                maxLength={5}
              />
              <button className="btn btn-secondary" type="submit" disabled={!joinCode.trim()}>
                Join
              </button>
            </form>

            <button className="btn-link back-link" onClick={() => setScreen("mode")}>
              ← Back to main menu
            </button>
          </div>
        </div>
      </div>
    );
  }

  // --- Online: Lobby ---
  if (screen === "online-lobby") {
    return (
      <div className="app">
        {renderBackendStatus()}
        <h1 className="title">Game Lobby</h1>

        <div className="lobby-screen">
          <div className="game-code">
            <div className="game-code-label">Game Code</div>
            <div className="game-code-value">{gameCode}</div>
            <div className="game-code-hint">Share this code with friends</div>
          </div>

          <div className="player-list">
            <h3>Players ({players.length}/6)</h3>
            {players.map((player, i) => (
              <div className="player-item" key={i}>
                <div className="player-dot" style={{ background: player.color }} />
                <span className="player-name">{player.name}</span>
                {player.isHost && <span className="player-host">HOST</span>}
              </div>
            ))}
          </div>

          {isHost && players.length >= 3 && <button className="btn btn-primary">Start Game</button>}

          <p className="lobby-footer">
            {players.length < 3
              ? `Waiting for players... (need at least ${3 - players.length} more)`
              : "Ready to start!"}
          </p>

          <button className="btn btn-danger" onClick={handleLeaveGame}>
            {isHost ? "Cancel Game" : "Leave Game"}
          </button>
        </div>
      </div>
    );
  }

  // --- Pass & Play: Player Count ---
  if (screen === "local-count") {
    return (
      <div className="app">
        {renderBackendStatus()}
        <h1 className="title">Pass & Play</h1>
        <p className="subtitle">How many players?</p>

        <div className="count-screen">
          <div className="count-options">
            {[3, 4, 5, 6].map((n) => (
              <button className="count-btn" key={n} onClick={() => handleCountSubmit(n)}>
                {n}
              </button>
            ))}
          </div>
          <button className="btn-link back-link" onClick={() => setScreen("mode")}>
            ← Back to main menu
          </button>
        </div>
      </div>
    );
  }

  // --- Pass & Play: Enter Names ---
  if (screen === "local-names") {
    return (
      <div className="app">
        {renderBackendStatus()}
        <h1 className="title">Pass & Play</h1>
        <p className="subtitle">
          Enter name for Player {currentNameIndex + 1} of {localPlayerCount}
        </p>

        <form className="name-screen" onSubmit={handleLocalNameSubmit}>
          {/* Show names entered so far */}
          {localNames.length > 0 && (
            <div className="entered-names">
              {localNames.map((name, i) => (
                <div className="entered-name" key={i}>
                  <div className="player-dot" style={{ background: PLAYER_COLORS[i % PLAYER_COLORS.length] }} />
                  {name}
                </div>
              ))}
            </div>
          )}

          <input
            className="input"
            type="text"
            placeholder={`Player ${currentNameIndex + 1} name`}
            value={currentNameInput}
            onChange={(e) => setCurrentNameInput(e.target.value)}
            autoFocus
            maxLength={20}
            key={currentNameIndex}
          />
          <div className="name-buttons">
            <button
              className="btn btn-secondary"
              type="button"
              onClick={() => {
                if (localNames.length === 0) {
                  setScreen("local-count");
                } else {
                  // Go back one name
                  const prevNames = localNames.slice(0, -1);
                  setCurrentNameInput(localNames[localNames.length - 1]);
                  setLocalNames(prevNames);
                  setCurrentNameIndex(prevNames.length);
                }
              }}
            >
              Back
            </button>
            <button className="btn btn-primary" type="submit" disabled={!currentNameInput.trim()}>
              {currentNameIndex + 1 < localPlayerCount ? "Next" : "Done"}
            </button>
          </div>
        </form>
      </div>
    );
  }

  // --- Character Select ---
  if (screen === "char-select") {
    const currentPicker = players[pickingPlayerIndex];
    const chosen = getChosenCharacterNames();
    const available = CHARACTERS.filter((c) => !chosen.includes(c.name));

    return (
      <div className="app app-wide">
        {renderBackendStatus()}
        <h1 className="title">Choose Your Character</h1>
        <p className="subtitle">
          <span className="picker-name" style={{ color: currentPicker.color }}>
            {currentPicker.name}
          </span>
          , pick your character ({pickingPlayerIndex + 1}/{players.length})
        </p>

        <div className="char-grid">
          {available.map((char) => (
            <button
              className="char-card"
              key={char.name}
              onClick={() => handlePickCharacter(char)}
              style={{ "--char-color": char.color }}
            >
              <div className="char-header">
                <div className="char-portrait" style={{ background: char.color }}>
                  {char.name.charAt(0)}
                </div>
                <div>
                  <div className="char-name">{char.name}</div>
                  <div className="char-age">
                    Age {char.age} • {char.birthday}
                  </div>
                </div>
              </div>
              <div className="char-tracks">
                {[
                  ["Might", "might", "💪"],
                  ["Speed", "speed", "🏃"],
                  ["Sanity", "sanity", "🧠"],
                  ["Knowledge", "knowledge", "📖"],
                ].map(([label, key, icon]) => (
                  <div className="track-row" key={key}>
                    <span className="track-label">
                      {icon} {label}
                    </span>
                    <div className="track-pips">
                      {char[key].slice(1).map((val, i) => {
                        const idx = i + 1;
                        const isStart = idx === char.startIndex[key];
                        return (
                          <span
                            className={`pip${isStart ? " pip-start" : ""}${idx < char.startIndex[key] ? " pip-low" : ""}`}
                            key={idx}
                          >
                            {val}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </button>
          ))}
        </div>

        {pickingPlayerIndex > 0 && (
          <div className="char-chosen-so-far">
            <p className="char-chosen-label">Already chosen:</p>
            <div className="entered-names">
              {Object.entries(characterChoices).map(([idx, char]) => (
                <div className="entered-name" key={idx}>
                  <div className="player-dot" style={{ background: char.color }} />
                  {players[idx].name} — {char.name}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // --- Game board ---
  if (screen === "game") {
    return <GameBoard players={players} onQuit={handleLocalLeave} />;
  }

  // --- Pass & Play: Lobby ---
  return (
    <div className="app">
      {renderBackendStatus()}
      <h1 className="title">Ready to Play</h1>

      <div className="lobby-screen">
        <div className="player-list">
          <h3>Players ({players.length})</h3>
          {players.map((player, i) => (
            <div className="player-item" key={i}>
              <div className="player-dot" style={{ background: player.color }} />
              <span className="player-name">{player.name}</span>
            </div>
          ))}
        </div>

        <button className="btn btn-primary" onClick={handleStartCharacterSelect}>
          Start Game
        </button>

        <button className="btn btn-danger" onClick={handleLocalLeave}>
          Cancel
        </button>
      </div>
    </div>
  );
}

export default App;
