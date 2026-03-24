function BookletHeader({ title, meta, number }) {
  return (
    <div className="haunt-booklet-header">
      <h1 className="haunt-booklet-title">{title}</h1>
      <div className="haunt-booklet-meta">{meta}</div>
      <div className="haunt-booklet-number">{number}</div>
    </div>
  );
}

function renderSectionContent({ paragraphs, bullets }) {
  return (
    <>
      {Array.isArray(paragraphs) && paragraphs.map((line, index) => <p key={`section-line-${index}`}>{line}</p>)}
      {Array.isArray(bullets) && bullets.length > 0 && (
        <ul>
          {bullets.map((line, index) => (
            <li key={`section-bullet-${index}`}>{line}</li>
          ))}
        </ul>
      )}
    </>
  );
}

function getRulesBooklet(hauntDefinition) {
  const defaultTitle = hauntDefinition?.title || "Haunt Rules";
  const heroIntro = hauntDefinition?.introduction?.heroes || hauntDefinition?.summary || "";
  const traitorIntro = hauntDefinition?.introduction?.traitor || "";

  const rulesBooklet = hauntDefinition?.rulesBooklet || {};
  const header = rulesBooklet.header || {};
  const heroes = rulesBooklet.heroes || {};
  const traitor = rulesBooklet.traitor || {};

  return {
    header: {
      title: header.title || defaultTitle,
      meta: header.meta || "",
      number: header.number || "?",
    },
    heroes: {
      readFirst: {
        introduction: heroes.readFirst?.introduction || heroIntro,
        setupSteps: heroes.readFirst?.setupSteps || hauntDefinition?.setup?.heroes || [],
      },
      sidebarSections: heroes.sidebarSections || [],
      actionGroup: heroes.actionGroup || { title: "", actions: [] },
      mainSections: heroes.mainSections || [],
    },
    traitor: {
      readFirst: {
        introduction: traitor.readFirst?.introduction || traitorIntro,
        setupSteps: traitor.readFirst?.setupSteps || hauntDefinition?.setup?.traitor || [],
      },
      sidebarSections: traitor.sidebarSections || [],
      actionGroup: traitor.actionGroup || { title: "", actions: [] },
      mainSections: traitor.mainSections || [],
      monsterCard: traitor.monsterCard || null,
    },
  };
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
  const booklet = getRulesBooklet(hauntDefinition);
  const heroContent = booklet.heroes;

  return (
    <div className="card-overlay" role="dialog" aria-label="Heroes rules">
      <div className="haunt-booklet haunt-booklet-heroes">
        <BookletHeader title={booklet.header.title} meta={booklet.header.meta} number={booklet.header.number} />
        <ReadFirstBlock
          introduction={heroContent.readFirst.introduction}
          setupSteps={heroContent.readFirst.setupSteps}
        />

        <div className="haunt-booklet-grid">
          <aside className="haunt-booklet-sidebar">
            {heroContent.sidebarSections.map((section, index) => (
              <section key={`hero-sidebar-${index}`}>
                <h4>{section.heading}</h4>
                {renderSectionContent(section)}
              </section>
            ))}
          </aside>

          <main className="haunt-booklet-main">
            <div className="haunt-booklet-action-group">
              <div className="haunt-booklet-action-group-title">{heroContent.actionGroup.title}</div>
              {(heroContent.actionGroup.actions || []).map((action, index) => (
                <section className="haunt-booklet-action-item" key={`hero-action-${index}`}>
                  <div className="haunt-booklet-once-per-turn">Once during your turn, you may</div>
                  <h4>{action.title}</h4>
                  {(action.lines || []).map((line, lineIndex) => (
                    <p key={`hero-action-line-${index}-${lineIndex}`}>{line}</p>
                  ))}
                </section>
              ))}
            </div>
            {heroContent.mainSections.map((section, index) => (
              <section key={`hero-main-${index}`}>
                <h4>{section.heading}</h4>
                {renderSectionContent(section)}
              </section>
            ))}
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
  const booklet = getRulesBooklet(hauntDefinition);
  const traitorContent = booklet.traitor;
  const monsterCard = traitorContent.monsterCard;
  const monsterStats = monsterCard?.stats || {};

  return (
    <div className="card-overlay" role="dialog" aria-label="Traitor rules">
      <div className="haunt-booklet haunt-booklet-traitor">
        <BookletHeader title={booklet.header.title} meta={booklet.header.meta} number={booklet.header.number} />
        <ReadFirstBlock
          introduction={traitorContent.readFirst.introduction}
          setupSteps={traitorContent.readFirst.setupSteps}
        />

        <div className="haunt-booklet-grid">
          <aside className="haunt-booklet-sidebar">
            {traitorContent.sidebarSections.map((section, index) => (
              <section key={`traitor-sidebar-${index}`}>
                <h4>{section.heading}</h4>
                {renderSectionContent(section)}
              </section>
            ))}
          </aside>

          <main className="haunt-booklet-main">
            <div
              className={`haunt-booklet-action-group ${traitorContent.actionGroup.isTraitor ? "haunt-booklet-action-group-traitor" : ""}`}
            >
              <div className="haunt-booklet-action-group-title">{traitorContent.actionGroup.title}</div>
              {(traitorContent.actionGroup.actions || []).map((action, index) => (
                <section className="haunt-booklet-action-item" key={`traitor-action-${index}`}>
                  <div className="haunt-booklet-once-per-turn">Once during your turn, you may</div>
                  <h4>{action.title}</h4>
                  {(action.lines || []).map((line, lineIndex) => (
                    <p key={`traitor-action-line-${index}-${lineIndex}`}>{line}</p>
                  ))}
                </section>
              ))}
            </div>
            {traitorContent.mainSections.map((section, index) => (
              <section key={`traitor-main-${index}`}>
                <h4>{section.heading}</h4>
                {renderSectionContent(section)}
              </section>
            ))}
            {monsterCard && (
              <section className="haunt-booklet-monster-card">
                <h4>{monsterCard.heading}</h4>
                <div className="haunt-monster-stats" aria-label="Monster stats">
                  <div className="haunt-monster-stat">
                    <span>Might</span>
                    <strong>{monsterStats.might}</strong>
                  </div>
                  <div className="haunt-monster-stat">
                    <span>Speed</span>
                    <strong>{monsterStats.speed}</strong>
                  </div>
                  <div className="haunt-monster-stat">
                    <span>Sanity</span>
                    <strong>{monsterStats.sanity}</strong>
                  </div>
                  <div className="haunt-monster-stat">
                    <span>Knowledge</span>
                    <strong>{monsterStats.knowledge}</strong>
                  </div>
                </div>
                {(monsterCard.paragraphs || []).map((line, index) => (
                  <p key={`monster-line-${index}`}>{line}</p>
                ))}
                {monsterCard.turnHeading && <h5>{monsterCard.turnHeading}</h5>}
                {(monsterCard.turnParagraphs || []).map((line, index) => (
                  <p key={`monster-turn-line-${index}`}>{line}</p>
                ))}
              </section>
            )}
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
