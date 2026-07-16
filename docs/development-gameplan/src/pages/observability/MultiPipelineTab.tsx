import DataTable from '../../components/DataTable';
import CodeBlock from '../../components/CodeBlock';
import Note from '../../components/Note';

const PY_COLLECTOR = `<span class="cmt"># in the runner, after each pipeline.run() — keyed off the registry name</span>
info = pipeline.<b>run</b>(source)
info.<b>raise_on_failed_jobs</b>()
counts = pipeline.last_trace.last_normalize_info.row_counts

<span class="cmt"># one row per (pipeline, load) in a shared control table — the collector</span>
ops = dlt.<b>pipeline</b>(pipeline_name=<span class="str">"ops_meta"</span>, destination=<span class="str">"snowflake"</span>, dataset_name=<span class="str">"OPS"</span>)
ops.<b>run</b>(
    [{<span class="str">"pipeline"</span>: spec.name, <span class="str">"load_id"</span>: info.loads_ids[0],
      <span class="str">"status"</span>: <span class="str">"ok"</span>, <span class="str">"row_counts"</span>: dict(counts),
      <span class="str">"finished_at"</span>: datetime.<b>utcnow</b>().<b>isoformat</b>()}],
    table_name=<span class="str">"_dlt_runs"</span>, write_disposition=<span class="str">"append"</span>,
)`;

const SQL_FLEET = `<span class="cmt">-- fleet-wide load health across ALL pipelines, one query</span>
<span class="kw">select</span> pipeline,
       <span class="kw">count</span>(*)                              <span class="kw">as</span> runs,
       <span class="kw">sum</span>(<span class="kw">iff</span>(status = <span class="str">'ok'</span>, 0, 1))         <span class="kw">as</span> failures,
       <span class="kw">max</span>(finished_at)                       <span class="kw">as</span> last_run
<span class="kw">from</span> ops.raw._dlt_runs        <span class="cmt">-- written by the runner for every pipeline</span>
<span class="kw">group by</span> pipeline
<span class="kw">order by</span> failures <span class="kw">desc</span>, last_run <span class="kw">desc</span>;`;

const PY_LOGTAG = `<span class="kw">import</span> logging
<span class="kw">from</span> snowflake.telemetry.logs <span class="kw">import</span> SnowflakeLogFormatter

base = logging.<b>getLogger</b>(<span class="str">"dlt_pipeline"</span>)
handler = logging.<b>StreamHandler</b>()
handler.<b>setFormatter</b>(SnowflakeLogFormatter())
base.<b>addHandler</b>(handler)

<span class="cmt"># tag every line with the pipeline name so the event table is groupable</span>
log = logging.<b>LoggerAdapter</b>(base, {<span class="str">"pipeline"</span>: spec.name})
log.<b>info</b>(<span class="str">"load complete"</span>, extra={<span class="str">"rows"</span>: counts})`;

const SQL_LOGTAG = `<span class="cmt">-- errors across the whole fleet, grouped by pipeline (event table)</span>
<span class="kw">select</span> record_attributes:pipeline::string <span class="kw">as</span> pipeline,
       <span class="kw">count</span>(*)                            <span class="kw">as</span> errors
<span class="kw">from</span> snowflake.telemetry.events
<span class="kw">where</span> record_type = <span class="str">'LOG'</span>
  <span class="kw">and</span> record:severity_text::string = <span class="str">'ERROR'</span>
  <span class="kw">and</span> resource_attributes:<span class="str">"snow.service.name"</span> <span class="kw">like</span> <span class="str">'DLT_JOB_%'</span>
  <span class="kw">and</span> timestamp > <span class="kw">dateadd</span>(<span class="str">'day'</span>, -1, <span class="kw">current_timestamp</span>())
<span class="kw">group by</span> pipeline
<span class="kw">order by</span> errors <span class="kw">desc</span>;`;

export default function MultiPipelineTab() {
  return (
    <>
      <p>
        With the registry, N pipelines run from one image on a shared pool and warehouse. Observability
        has to span all of them <b>automatically</b> — adding a pipeline to <code>registry.yml</code>{' '}
        should not require touching a dashboard. Some of that is free; some needs a deliberate pattern.
      </p>

      <h3>What you get per pipeline for free</h3>
      <p>
        Because the runner does <code>dlt.pipeline(pipeline_name=spec.name, dataset_name=...)</code> for
        each entry, dlt writes its bookkeeping tables per pipeline with zero extra code:
      </p>
      <DataTable
        headers={['Signal', 'Where', 'Multi-pipeline behavior']}
        rows={[
          [
            <code>_dlt_loads</code>,
            "each pipeline's dataset",
            'One load-history table per dataset — isolated, but fragmented across datasets',
          ],
          [
            <code>_dlt_pipeline_state</code>,
            "each pipeline's dataset",
            <>
              Carries a <code>pipeline_name</code> column; incremental state is isolated per pipeline
            </>,
          ],
          [
            'container logs',
            'event table',
            <>
              Each job logs under its own <code>snow.service.name</code> (<code>dlt_job_&lt;name&gt;</code>)
            </>,
          ],
        ]}
      />

      <Note variant="warn">
        <b>The fragmentation trap.</b> Per-pipeline <code>_dlt_loads</code> means load history is split
        across N datasets, and event-table queries pinned to a single{' '}
        <code>snow.service.name = 'DLT_LOADER_JOB'</code> only ever see one pipeline. Neither gives you a
        fleet view, and neither picks up a newly added pipeline on its own.
      </Note>

      <h3>Pattern 1 — one control table (the collector)</h3>
      <p>
        Have the runner append every run to a single shared table keyed by pipeline. This is the actual
        &quot;collector&quot;, and it is dynamic by construction: the runner writes it for whatever
        pipeline it is handed, so new registry entries appear with no dashboard changes.
      </p>
      <CodeBlock label="runner: persist each run to OPS._dlt_runs" html={PY_COLLECTOR} />
      <CodeBlock label="fleet-wide health in one query" html={SQL_FLEET} />

      <h3>Pattern 2 — tag logs with the pipeline</h3>
      <p>
        Attach <code>SnowflakeLogFormatter</code> and wrap the logger in a{' '}
        <code>LoggerAdapter</code> that injects <code>pipeline=spec.name</code>. Every line then carries the
        pipeline as a queryable attribute, and a service-name <code>LIKE 'DLT_JOB_%'</code> filter spans
        the whole fleet instead of one job.
      </p>
      <CodeBlock label="runner: pipeline-tagged structured logs" html={PY_LOGTAG} />
      <CodeBlock label="fleet errors grouped by pipeline (event table)" html={SQL_LOGTAG} />

      <Note variant="tip">
        <b>Keep it dynamic.</b> Both patterns key off the registry <code>name</code>: a control table
        written per run and logs tagged with the pipeline. Once wired, adding a pipeline to{' '}
        <code>registry.yml</code> needs <b>zero</b> observability changes — it just shows up in the
        fleet queries. Optionally register a <code>TRACKING_MODULES</code> hook so the export fires
        uniformly regardless of which pipeline ran.
      </Note>
    </>
  );
}
