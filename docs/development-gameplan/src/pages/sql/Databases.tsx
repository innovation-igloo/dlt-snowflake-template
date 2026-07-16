import DatabaseCatalog from '../../components/DatabaseCatalog';
import Note from '../../components/Note';

export default function Databases() {
  return (
    <section className="page">
      <div className="wrap">
        <p className="kicker">Relational Sources</p>
        <h2>Supported databases</h2>
        <p className="sub">
          dlt supports <b>all SQLAlchemy dialects</b> through its <code>sql_database</code> source —
          that&apos;s the <b>30+ databases</b> dlt advertises. The catalog below is the <b>documented
          subset</b> with connection strings, driver packages, and Snowflake-relevant gotchas; any other
          SQLAlchemy dialect works too. Use the search box to filter.
        </p>

        <DatabaseCatalog />

        <Note variant="tip">
          <b>Tier</b> — <b>Verified</b>: dlt ships dialect-specific handling in its source (type
          coercion, reflect listeners) and documents it. <b>SQLAlchemy dialect</b>: works through the
          generic path; documented but no special code. <b>Unofficial</b>: a community SQLAlchemy
          dialect dlt names as such. <b>Backends</b> — the <code>backend=</code> options for that source.{' '}
          <code>sqlalchemy</code>, <code>pyarrow</code>, and <code>pandas</code> read through SQLAlchemy
          so they work for every dialect; <code>connectorx</code> (Rust, fastest) is listed only where it
          supports the dialect. For Snowflake loads prefer <code>pyarrow</code> or <code>connectorx</code>.
        </Note>
      </div>
    </section>
  );
}
