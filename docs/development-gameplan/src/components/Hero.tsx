export default function Hero() {
  return (
    <header className="hero">
      <div className="wrap">
        <span className="eyebrow">Build Gameplan &middot; Internal Reference</span>
        <h1>
          dlt &rarr; <span className="accent">Snowflake</span> Enterprise Template
        </h1>
        <p className="lede">
          A single reference for building a production-grade, reusable template that lets a new user
          stand up any SQL-based (CDC included) or REST-API ingestion pipeline into Snowflake, and run
          it natively via SPCS containers and Snowflake Tasks.
        </p>
        <div className="hero-meta">
          <span>
            <b>Sources</b> Postgres &middot; SQL Server &middot; MySQL &middot; Oracle &middot; REST APIs
          </span>
          <span>
            <b>Destination</b> Snowflake (internal stage default)
          </span>
          <span>
            <b>Runtime</b> SPCS Container + Snowflake Tasks
          </span>
        </div>
      </div>
    </header>
  );
}
