import CodeBlock from '../../components/CodeBlock';
import DataTable from '../../components/DataTable';
import Note from '../../components/Note';

export default function ApiResponseProcessing() {
  return (
    <section className="page">
      <div className="wrap">
        <p className="kicker">API Sources</p>
        <h2>Response processing</h2>
        <p className="sub">
          Between the HTTP response and the Snowflake load, rest_api lets you select which part of
          the payload is data, transform records, and react to specific status codes.
        </p>

        <h3>data_selector</h3>
        <p>
          A JSONPath pointing at the list of records in the response body. If omitted, dlt
          auto-detects by scanning for common keys —{' '}
          <span className="pill">data</span>{' '}
          <span className="pill">items</span>{' '}
          <span className="pill">results</span>{' '}
          <span className="pill">entries</span>{' '}
          <span className="pill">records</span>{' '}
          <span className="pill">rows</span>{' '}
          <span className="pill">entities</span>{' '}
          <span className="pill">payload</span>{' '}
          <span className="pill">content</span>{' '}
          <span className="pill">objects</span>{' '}
          <span className="pill">values</span>{' '}
          — while ignoring <span className="pill">meta</span>{' '}
          <span className="pill">metadata</span>{' '}
          <span className="pill">pagination</span>{' '}
          <span className="pill">links</span>{' '}
          <span className="pill">extras</span>{' '}
          <span className="pill">headers</span>. Full JSONPath is supported; bracket notation is
          required for special characters, e.g. selecting an OData next link needs{' '}
          <code>{'[\'@odata.nextLink\']'}</code>.
        </p>

        <h3>processing_steps</h3>
        <p>
          A list applied in order; each item is a dict with one key.
        </p>
        <DataTable
          headers={['Step', 'Signature', 'Effect']}
          rows={[
            ['filter', '(record) -> bool', 'keep record when True'],
            ['map', '(record) -> record', 'transform each record'],
            ['yield_map', '(record) -> Iterator[record]', 'one-to-many expansion'],
          ]}
        />
        <CodeBlock
          label="filter + map"
          html={`{
    <span class="str">"name"</span>: <span class="str">"issues"</span>,
    <span class="str">"endpoint"</span>: {<span class="str">"path"</span>: <span class="str">"issues"</span>},
    <span class="str">"processing_steps"</span>: [
        {<span class="str">"filter"</span>: <span class="kw">lambda</span> r: r[<span class="str">"state"</span>] == <span class="str">"open"</span>},
        {<span class="str">"map"</span>: <span class="kw">lambda</span> r: {**r, <span class="str">"source"</span>: <span class="str">"github"</span>}},
    ],
}`}
        />

        <h3>response_actions</h3>
        <p>
          Per-response handlers matched on <code>status_code</code> and/or a content substring. The
          action is either the string <span className="pill">"ignore"</span> (silently skip the
          response) or a callable hook that can mutate the response.
        </p>
        <DataTable
          headers={['Field', 'Purpose']}
          rows={[
            ['status_code', 'match a specific HTTP status'],
            ['content', 'match a substring in the response body'],
            ['action', '"ignore", or a callable / list of callables run as response hooks'],
          ]}
        />
        <CodeBlock
          label="ignore 404s, transform on a message"
          html={`<span class="str">"response_actions"</span>: [
    {<span class="str">"status_code"</span>: <b>404</b>, <span class="str">"action"</span>: <span class="str">"ignore"</span>},
    {<span class="str">"content"</span>: <span class="str">"rate limited"</span>, <span class="str">"action"</span>: my_backoff_hook},
]`}
        />

        <Note variant="tip">
          A bare callable placed directly in the <code>response_actions</code> list runs on EVERY
          response. dlt appends <code>raise_for_status</code> as the final fallback, so unhandled
          4xx/5xx still error. A hook may raise <code>IgnoreResponseException</code> to silently
          end pagination.
        </Note>
      </div>
    </section>
  );
}
