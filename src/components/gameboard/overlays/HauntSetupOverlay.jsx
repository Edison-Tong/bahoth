function BookletHeader({ title }) {
  return (
    <div className="haunt-booklet-header">
      <h1 className="haunt-booklet-title">{title}</h1>
      <div className="haunt-booklet-meta">
        Scenario Card: None • Haunt Trigger: A Splash of Crimson • Traitor: Haunt Revealer
      </div>
      <div className="haunt-booklet-number">1</div>
    </div>
  );
}

function ReadFirstBlock({ introduction, setupSteps }) {
  return (
    <section className="haunt-booklet-readfirst">
      <div className="haunt-booklet-bar">Read First!</div>
      <div className="haunt-booklet-readfirst-body">
        <h3>Introduction</h3>
        <p>{introduction}</p>
        <h3>Setup</h3>
        <ol>
          {setupSteps.map((step, index) => (
            <li key={`setup-step-${index}`}>{step}</li>
          ))}
        </ol>
      </div>
    </section>
  );
}

export function HeroRulesPage({ hauntDefinition, onDone }) {
  return (
    <div className="card-overlay" role="dialog" aria-label="Heroes rules">
      <div className="haunt-booklet haunt-booklet-heroes">
        <BookletHeader title="Stacked Like Cordwood 2: Crimson Jack Returns" />
        <ReadFirstBlock
          introduction={hauntDefinition.introduction?.heroes || hauntDefinition.summary}
          setupSteps={[
            "The heroes have no additional setup steps.",
            "The player to the left of the traitor takes the first turn after setup.",
          ]}
        />

        <div className="haunt-booklet-grid">
          <aside className="haunt-booklet-sidebar">
            <section>
              <h4>Objective</h4>
              <p>You win when you exorcise Jack's Spirit.</p>
            </section>
            <section>
              <h4>Tokens Needed</h4>
              <ul>
                <li>Jack's Spirit token</li>
                <li>2 Sanity tokens (Exorcism Circle)</li>
                <li>2 Might tokens (Knowledge of Jack)</li>
              </ul>
            </section>
            <section>
              <h4>If You Win</h4>
              <p>Jack's Spirit fades. For now, the house is yours again.</p>
            </section>
          </aside>

          <main className="haunt-booklet-main">
            <div className="haunt-booklet-action-group">
              <div className="haunt-booklet-action-group-title">Hero Once-Per-Turn Actions</div>
              <section className="haunt-booklet-action-item">
                <div className="haunt-booklet-once-per-turn">Once during your turn, you may</div>
                <h4>Learn about Jack</h4>
                <p>While on the Library tile, make a Knowledge roll.</p>
                <p>5+: Give a Knowledge of Jack token to a hero who does not have one.</p>
                <p>0-4: Nothing happens.</p>
              </section>
              <section className="haunt-booklet-action-item">
                <div className="haunt-booklet-once-per-turn">Once during your turn, you may</div>
                <h4>Study the Exorcism</h4>
                <p>While on an Event symbol tile, make a Knowledge roll.</p>
                <p>5+: Place or move the Exorcism Circle token.</p>
                <p>0-4: Take 2 Mental damage.</p>
              </section>
              <section className="haunt-booklet-action-item">
                <div className="haunt-booklet-once-per-turn">Once during your turn, you may</div>
                <h4>Exorcise Jack's Spirit</h4>
                <p>While on Jack's Spirit tile, make a Sanity roll.</p>
                <p>Add 1 for each Exorcism Circle token on your floor.</p>
                <p>7+: You win.</p>
                <p>0-6: Each hero takes 1 Physical damage.</p>
              </section>
            </div>
            <section>
              <h4>When You Attack the Traitor or Are Attacked by Jack's Spirit</h4>
              <p>If you have a Knowledge of Jack token, add 2 to your roll result.</p>
            </section>
            <section>
              <h4>When the Traitor Dies</h4>
              <p>Place Jack's Spirit on the omen tile farthest from the traitor's corpse.</p>
            </section>
          </main>
        </div>

        <div className="haunt-booklet-footer-actions">
          <button className="btn btn-primary" onClick={onDone}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

export function TraitorRulesPage({ hauntDefinition, onDone }) {
  return (
    <div className="card-overlay" role="dialog" aria-label="Traitor rules">
      <div className="haunt-booklet haunt-booklet-traitor">
        <BookletHeader title="Stacked Like Cordwood 2: Crimson Jack Returns" />
        <ReadFirstBlock
          introduction={hauntDefinition.introduction?.traitor || "You smile. Jack is back."}
          setupSteps={[
            "Your explorer is still in the game. You are the traitor.",
            "Place the Monster card by your left hand.",
            "Heal all traits. Gain your physical bonus from player count.",
          ]}
        />

        <div className="haunt-booklet-grid">
          <aside className="haunt-booklet-sidebar">
            <section>
              <h4>Objective</h4>
              <p>You win when all heroes are dead.</p>
            </section>
            <section>
              <h4>Tokens Needed</h4>
              <ul>
                <li>Jack's Spirit token</li>
                <li>2 Sanity tokens (Exorcism Circle)</li>
                <li>2 Might tokens (Knowledge of Jack)</li>
              </ul>
            </section>
            <section>
              <h4>If You Win</h4>
              <p>The house belongs to you again, and no one leaves alive.</p>
            </section>
          </aside>

          <main className="haunt-booklet-main">
            <div className="haunt-booklet-action-group haunt-booklet-action-group-traitor">
              <div className="haunt-booklet-action-group-title">Traitor Once-Per-Turn Actions</div>
              <section className="haunt-booklet-action-item">
                <div className="haunt-booklet-once-per-turn">Once during your turn, you may</div>
                <h4>Stalk the Prey</h4>
                <p>
                  If you have not attacked and no hero is in line of sight, move to any upper/ground tile out of line of
                  sight.
                </p>
              </section>
            </div>
            <section>
              <h4>If You Die</h4>
              <p>Place Jack's Spirit on the omen tile farthest from your corpse. Repeat each time you die.</p>
            </section>
            <section>
              <h4>At the Start of Your Turn If You Are Dead</h4>
              <p>Take your turn with Jack's Spirit instead of your explorer.</p>
            </section>
            <section className="haunt-booklet-monster-card">
              <h4>Monster: Jack's Spirit</h4>
              <div className="haunt-monster-stats" aria-label="Monster stats">
                <div className="haunt-monster-stat">
                  <span>Might</span>
                  <strong>5</strong>
                </div>
                <div className="haunt-monster-stat">
                  <span>Speed</span>
                  <strong>3</strong>
                </div>
                <div className="haunt-monster-stat">
                  <span>Sanity</span>
                  <strong>4</strong>
                </div>
                <div className="haunt-monster-stat">
                  <span>Knowledge</span>
                  <strong>4</strong>
                </div>
              </div>
              <p>Jack's Spirit may move between adjacent tiles without doorway connections.</p>
              <p>Jack's Spirit cannot be stunned.</p>
              <h5>At the Start of the Monster Turn</h5>
              <p>
                If Jack's Spirit is on your corpse tile, heal all traits, retake your explorer, and remove Jack's Spirit
                from the house.
              </p>
            </section>
          </main>
        </div>

        <div className="haunt-booklet-footer-actions">
          <button className="btn btn-primary" onClick={onDone}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

export default function HauntSetupOverlay({ game, hauntDefinition, onAdvanceRules, onBeginHaunt }) {
  if (!game?.hauntState || game.gamePhase !== "hauntSetup") return null;
  if (!hauntDefinition) return null;

  const rulesStep = game.hauntState.rulesView?.step || "heroes-prompt";
  const traitorName = game.players[game.hauntState.traitorPlayerIndex]?.name || "the traitor";
  const isTraitorScreen = rulesStep === "traitor-prompt" || rulesStep === "traitor-rules";
  const panelClass = isTraitorScreen ? "card-haunt-rules-traitor" : "card-haunt-rules-heroes";

  if (rulesStep === "heroes-prompt") {
    return (
      <div className="card-overlay" role="dialog" aria-label="Heroes rules gate">
        <div className={`card-modal card-haunt-setup ${panelClass}`}>
          <div className="card-type-label">HAUNT RULES</div>
          <h2 className="card-name">HEROS RULES</h2>
          <p className="card-description">Traitor player should step away from the computer now.</p>
          <button className="btn btn-primary" onClick={onAdvanceRules}>
            Continue
          </button>
        </div>
      </div>
    );
  }

  if (rulesStep === "heroes-rules") {
    return <HeroRulesPage hauntDefinition={hauntDefinition} onDone={onAdvanceRules} />;
  }

  if (rulesStep === "traitor-prompt") {
    return (
      <div className="card-overlay" role="dialog" aria-label="Traitor rules gate">
        <div className={`card-modal card-haunt-setup ${panelClass}`}>
          <div className="card-type-label">HAUNT RULES</div>
          <h2 className="card-name">TRAITORS RULES</h2>
          <p className="card-description">Hero players should step away. {traitorName}, continue when ready.</p>
          <button className="btn btn-primary" onClick={onAdvanceRules}>
            Continue
          </button>
        </div>
      </div>
    );
  }

  if (rulesStep === "traitor-rules") {
    return <TraitorRulesPage hauntDefinition={hauntDefinition} onDone={onBeginHaunt} />;
  }

  return null;
}
