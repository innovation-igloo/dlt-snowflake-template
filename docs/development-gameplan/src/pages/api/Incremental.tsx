import CodeBlock from '../../components/CodeBlock';
import DataTable from '../../components/DataTable';
import Note from '../../components/Note';

export default function ApiIncremental() {
  const codeHtml = `{
    <span class="str">"name"</span>: <span class="str">"issues"</span>,
    <span class="str">"endpoint"</span>: {
        <span class="str">"path"</span>: <span class="str">"issues"</span>,
        <span class="str">"params"</span>: {<span class="str">"since"</span>: <span class="str">"{incremental.start_value}"</span>},
        <span class="str">"incremental"</span>: {
            <span class="str">"cursor_path"</span>: <span class="str">"updated_at"</span>,
            <span class="str">"initial_value"</span>: <span class="str">"2024-01-01T00:00:00Z"</span>,
        },
    },
    <span class="str">"primary_key"</span>: <span class="str">"id"</span>,
    <span class="str">"write_disposition"</span>: <span class="str">"merge"</span>,
}`;

  return (
    <section className="page">
      <div className="wrap">
        <p className="kicker">API Sources</p>
        <h2>Incremental loading</h2>
        <p className="sub">
          Incremental loading for APIs works by reading a cursor value back from each record
          (<code>cursor_path</code>) and injecting the tracked high-watermark into the next request.
          Declare it in the endpoint&apos;s <code>incremental</code> block and reference the value
          with placeholders.
        </p>

        <h3>IncrementalConfig keys</h3>
        <DataTable
          headers={['Key', 'Purpose']}
          rows={[
            [<code>cursor_path</code>, 'JSONPath into each record to read the cursor value (e.g. "updated_at")'],
            [<code>initial_value</code>, 'Value used on the first run'],
            [<code>end_value</code>, 'Optional upper bound (closes the window)'],
            [<code>row_order</code>, '"asc" / "desc" hint enabling early stop'],
            [<code>convert</code>, 'Callable to transform the cursor value before it goes into the request'],
            [
              <code>start_param / end_param</code>,
              '(Legacy) query-param names to inject start/end into; prefer placeholders',
            ],
          ]}
        />

        <h3>Placeholders</h3>
        <p>
          Reference the incremental state anywhere in <code>params</code>, <code>json</code>,{' '}
          <code>data</code>, <code>headers</code>, or <code>path</code> using these tokens:
        </p>
        <p>
          <span className="pill">{'{incremental.start_value}'}</span>{' '}
          <span className="pill">{'{incremental.initial_value}'}</span>{' '}
          <span className="pill">{'{incremental.last_value}'}</span>{' '}
          <span className="pill">{'{incremental.end_value}'}</span>
        </p>

        <CodeBlock label="incremental block + placeholder param" html={codeHtml} />

        <Note variant="warn">
          Only ONE incremental parameter is allowed per endpoint (a second raises{' '}
          <code>ValueError</code>). <code>end_value</code> / <code>end_param</code> only belong in
          the <code>incremental</code> block, not in inline params. The old <code>transform</code>{' '}
          key is deprecated &mdash; use <code>convert</code>. Pair incremental with{' '}
          <code>write_disposition=&quot;merge&quot;</code> + <code>primary_key</code> for idempotent
          upserts into Snowflake.
        </Note>
      </div>
    </section>
  );
}
