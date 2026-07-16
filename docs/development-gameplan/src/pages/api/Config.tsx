import CodeBlock from '../../components/CodeBlock';
import DataTable from '../../components/DataTable';
import Note from '../../components/Note';

const ANCHOR_CODE = `<span class="kw">import</span> dlt
<span class="kw">from</span> dlt.sources.rest_api <span class="kw">import</span> <b>rest_api_source</b>
source = <b>rest_api_source</b>({
    <span class="str">"client"</span>: {
        <span class="str">"base_url"</span>: <span class="str">"https://api.example.com/v1/"</span>,
        <span class="str">"auth"</span>: {<span class="str">"token"</span>: dlt.secrets[<span class="str">"sources.rest_api.token"</span>]},   <span class="cmt"># bearer</span>
        <span class="str">"paginator"</span>: <span class="str">"json_link"</span>,
    },
    <span class="str">"resource_defaults"</span>: {<span class="str">"primary_key"</span>: <span class="str">"id"</span>, <span class="str">"write_disposition"</span>: <span class="str">"merge"</span>},
    <span class="str">"resources"</span>: [
        {
            <span class="str">"name"</span>: <span class="str">"issues"</span>,
            <span class="str">"endpoint"</span>: {
                <span class="str">"path"</span>: <span class="str">"issues"</span>,
                <span class="str">"params"</span>: {<span class="str">"since"</span>: <span class="str">"{incremental.start_value}"</span>},
                <span class="str">"incremental"</span>: {<span class="str">"cursor_path"</span>: <span class="str">"updated_at"</span>, <span class="str">"initial_value"</span>: <span class="str">"2024-01-01T00:00:00Z"</span>},
            },
        },
        {   <span class="cmt"># dependent resource: one call per parent issue</span>
            <span class="str">"name"</span>: <span class="str">"comments"</span>,
            <span class="str">"endpoint"</span>: {<span class="str">"path"</span>: <span class="str">"issues/{resources.issues.number}/comments"</span>},
        },
    ],
})
dlt.<b>pipeline</b>(pipeline_name=<span class="str">"api"</span>, destination=<span class="str">"snowflake"</span>, dataset_name=<span class="str">"raw_api"</span>).<b>run</b>(source)`;

const POST_CODE = `{
    <span class="str">"name"</span>: <span class="str">"search"</span>,
    <span class="str">"endpoint"</span>: {
        <span class="str">"path"</span>: <span class="str">"search"</span>,
        <span class="str">"method"</span>: <span class="str">"POST"</span>,
        <span class="str">"json"</span>: {<span class="str">"query"</span>: <span class="str">"dlt"</span>, <span class="str">"size"</span>: 100},
        <span class="str">"data_selector"</span>: <span class="str">"results"</span>,
    },
}`;

const SCAFFOLD = `<span class="cmt"># scaffold a runnable REST API pipeline (GitHub + Pokemon examples)</span>
dlt init rest_api snowflake     <span class="cmt"># or: dlt init rest_api duckdb (local dev)</span>
<span class="cmt"># creates rest_api_pipeline.py, .dlt/ (config.toml + secrets.toml), requirements.txt</span>`;

export default function ApiConfig() {
  return (
    <section className="page">
      <div className="wrap">
        <p className="kicker">API Sources</p>
        <h2>Config & Resources</h2>
        <p className="sub">
          dlt's <code>rest_api</code> source is declarative — you describe the API as a{' '}
          <code>RESTAPIConfig</code> dict and dlt makes the requests. Three top-level keys.
        </p>

        <h3>Scaffold it (dlt init)</h3>
        <p>
          To crib from working examples, let dlt generate a starter pipeline. <code>dlt init</code>{' '}
          writes a runnable <code>rest_api_pipeline.py</code> (GitHub + Pokemon endpoints), a{' '}
          <code>.dlt/</code> folder, and <code>requirements.txt</code> into the current directory.
        </p>
        <CodeBlock label="terminal" html={SCAFFOLD} />
        <Note variant="tip">
          This template doesn't run a standalone script: instead of keeping <code>rest_api_pipeline.py</code>,
          you express each API as a declarative <code>rest_api</code> entry in{' '}
          <code>pipelines/registry.yml</code> (the shape below) so the generic runner and one image drive
          it. Use <code>dlt init</code> to explore, then port the config into the registry. dltHub also
          publishes pre-built config for thousands of APIs at{' '}
          <code>dlthub.com/context</code> if you'd rather start from a known source.
        </Note>

        <h3>Top-level shape</h3>
        <p>
          A <code>RESTAPIConfig</code> has three keys — <code>client</code> (required: connection
          settings), <code>resources</code> (required: the endpoints to load; each is a string, an{' '}
          <code>EndpointResource</code> dict, or a <code>DltResource</code>), and{' '}
          <code>resource_defaults</code> (optional: merged into every resource).
        </p>

        <CodeBlock label="pipelines/rest_api_pipeline.py (core)" html={ANCHOR_CODE} />

        <h3>client</h3>
        <DataTable
          headers={['Key', 'Purpose']}
          rows={[
            [<code>base_url</code>, 'Root URL prepended to every resource path'],
            [<code>headers</code>, 'Static headers sent on every request (no placeholder support at client level)'],
            [<code>auth</code>, 'Client-wide auth, overridable per endpoint'],
            [<code>paginator</code>, 'Default paginator, lowest precedence'],
            [<code>session</code>, 'Inject a custom requests.Session (e.g. custom retry/timeout)'],
          ]}
        />

        <h3>Resource hints (EndpointResource)</h3>
        <DataTable
          headers={['Hint', 'Purpose']}
          rows={[
            [<code>name</code>, 'Resource + destination table name'],
            [<code>endpoint</code>, 'Path string (shorthand) or full Endpoint dict'],
            [<code>primary_key</code>, 'Merge/dedup key'],
            [<code>write_disposition</code>, 'append / replace / merge'],
            [<code>table_name</code>, 'Override destination table'],
            [<code>columns</code>, 'Explicit column schema hints'],
            [<code>max_table_nesting</code>, 'Max nested-table depth'],
            [<code>selected</code>, 'Whether the resource loads'],
            [<code>parallelized</code>, 'Concurrent child fetch for dependent resources'],
            [<code>processing_steps</code>, 'filter / map / yield_map transforms'],
            [<code>include_from_parent</code>, 'Parent fields to copy onto child records'],
          ]}
        />

        <h3>Endpoint dict</h3>
        <DataTable
          headers={['Key', 'Purpose']}
          rows={[
            [<code>path</code>, 'Relative path; defaults to the resource name if omitted'],
            [<code>method</code>, 'GET (default) or POST'],
            [<code>params</code>, 'Query parameters (support placeholders + typed incremental/resolve dicts)'],
            [<code>json</code>, 'JSON request body (POST); mutually exclusive with data'],
            [<code>data</code>, 'Form-encoded / raw body (POST); mutually exclusive with json'],
            [<code>headers</code>, <>Endpoint headers; SUPPORT placeholders ({'{resources.*}'}, {'{incremental.*}'})</>],
            [<code>paginator</code>, 'Highest-precedence paginator for this endpoint'],
            [<code>data_selector</code>, 'JSONPath to the data list; auto-detected if omitted'],
            [<code>response_actions</code>, 'Per-response handlers (ignore/transform)'],
            [<code>incremental</code>, 'Incremental-loading config'],
            [<code>auth</code>, 'Per-endpoint auth override'],
          ]}
        />

        <CodeBlock label="POST endpoint with a JSON body" html={POST_CODE} />

        <Note variant="tip">
          Only endpoint-level <code>headers</code> support {'{resources.*}'} /{' '}
          {'{incremental.*}'} placeholders — client-level headers are static. If you omit{' '}
          <code>data_selector</code>, dlt auto-detects the data list in the response.
        </Note>
      </div>
    </section>
  );
}
