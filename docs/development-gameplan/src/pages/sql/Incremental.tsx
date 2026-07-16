import Tabs from '../../components/Tabs';
import CodeBlock from '../../components/CodeBlock';
import Note from '../../components/Note';
import DataTable from '../../components/DataTable';

const CURSOR_CODE = `<span class="kw">import</span> dlt, pendulum, logging
<span class="kw">from</span> dlt.sources.sql_database <span class="kw">import</span> <b>sql_table</b>
log = logging.getLogger(<span class="str">"dlt_pipeline"</span>)
orders = <b>sql_table</b>(
    table=<span class="str">"orders"</span>,
    backend=<span class="str">"connectorx"</span>,
    incremental=dlt.sources.<b>incremental</b>(
        <span class="str">"updated_at"</span>,
        initial_value=pendulum.parse(<span class="str">"2024-01-01T00:00:00Z"</span>),
        row_order=<span class="str">"asc"</span>,
    ),
)`;

const CDC_CODE = `customers = <b>sql_table</b>(
    table=<span class="str">"customers"</span>,
    write_disposition=<span class="str">"merge"</span>,
    primary_key=<span class="str">"customer_id"</span>,
    incremental=dlt.sources.<b>incremental</b>(<span class="str">"updated_at"</span>),
)
<span class="cmt"># range delete+insert for a daily partition</span>
daily = <b>sql_table</b>(
    table=<span class="str">"daily_metrics"</span>,
    write_disposition=<span class="str">"merge"</span>,
    primary_key=<span class="str">"id"</span>,
    merge_key=<span class="str">"event_date"</span>,
    incremental=dlt.sources.<b>incremental</b>(<span class="str">"event_date"</span>),
)`;

export default function Incremental() {
  return (
    <section className="page">
      <div className="wrap">
        <p className="kicker">Loading only what changed</p>
        <h2>Incremental &amp; CDC</h2>
        <p className="sub">
          Incremental loading pulls only new or changed rows by tracking a cursor column; the
          filter is pushed into SQL so subsequent runs skip full scans. Configured with{' '}
          <code>dlt.sources.incremental(...)</code> passed to{' '}
          <code>sql_table(incremental=...)</code>.
        </p>

        <Tabs
          tabs={[
            {
              label: 'Cursors',
              content: (
                <>
                  <DataTable
                    headers={['Parameter', 'What it does', 'Why it matters']}
                    rows={[
                      [<code>cursor_path</code>, 'Column dlt tracks on every row', 'The heartbeat of incremental; use a simple column name for SQL sources'],
                      [<code>initial_value</code>, 'Seed value on the first run when no state exists', 'Without it, first run pulls the whole table'],
                      [<code>end_value</code>, 'Hard upper bound; state is NOT written when set', 'Deterministic backfill windows; requires initial_value; disables lag + dedup'],
                      [<code>last_value_func</code>, 'max (default) or min, or custom', 'Direction of advancement; min for oldest-first sources'],
                      [<code>row_order</code>, "'asc' or 'desc'; adds ORDER BY and can close the query early", 'Avoids fetching rows outside the range'],
                      [<code>on_cursor_value_missing</code>, "'raise' (default) / 'include' / 'exclude'", 'Handles rows with NULL cursor values (common on nullable updated_at)'],
                      [<code>range_start</code>, "'closed' (\u2265, default) or 'open' (>)", "'open' also disables boundary deduplication (perf win when no overlap)"],
                      [<code>range_end</code>, "'open' (<, default) or 'closed' (\u2264)", 'Inclusive upper bound for backfills'],
                      [<code>primary_key</code>, 'Key used to hash boundary rows for dedup', 'Prevents duplicate loads at the boundary value'],
                      [<code>lag</code>, 'Attribution window subtracted from last_value', 'Re-fetch an overlap window each run (e.g. lag=86400 for 24h)'],
                      [<code>allow_external_schedulers</code>, 'Reads DLT_INTERVAL_START/END or Airflow data_interval', 'Airflow-native time-partitioned loads without code changes'],
                    ]}
                  />
                  <CodeBlock
                    label="pipelines/sql_cdc_pipeline.py (core)"
                    html={CURSOR_CODE}
                  />
                  <Note variant="tip">
                    In query params use <code>incremental.start_value</code> (the lag-adjusted
                    lower bound), not <code>last_value</code>.
                  </Note>
                </>
              ),
            },
            {
              label: 'State & resume',
              content: (
                <>
                  <p>
                    dlt stores incremental state at{' '}
                    <code>resource_state(name)["incremental"][cursor_path]</code> ={' '}
                    <code>{'{'} initial_value, last_value, unique_hashes, start_value {'}'}</code>
                    . It is serialized to the <code>_dlt_pipeline_state</code> table in Snowflake
                    on every successful run and restored on fresh or ephemeral workers (Airflow,
                    Cloud Run), so cursors survive without shared local disk.
                  </p>
                  <ul className="plain">
                    <li>
                      Boundary deduplication uses <code>unique_hashes</code> — hashes of rows
                      sharing the new <code>last_value</code> are stored and skipped next run.
                    </li>
                    <li>
                      <code>end_value</code> bypasses state entirely; use for one-off backfills.
                    </li>
                    <li>
                      A warning fires when <code>unique_hashes</code> grows past 200 (
                      <code>duplicate_cursor_warning_threshold</code>) — signals a low-resolution
                      cursor like a date-only column.
                    </li>
                  </ul>
                  <Note variant="warn">
                    Don&apos;t stuff millions of rows into state. For high-cardinality watermarks,
                    prefer destination-side lookups via the pipeline dataset rather than growing{' '}
                    <code>_dlt_pipeline_state</code>.
                  </Note>
                </>
              ),
            },
            {
              label: 'CDC merge',
              content: (
                <>
                  <p>Pair a cursor with a write disposition.</p>
                  <ul className="plain">
                    <li>
                      <code>write_disposition="append"</code> + incremental — insert-only
                      fact/event tables (watermark only)
                    </li>
                    <li>
                      <code>write_disposition="merge"</code> + <code>primary_key</code> +
                      incremental — true CDC upsert (the standard pattern for mutable tables)
                    </li>
                    <li>
                      <code>write_disposition="merge"</code> + <code>merge_key</code> — delete
                      the overlapping range then re-insert (late-arriving / daily partitions)
                    </li>
                    <li>
                      <span className="pill">scd2</span> strategy — full slowly-changing-dimension
                      history
                    </li>
                  </ul>
                  <CodeBlock label="incremental CDC upsert" html={CDC_CODE} />
                  <Note variant="tip">
                    Strategy details (delete-insert vs upsert vs scd2,{' '}
                    <code>primary_key</code> vs <code>merge_key</code>) live on the Write &amp;
                    Merge page.
                  </Note>
                </>
              ),
            },
          ]}
        />
      </div>
    </section>
  );
}
