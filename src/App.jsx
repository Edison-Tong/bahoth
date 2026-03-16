import { useState } from 'react'
import './App.css'

// Placeholder colors for players
const PLAYER_COLORS = ['#c0392b', '#2980b9', '#27ae60', '#f39c12', '#8e44ad', '#e67e22']

function generateGameCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 5; i++) {
    code += chars[Math.floor(Math.random() * chars.length)]
  }
  return code
}

function App() {
  const [screen, setScreen] = useState('name') // 'name' | 'menu' | 'lobby'
  const [playerName, setPlayerName] = useState('')
  const [gameCode, setGameCode] = useState('')
  const [joinCode, setJoinCode] = useState('')
  const [players, setPlayers] = useState([])
  const [isHost, setIsHost] = useState(false)

  function handleNameSubmit(e) {
    e.preventDefault()
    if (playerName.trim()) {
      setScreen('menu')
    }
  }

  function handleCreateGame() {
    const code = generateGameCode()
    setGameCode(code)
    setIsHost(true)
    setPlayers([{ name: playerName, color: PLAYER_COLORS[0], isHost: true }])
    setScreen('lobby')
  }

  function handleLeaveGame() {
    setGameCode('')
    setJoinCode('')
    setPlayers([])
    setIsHost(false)
    setScreen('menu')
  }

  function handleJoinGame(e) {
    e.preventDefault()
    if (!joinCode.trim()) return
    // For now, just simulate joining — later this connects to the server
    setGameCode(joinCode.trim().toUpperCase())
    setIsHost(false)
    setPlayers([
      { name: 'Host Player', color: PLAYER_COLORS[0], isHost: true },
      { name: playerName, color: PLAYER_COLORS[1], isHost: false },
    ])
    setScreen('lobby')
  }

  // --- Name Entry Screen ---
  if (screen === 'name') {
    return (
      <div className="app">
        <h1 className="title">Betrayal at House on the Hill</h1>
        <p className="subtitle">A web adaptation for remote play</p>

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
          <button className="btn btn-primary" type="submit" disabled={!playerName.trim()}>
            Continue
          </button>
        </form>
      </div>
    )
  }

  // --- Menu Screen ---
  if (screen === 'menu') {
    return (
      <div className="app">
        <h1 className="title">Betrayal at House on the Hill</h1>
        <p className="subtitle">A web adaptation for remote play</p>

        <div className="menu-screen">
          <p className="welcome">
            Welcome, {playerName}
            <button className="btn-link" onClick={() => setScreen('name')}>(edit name)</button>
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
          </div>
        </div>
      </div>
    )
  }

  // --- Lobby Screen ---
  return (
    <div className="app">
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

        {isHost && players.length >= 3 && (
          <button className="btn btn-primary">Start Game</button>
        )}

        <p className="lobby-footer">
          {players.length < 3
            ? `Waiting for players... (need at least ${3 - players.length} more)`
            : 'Ready to start!'}
        </p>

        <button className="btn btn-danger" onClick={handleLeaveGame}>
          {isHost ? 'Cancel Game' : 'Leave Game'}
        </button>
      </div>
    </div>
  )
}

export default App