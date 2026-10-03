export function DashboardPage() {
  return (
    <section className="dashboard" id="dashboard">
      <div className="welcome-row">
        <div>
          <div className="eyebrow">YOUR BUSINESS, IN GOOD ORDER</div>
          <h1>A clearer view of your business.</h1>
          <p className="welcome-copy">
            Your new accounting workspace is ready for its first chapter.
          </p>
        </div>
        <div className="date-chip"><span aria-hidden="true">◷</span> Your workspace</div>
      </div>

      <section className="setup-card" aria-labelledby="setup-title">
        <div className="setup-art" aria-hidden="true">
          <div className="orbit orbit-one" />
          <div className="orbit orbit-two" />
          <div className="art-sheet">
            <div className="sheet-mark">b.</div>
            <div className="sheet-line line-long" />
            <div className="sheet-line line-short" />
            <div className="sheet-chart"><span /><span /><span /><span /><span /></div>
          </div>
          <div className="art-dot dot-one" />
          <div className="art-dot dot-two" />
        </div>
        <div className="setup-copy">
          <div className="ready-label"><span /> FOUNDATION READY</div>
          <h2 id="setup-title">A fresh start for your books.</h2>
          <p>
            This independent app is up and running. Add your business,
            shape your chart of accounts, and build from here.
          </p>
          <div className="setup-note">
            <span className="note-icon" aria-hidden="true">✳</span>
            <span>Made for the way your business works.</span>
          </div>
        </div>
      </section>

      <div className="section-heading">
        <div>
          <h2>Your foundation</h2>
          <p>The building blocks behind your workspace.</p>
        </div>
        <span className="section-count">01 / 03</span>
      </div>

      <div className="foundation-grid">
        <article className="foundation-card">
          <div className="card-icon green-icon" aria-hidden="true">⌂</div>
          <div className="card-overline">BUSINESS</div>
          <h3>Company profile</h3>
          <p>Your business details and accounting preferences.</p>
          <span className="card-status">Ready to set up</span>
        </article>
        <article className="foundation-card">
          <div className="card-icon lavender-icon" aria-hidden="true">☷</div>
          <div className="card-overline">STRUCTURE</div>
          <h3>Chart of accounts</h3>
          <p>A clear home for every dollar in and out.</p>
          <span className="card-status coming-soon">Coming next</span>
        </article>
        <article className="foundation-card">
          <div className="card-icon peach-icon" aria-hidden="true">↗</div>
          <div className="card-overline">ACTIVITY</div>
          <h3>First transactions</h3>
          <p>Start tracking the important things.</p>
          <span className="card-status coming-soon">Coming next</span>
        </article>
      </div>
    </section>
  );
}
