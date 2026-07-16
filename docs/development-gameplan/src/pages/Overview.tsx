import Hero from '../components/Hero';
import Card from '../components/Card';
import Note from '../components/Note';

export default function Overview() {
  return (
    <>
      <Hero />
      <section className="page">
      <div className="wrap">
        <p className="kicker">The Goal</p>
        <h2>What we are building</h2>
        <p className="sub">
          A batteries-included Git template repo. Clone it, declare your pipelines in one{' '}
          <code>registry.yml</code>, fill in a few secrets, and you have working, observable,
          incrementally-loading pipelines into Snowflake — from SQL databases (CDC/merge), prebuilt SaaS
          verified sources, or REST APIs — all deployable to run inside Snowflake itself.
        </p>

        <div className="quote">
          "A new user should get from <code>git clone</code> to a first incremental load into Snowflake
          in under an hour, following one document."
        </div>

        <div className="grid grid-3" style={{ marginTop: 26 }}>
          <Card icon="💾" title="SQL databases">
            Any SQLAlchemy dialect (30+; 23 documented — Postgres, SQL Server, MySQL, Oracle, and more).
            Incremental CDC via cursor columns with <code>merge</code> / <code>scd2</code>.
          </Card>
          <Card icon="🧩" title="Verified sources">
            Prebuilt modules for 29 SaaS apps (Salesforce, HubSpot, Stripe, …) scaffolded with{' '}
            <code>dlt init</code>. One-way ingestion — objects, auth, and incremental handled for you.
          </Card>
          <Card icon="🌐" title="REST APIs">
            Declarative config for auth, pagination, incremental windows, and parent-child resources —
            for any API without a verified source. No bespoke request code for the common cases.
          </Card>
        </div>

        <ul className="value-list">
          <li>
            <span className="vi">&#10003;</span>
            <span className="txt">
              <b>Registry-driven &amp; multi-pipeline.</b> Define every pipeline once in{' '}
              <code>registry.yml</code>; one runner and one image run them all on a shared SPCS compute
              pool and a Gen2 multi-cluster warehouse.
            </span>
          </li>
          <li>
            <span className="vi">&#10003;</span>
            <span className="txt">
              <b>Incremental by default.</b> Every worked example ships with a cursor and a merge key so
              re-runs load only new/changed rows.
            </span>
          </li>
          <li>
            <span className="vi">&#10003;</span>
            <span className="txt">
              <b>Secrets done right.</b> A committed <code>secrets.toml.example</code> documents every
              auth method; the real <code>secrets.toml</code> is git-ignored, and the registry references
              secrets with a <code>secret:</code> prefix.
            </span>
          </li>
          <li>
            <span className="vi">&#10003;</span>
            <span className="txt">
              <b>Observable across the fleet.</b> Pipeline-tagged structured logs, a shared{' '}
              <code>OPS._DLT_RUNS</code> control table, and the Snowflake event table make every run
              queryable — grouped by pipeline.
            </span>
          </li>
          <li>
            <span className="vi">&#10003;</span>
            <span className="txt">
              <b>Snowflake-native deployment.</b> Bootstrap DDL for RBAC, the compute pool, the
              multi-cluster warehouse, and the service user is in the repo; each pipeline runs as an SPCS
              job on its own Task.
            </span>
          </li>
        </ul>

        <Note variant="tip">
          <b>Scope note:</b> this site is the build reference and gameplan. The template repo is scaffolded
          against it — registry, runner, bootstrap DDL, SPCS deploy, tests, and CI — per the{' '}
          <b>Build Roadmap</b>.
        </Note>
      </div>
    </section>
    </>
  );
}
