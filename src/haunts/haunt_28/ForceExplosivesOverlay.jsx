/* [HAUNT-ACTION] [OVERLAY] Modal popup for choosing how many Explosives (and Dynamite) to use when forcing items down the shark's throat. */
export default function ForceExplosivesOverlay({ pendingChoice, onDecrement, onIncrement, onConfirm }) {
  if (!pendingChoice || pendingChoice.type !== "force-explosives-count") return null;

  const { currentCount, maxCount, explosiveCount, hasDynamite } = pendingChoice;
  const explosivesUsed = Math.min(currentCount, explosiveCount);
  const dynamiteUsed = hasDynamite && currentCount > explosiveCount;
  const bonus = currentCount * 2;

  const parts = [];
  if (explosivesUsed > 0) parts.push(`${explosivesUsed} Explosive${explosivesUsed !== 1 ? "s" : ""}`);
  if (dynamiteUsed) parts.push("Dynamite");
  const itemDesc = parts.length > 0 ? parts.join(" + ") : "none";

  return (
    <div className="card-overlay">
      <div className="card-modal card-damage-choice">
        <div className="card-type-label">HAUNT ACTION</div>
        <h2 className="card-name">Force Items Down the Shark's Throat</h2>

        <p className="card-description">
          Choose how many items to use. Each adds <strong>+2</strong> to your Might roll. You need <strong>10+</strong> to blow up the shark.
        </p>

        <div style={{ textAlign: "center", margin: "1rem 0" }}>
          <div style={{ fontSize: "0.85em", color: "#aaa", marginBottom: "0.35rem" }}>
            {hasDynamite
              ? `You have: ${explosiveCount} Explosive${explosiveCount !== 1 ? "s" : ""} + Dynamite (max ${maxCount})`
              : `You have: ${explosiveCount} Explosive${explosiveCount !== 1 ? "s" : ""} (max ${maxCount})`}
          </div>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "1rem", margin: "0.75rem 0" }}>
            <button
              className="btn btn-secondary"
              style={{ fontSize: "1.4rem", padding: "0.1rem 0.7rem", lineHeight: 1 }}
              onClick={onDecrement}
              disabled={currentCount <= 0}
            >
              −
            </button>
            <div style={{ minWidth: "6rem", textAlign: "center" }}>
              <div style={{ fontSize: "1.6rem", fontWeight: "bold" }}>{currentCount}</div>
              <div style={{ fontSize: "0.8em", color: "#aaa" }}>{itemDesc}</div>
            </div>
            <button
              className="btn btn-secondary"
              style={{ fontSize: "1.4rem", padding: "0.1rem 0.7rem", lineHeight: 1 }}
              onClick={onIncrement}
              disabled={currentCount >= maxCount}
            >
              +
            </button>
          </div>

          <div style={{ fontSize: "1rem", fontWeight: "bold", color: bonus > 0 ? "#e8c84a" : "#888" }}>
            {bonus > 0 ? `+${bonus} bonus to Might roll` : "No bonus (roll straight Might)"}
          </div>
        </div>

        <button className="btn btn-danger" style={{ width: "100%", marginTop: "0.5rem" }} onClick={onConfirm}>
          Force Down Throat — Roll Might{bonus > 0 ? ` (+${bonus})` : ""}
        </button>
      </div>
    </div>
  );
}
