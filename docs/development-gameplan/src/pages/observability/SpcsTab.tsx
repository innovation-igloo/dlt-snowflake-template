import DataTable from '../../components/DataTable';
import CodeBlock from '../../components/CodeBlock';
import Note from '../../components/Note';

const SQL_LOGS = `<span class="cmt">-- The account's active event table (default: SNOWFLAKE.TELEMETRY.EVENTS)</span>
<span class="kw">show parameters like</span> <span class="str">'event_table'</span> <span class="kw">in account</span>;

<span class="cmt">-- Logs for a dlt SPCS job, last hour, newest first</span>
<span class="kw">select</span> timestamp,
       record:severity_text::string <span class="kw">as</span> severity,
       value::string                <span class="kw">as</span> message
<span class="kw">from</span> snowflake.telemetry.events
<span class="kw">where</span> record_type = <span class="str">'LOG'</span>
  <span class="kw">and</span> resource_attributes:<span class="str">"snow.service.name"</span> = <span class="str">'DLT_LOADER_JOB'</span>
  <span class="kw">and</span> resource_attributes:<span class="str">"snow.executable.type"</span> = <span class="str">'spcs'</span>
  <span class="kw">and</span> timestamp > <span class="kw">dateadd</span>(<span class="str">'hour'</span>, -1, <span class="kw">current_timestamp</span>())
<span class="kw">order by</span> timestamp <span class="kw">desc</span>;`;

const PY_STRUCTURED = `<span class="kw">import</span> logging
<span class="kw">from</span> snowflake.telemetry.logs <span class="kw">import</span> SnowflakeLogFormatter

log = logging.<b>getLogger</b>(<span class="str">"dlt_pipeline"</span>)
handler = logging.<b>StreamHandler</b>()             <span class="cmt"># stdout -> captured by SPCS</span>
handler.<b>setFormatter</b>(SnowflakeLogFormatter())  <span class="cmt"># emit JSON structured logs</span>
log.<b>addHandler</b>(handler)
log.<b>setLevel</b>(logging.INFO)

<span class="cmt"># extra= lands in RECORD_ATTRIBUTES as queryable fields</span>
log.<b>info</b>(<span class="str">"load complete"</span>, extra={<span class="str">"rows"</span>: counts, <span class="str">"pipeline"</span>: <span class="str">"sql_cdc"</span>})
log.<b>error</b>(<span class="str">"load failed"</span>, extra={<span class="str">"table"</span>: <span class="str">"orders"</span>})`;

const SQL_STRUCTURED = `<span class="cmt">-- Only ERROR lines, reading a custom attribute out of the log</span>
<span class="kw">select</span> timestamp,
       value::string              <span class="kw">as</span> message,
       record_attributes:table    <span class="kw">as</span> failed_table
<span class="kw">from</span> snowflake.telemetry.events
<span class="kw">where</span> record_type = <span class="str">'LOG'</span>
  <span class="kw">and</span> resource_attributes:<span class="str">"snow.service.name"</span> = <span class="str">'DLT_LOADER_JOB'</span>
  <span class="kw">and</span> record:severity_text::string = <span class="str">'ERROR'</span>
  <span class="kw">and</span> timestamp > <span class="kw">dateadd</span>(<span class="str">'day'</span>, -1, <span class="kw">current_timestamp</span>())
<span class="kw">order by</span> timestamp <span class="kw">desc</span>;`;

const SQL_METRICS = `<span class="cmt">-- CPU/memory for the job (enable via spec.platformMonitor)</span>
<span class="kw">select</span> timestamp,
       record:metric.name::string <span class="kw">as</span> metric,
       value                      <span class="kw">as</span> val
<span class="kw">from</span> snowflake.telemetry.events
<span class="kw">where</span> record_type = <span class="str">'METRIC'</span>
  <span class="kw">and</span> resource_attributes:<span class="str">"snow.service.name"</span> = <span class="str">'DLT_LOADER_JOB'</span>
  <span class="kw">and</span> record:metric.name::string <span class="kw">in</span> (<span class="str">'container.memory.usage'</span>, <span class="str">'container.cpu.usage'</span>)
  <span class="kw">and</span> timestamp > <span class="kw">dateadd</span>(<span class="str">'hour'</span>, -1, <span class="kw">current_timestamp</span>())
<span class="kw">order by</span> timestamp <span class="kw">desc</span>;`;

export default function SpcsTab() {
  return (
    <>
      <p>
        When a dlt pipeline runs inside SPCS, the container's stdout/stderr, platform metrics, and status
        events flow into Snowflake's <b>event table</b> as OpenTelemetry records. Query that table. It is
        the persistent, set-based, account-wide system of record you build dashboards and alerts on.
      </p>

      <h3>The telemetry event table</h3>
      <p>
        Snowflake provides a default event table, <code>SNOWFLAKE.TELEMETRY.EVENTS</code>, with a
        row-access-policy-manageable view <code>SNOWFLAKE.TELEMETRY.EVENTS_VIEW</code>. You can also create
        your own with <code>CREATE EVENT TABLE</code> (with <code>CLUSTER BY</code> and{' '}
        <code>DATA_RETENTION_TIME_IN_DAYS</code> for scale) and point the account at it. Find the active one
        with <code>SHOW PARAMETERS LIKE 'event_table' IN ACCOUNT</code>.
      </p>
      <p>
        It uses one OpenTelemetry schema for logs, metrics, and traces, discriminated by{' '}
        <code>RECORD_TYPE</code>:
      </p>
      <p>
        <span className="pill">LOG &middot; a log line</span>
        <span className="pill">METRIC &middot; a data point</span>
        <span className="pill">SPAN / SPAN_EVENT &middot; traces</span>
        <span className="pill">EVENT &middot; operational events</span>
      </p>
      <DataTable
        headers={['Column', 'Holds']}
        rows={[
          [<code>TIMESTAMP</code>, 'UTC time the event was emitted'],
          [
            <code>RECORD_TYPE</code>,
            <>
              <code>LOG</code> / <code>METRIC</code> / <code>SPAN</code> / <code>SPAN_EVENT</code> /{' '}
              <code>EVENT</code>
            </>,
          ],
          [
            <code>RESOURCE_ATTRIBUTES</code>,
            <>
              Source of the event: <code>snow.service.name</code>,{' '}
              <code>snow.executable.type = 'spcs'</code>, database, schema, warehouse, user
            </>,
          ],
          [
            <code>RECORD</code>,
            <>
              Fixed fields per type: <code>severity_text</code> (LOG), <code>metric.name</code>/
              <code>unit</code> (METRIC)
            </>,
          ],
          [
            <code>RECORD_ATTRIBUTES</code>,
            <>
              Variable fields: <code>code.filepath</code>, <code>code.function</code>,{' '}
              <code>code.lineno</code>, plus your custom attributes
            </>,
          ],
          [<code>VALUE</code>, 'The log message, or the numeric value of a metric (VARIANT)'],
          [
            <code>TRACE</code>,
            <>
              <code>trace_id</code> / <code>span_id</code> for spans
            </>,
          ],
        ]}
      />

      <h3>Querying a dlt job's logs at scale</h3>
      <p>
        Filter by service name and time. Always time-bound the query. The event table is high-volume, and a
        timestamp predicate is what keeps it fast.
      </p>
      <CodeBlock label="logs from the event table" html={SQL_LOGS} />

      <h3>Structured logs from dlt</h3>
      <p>
        Attach the Snowflake-provided <code>SnowflakeLogFormatter</code> to your logger and each line is
        parsed into columns: <code>severity_text</code> into <code>RECORD</code>, and anything you pass via{' '}
        <code>extra=</code> into <code>RECORD_ATTRIBUTES</code>. This is why <code>log.info(...)</code> beats{' '}
        <code>print</code>: the output becomes filterable, aggregatable SQL instead of opaque text.
      </p>
      <CodeBlock label="structured logging in the pipeline container" html={PY_STRUCTURED} />
      <CodeBlock label="filter by severity + a custom attribute" html={SQL_STRUCTURED} />

      <h3>Job health: metrics &amp; platform events</h3>
      <p>
        Opt into platform metrics with <code>spec.platformMonitor.metricConfig.groups</code> (
        <code>system</code>, <code>system_limits</code>, <code>status</code>, ...). CPU and memory land as{' '}
        <code>METRIC</code> rows; a pipeline that blows its memory limit shows{' '}
        <code>container.state.last.finished.reason = FailedWithOOM</code>. Enable container status changes
        (Running, OOMKilled, fatal error) as <code>EVENT</code> rows with the <code>LOG_EVENT_LEVEL</code>{' '}
        parameter.
      </p>
      <CodeBlock label="resource usage from the event table" html={SQL_METRICS} />

      <h3>Setup &amp; limits</h3>
      <ul className="plain">
        <li>
          <code>spec.logExporters.eventTableConfig.logLevel</code>: <code>INFO</code> (all) /{' '}
          <code>ERROR</code> (stderr only) / <code>NONE</code>.
        </li>
        <li>
          <code>LOG_LEVEL</code> on the service sets the severity of container logs captured;{' '}
          <code>LOG_EVENT_LEVEL</code> controls platform events. Both inherit from schema/database/account
          if unset.
        </li>
        <li>
          Ingest limits: <b>1 MB/s per node</b> for logs; max record size <b>16 KiB</b>. Keep log lines
          reasonable and lean on structured attributes over giant messages.
        </li>
      </ul>

      <Note variant="tip">
        <b>Build on the event table.</b> Point dashboards and alerts at{' '}
        <code>SNOWFLAKE.TELEMETRY.EVENTS</code> (or your own event table / <code>EVENTS_VIEW</code>). It is
        the scalable source of truth for both dlt's application logs and SPCS infrastructure telemetry.
        Always include a timestamp predicate.
      </Note>
    </>
  );
}
