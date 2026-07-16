export default function AboutHero() {
  return (
    <header className="hero">
      <div className="wrap">
        <span className="hero-lockup">
          <b>dlt</b> <span className="x">&times;</span> <b>Snowflake</b>
        </span>
        <h1>
          The code-first way to get data into <span className="accent">Snowflake</span>
        </h1>
        <p className="lede">
          dlt is the open-source Python library that consolidates data from REST APIs, SQL databases,
          files, and cloud storage into Snowflake. It runs where Python runs &mdash; your cloud, VPC, or
          data center &mdash; with no vendor lock-in and no black-box connectors.
        </p>
        <div className="hero-meta">
          <span>
            <b>Sources</b> 10,100+ REST APIs &middot; 30+ SQL databases &middot; S3 / GCS / Azure
          </span>
          <span>
            <b>License</b> Apache 2.0 &middot; fully open source
          </span>
          <span>
            <b>Runs</b> anywhere Python runs &rarr; Snowflake
          </span>
        </div>
        <a
          className="hero-cta"
          href="https://dlthub.com/docs/dlt-ecosystem/destinations/snowflake"
          target="_blank"
          rel="noreferrer"
        >
          Load your data to Snowflake in Python &rarr;
        </a>
      </div>
    </header>
  );
}
