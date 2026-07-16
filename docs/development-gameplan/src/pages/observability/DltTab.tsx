import DataTable from '../../components/DataTable';
import CodeBlock from '../../components/CodeBlock';
import Note from '../../components/Note';

const PY_RUNINFO = `<span class="kw">import</span> logging
log = logging.<b>getLogger</b>(<span class="str">"dlt_pipeline"</span>)

info = pipeline.<b>run</b>(source)
info.<b>raise_on_failed_jobs</b>()          <span class="cmt"># fail loudly if any load job failed</span>

<span class="cmt"># What ran, where, and whether it succeeded</span>
log.<b>info</b>(<span class="str">"loads: %s"</span>, info.loads_ids)                <span class="cmt"># ['1713000000.123456']</span>
log.<b>info</b>(<span class="str">"dataset=%s destination=%s"</span>, info.dataset_name, info.destination_name)
log.<b>info</b>(<span class="str">"has_failed_jobs=%s"</span>, info.has_failed_jobs)

<span class="cmt"># Serialize the whole run for a control/audit table</span>
record = info.<b>asdict</b>()               <span class="cmt"># JSON-serializable</span>`;

const PY_TRACE = `trace = pipeline.<b>last_trace</b>

<span class="cmt"># Row counts live on the NORMALIZE step (not load)</span>
counts = trace.last_normalize_info.<b>row_counts</b>
log.<b>info</b>(<span class="str">"row counts: %s"</span>, counts)      <span class="cmt"># {'orders': 1000, 'orders__items': 4200}</span>

<span class="cmt"># Per-step timing + metrics are all on the trace</span>
extract = trace.last_extract_info
load = trace.last_load_info
<span class="kw">for</span> load_id, metrics <span class="kw">in</span> load.metrics.items():
    <span class="kw">for</span> job_id, jm <span class="kw">in</span> metrics[0][<span class="str">"job_metrics"</span>].items():
        log.<b>info</b>(<span class="str">"%s %s %s %s"</span>, jm.table_name, jm.state, jm.started_at, jm.finished_at)

trace.<b>asdict</b>()                        <span class="cmt"># export the full trace</span>`;

const SQL_LOADS = `<span class="cmt">-- Load history (status = 0 means success)</span>
<span class="kw">select</span> load_id, schema_name, status, inserted_at
<span class="kw">from</span> analytics.raw_app._dlt_loads
<span class="kw">order by</span> inserted_at <span class="kw">desc</span>
<span class="kw">limit</span> 20;

<span class="cmt">-- Tag any data row with the load that produced it</span>
<span class="kw">select</span> o.*, l.inserted_at <span class="kw">as</span> loaded_at
<span class="kw">from</span> analytics.raw_app.orders o
<span class="kw">join</span> analytics.raw_app._dlt_loads l
  <span class="kw">on</span> o._dlt_load_id = l.load_id;`;

export default function DltTab() {
  return (
    <>
      <h3>Layer 1 &mdash; LoadInfo (returned by every run)</h3>
      <p>
        <code>pipeline.run()</code> returns a <code>LoadInfo</code> object: which load ids ran, the
        destination and dataset, whether any job failed, and a full serializable dict. Use{' '}
        <code>raise_on_failed_jobs()</code> to turn a bad load into an exception, which is the basis for a
        CI gate or circuit breaker.
      </p>
      <CodeBlock label="after pipeline.run()" html={PY_RUNINFO} />

      <h3>Layer 2 &mdash; the run trace</h3>
      <p>
        <code>pipeline.last_trace</code> captures each step (extract, normalize, load) with timing,
        resolved config, and metrics. Row counts are on the normalize step at{' '}
        <code>last_normalize_info.row_counts</code>; per-job load metrics (state, timing, retries) are on{' '}
        <code>last_load_info</code>.
      </p>
      <CodeBlock label="pipeline.last_trace" html={PY_TRACE} />

      <h3>Layer 3 &mdash; the _dlt_* tables in Snowflake</h3>
      <p>
        dlt writes these bookkeeping tables into your dataset automatically, so you can audit load history
        and lineage directly in SQL with no extra setup.
      </p>
      <DataTable
        headers={['Table', 'Purpose', 'Key columns']}
        rows={[
          [
            <code>_dlt_loads</code>,
            'One row per completed load',
            <>
              <code>load_id</code>, <code>status</code> (0 = success), <code>inserted_at</code>,{' '}
              <code>schema_name</code>, <code>schema_version_hash</code>
            </>,
          ],
          [
            <code>_dlt_pipeline_state</code>,
            'Versioned incremental state per pipeline',
            <>
              <code>pipeline_name</code>, <code>state</code>, <code>version</code>,{' '}
              <code>_dlt_load_id</code>
            </>,
          ],
          [
            <code>_dlt_version</code>,
            'Full schema JSON per version',
            <>
              <code>version</code>, <code>schema_name</code>, <code>version_hash</code>,{' '}
              <code>schema</code>
            </>,
          ],
          [
            'every data table',
            'Provenance columns on your loaded rows',
            <>
              <code>_dlt_load_id</code> (joins to <code>_dlt_loads.load_id</code>), <code>_dlt_id</code>
            </>,
          ],
        ]}
      />
      <CodeBlock label="query load history in Snowflake" html={SQL_LOADS} />

      <Note variant="tip">
        <b>Template pattern:</b> call <code>info.raise_on_failed_jobs()</code> after every run, persist{' '}
        <code>info.asdict()</code> plus <code>last_normalize_info.row_counts</code> to a control table, and
        assert expected row counts. History is then always available by querying <code>_dlt_loads</code>.
        Use a module logger (<code>log = logging.getLogger(...)</code>) rather than <code>print</code> so
        output is structured and honors dlt's <code>runtime.log_level</code>.
      </Note>

      <h3>App-level dashboards &amp; export hooks</h3>
      <ul className="plain">
        <li>
          <b>Marimo dashboard:</b> <code>dlt pipeline &lt;name&gt; show</code> launches a built-in
          inspection UI (requires the <code>marimo</code>, <code>pyarrow</code>, <code>ibis-framework</code>{' '}
          extras).
        </li>
        <li>
          <b>Tracking hooks:</b> register modules on <code>TRACKING_MODULES</code> (the{' '}
          <code>SupportsTracking</code> protocol) to fire callbacks on trace start/end and export runs to
          your own system. A built-in dlthub platform sink is available via <code>runtime.dlthub_dsn</code>.
        </li>
      </ul>

      <Note>
        <b>Note:</b> row counts are exposed on the normalize step, not on <code>LoadInfo</code>. For
        per-resource extract counts, read{' '}
        <code>last_extract_info.metrics[load_id][i]["resource_metrics"]</code>.
      </Note>
    </>
  );
}
