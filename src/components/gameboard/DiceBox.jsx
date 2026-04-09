import { useState, useRef, useEffect } from "react";

const STORAGE_KEY = "dice-box-pos";
const DEFAULT_POS = () => ({ x: window.innerWidth - 244, y: window.innerHeight - 200 });

function loadPos() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch {
    /* ignore */
  }
  return DEFAULT_POS();
}

const PURPOSE_LABEL = {
  haunt: "Haunt Roll",
  "haunt-action-roll": "Haunt Action",
  "haunt-action-partial-reroll": "Haunt Action Reroll",
  "monster-speed-roll": "Monster Movement",
  "event-roll": "Event Roll",
  "event-partial-reroll": "Event Reroll",
  "event-damage-roll": "Event Damage",
  "event-damage-sequence": "Event Damage",
  "event-trait-sequence-roll": "Event Trait Roll",
  "combat-attacker-roll": "Combat — Attacker",
  "combat-defender-roll": "Combat — Defender",
  "skeleton-key": "Skeleton Key",
  "mystic-elevator": "Mystic Elevator",
  collapsed: "Collapsed Room",
  "collapsed-damage": "Collapsed Room — Damage",
  "skull-roll": "Skull",
  "dynamite-roll": "Dynamite",
  furnace: "Furnace Room",
};

function DieFace({ value, rolling }) {
  return <div className={`die dice-box-die${rolling ? " die-rolling" : ""}`}>{value}</div>;
}

export default function DiceBox({ diceAnimation, lastSettled }) {
  const [pos, setPos] = useState(loadPos);
  const [isDragging, setIsDragging] = useState(false);
  const dragOffset = useRef({ dx: 0, dy: 0 });

  const onHeaderMouseDown = (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    dragOffset.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y };
    setIsDragging(true);
  };

  useEffect(() => {
    if (!isDragging) return;

    const onMouseMove = (e) => {
      const newX = Math.max(0, Math.min(window.innerWidth - 50, e.clientX - dragOffset.current.dx));
      const newY = Math.max(0, Math.min(window.innerHeight - 30, e.clientY - dragOffset.current.dy));
      setPos({ x: newX, y: newY });
    };

    const onMouseUp = () => {
      setIsDragging(false);
      setPos((p) => {
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
        } catch {
          /* ignore */
        }
        return p;
      });
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [isDragging]);

  const isRolling = diceAnimation != null && !diceAnimation.settled;
  const entry = diceAnimation ?? lastSettled;

  if (!entry) return null;

  const dice = isRolling ? entry.display || [] : entry.final || entry.dice || [];
  const total = isRolling ? null : (entry.total ?? (dice.length > 0 ? dice.reduce((a, b) => a + b, 0) : null));
  const label = PURPOSE_LABEL[entry.purpose] ?? "Roll";
  const playerName = entry.playerName ?? null;

  return (
    <div className={`dice-box${isDragging ? " dice-box-dragging" : ""}`} style={{ left: pos.x, top: pos.y }}>
      <div className="dice-box-header" onMouseDown={onHeaderMouseDown}>
        <span className="dice-box-header-drag">⠿</span>
        <span className="dice-box-header-icon">🎲</span>
        <span className="dice-box-header-title">Dice</span>
      </div>

      <div className="dice-box-body">
        <div className="dice-box-label">
          {playerName ? `${playerName} · ` : ""}
          {label}
          {isRolling && <span className="dice-box-rolling-dot"> ●</span>}
        </div>
        <div className="dice-box-dice-row">
          {dice.map((v, i) => (
            <DieFace key={i} value={v} rolling={isRolling} />
          ))}
          {entry.modifier && (
            <div className={`dice-box-modifier dice-modifier-${entry.modifier.tone}`}>
              <div className="dice-box-modifier-val">{entry.modifier.value}</div>
              <div className="dice-box-modifier-lbl">{entry.modifier.label}</div>
            </div>
          )}
        </div>
        {total != null && <div className="dice-box-total">Total: {total}</div>}
      </div>
    </div>
  );
}
