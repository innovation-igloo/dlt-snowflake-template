import Note from '../../components/Note';

export default function VerifiedOps() {
  return (
    <section className="page">
      <div className="wrap">
        <p className="kicker">SaaS &amp; App Sources</p>
        <h2>Operations &amp; limits</h2>
        <p className="sub">
          Verified sources hit third-party APIs, so operating them well means respecting rate
          limits and understanding what dlt does (and does not) do.
        </p>

        <h3>API rate limits</h3>
        <p>
          Each SaaS enforces its own request limits; verified sources often expose a dev/prod
          toggle or query cap (e.g. Salesforce <code>IS_PRODUCTION</code> / query limit). Schedule
          conservatively and lean on incremental so you pull deltas, not full tables.
        </p>

        <h3>Running on SPCS</h3>
        <p>
          Verified-source pipelines run the same way as the rest of this template — packaged in
          the image, run as an SPCS job on the shared <code>DLT_POOL</code>, scheduled by a Task,
          loading through <code>DLT_WH</code>. The vendored source module ships in the image.
          Reference the Scaling and Deploy pages.
        </p>

        <h3>One-way ingestion — not bilateral</h3>
        <Note variant="warn">
          dlt is extract-and-load ONLY: source &rarr; Snowflake. There is NO writeback / reverse
          sync to the SaaS. If you need to push data back (e.g. update Salesforce records), that
          is reverse-ETL and requires separate tooling (Census, Hightouch, or a custom API
          writer). Verified sources do not make the flow bidirectional.
        </Note>

        <h3>Observability</h3>
        <p>
          Verified-source runs land in the same control table (<code>OPS._DLT_RUNS</code>) and
          event-table logs as SQL/REST pipelines; the multi-pipeline collector treats them
          identically (keyed by pipeline name). Reference the Observability page.
        </p>
      </div>
    </section>
  );
}
