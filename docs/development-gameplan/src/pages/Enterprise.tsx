import Card from '../components/Card';
import Note from '../components/Note';

export default function Enterprise() {
  return (
    <section className="page">
      <div className="wrap">
        <p className="kicker">Production Hardening</p>
        <h2>Enterprise cross-cutting concerns</h2>
        <p className="sub">
          The things that separate a demo from a production template. Each is wired into the template
          defaults so a new user inherits them for free.
        </p>

        <div className="grid grid-2">
          <Card icon="📈" title="Observability">
            Set a <code>query_tag</code> on the destination so every dlt statement is attributable in{' '}
            <code>QUERY_HISTORY</code>. Persist <code>pipeline.run()</code> load info (row counts, timing,
            load ids) to a control table and assert expected row counts.
          </Card>
          <Card icon="🔁" title="Schema evolution & contracts">
            dlt evolves the target schema as sources change. Pin behavior with schema contracts (
            <code>evolve</code> / <code>freeze</code> / <code>discard</code>) per table so unexpected new
            columns don't silently reshape production tables.
          </Card>
          <Card icon="⚡" title="Performance">
            Choose an Arrow backend, tune <code>chunk_size</code>, enable{' '}
            <code>use_vectorized_scanner</code> on <code>COPY INTO</code>, and use the{' '}
            <code>staging-optimized</code> replace strategy with <code>enable_atomic_swap</code> for
            zero-downtime full reloads.
          </Card>
          <Card icon="🔒" title="State & idempotency">
            dlt stores incremental state per pipeline so re-runs resume from the last watermark. Merge
            dispositions with a primary key make re-runs idempotent. Keep pipeline state consistent across
            SPCS runs (it persists in the destination dataset).
          </Card>
          <Card icon="🛰️" title="Anonymous telemetry off">
            dlt sends <b>anonymous usage telemetry</b> to dltHub by default (outbound HTTPS on every run
            and CLI command). The template disables it with{' '}
            <code>runtime.dlthub_telemetry=false</code> in <code>.dlt/config.toml</code>, so nothing leaves
            your environment — important for egress-restricted SPCS and compliance. This is separate from
            observability (the Snowflake event table and <code>OPS._DLT_RUNS</code> stay in your account).
          </Card>
        </div>

        <Note>
          <b>Testing:</b> the template ships a DuckDB-backed smoke test so contributors can validate
          pipeline logic locally without touching Snowflake, plus a CI job that lints and import-checks
          the pipelines.
        </Note>
      </div>
    </section>
  );
}
