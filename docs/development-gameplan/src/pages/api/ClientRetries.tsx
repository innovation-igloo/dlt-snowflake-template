import CodeBlock from '../../components/CodeBlock';
import DataTable from '../../components/DataTable';
import Note from '../../components/Note';

const tomlBlock = `<span class="cmt">[runtime]</span>
request_max_attempts = 5
request_backoff_factor = 1
request_timeout = 60
request_max_retry_delay = 300
<span class="cmt"># log response bodies on error (helpful when debugging 4xx/5xx)</span>
http_show_error_body = <span class="kw">true</span>
http_max_error_body_length = 8192`;

const sessionBlock = `<span class="kw">from</span> dlt.sources.helpers <span class="kw">import</span> requests
session = requests.Client(
    status_codes=(<span class="str">403</span>, <span class="str">500</span>, <span class="str">502</span>, <span class="str">503</span>),
    exceptions=(requests.ConnectionError, requests.ChunkedEncodingError),
    request_timeout=(<span class="str">1.0</span>, <span class="str">1.0</span>),
).session
config[<span class="str">"client"</span>][<span class="str">"session"</span>] = session`;

export default function ApiClientRetries() {
  return (
    <section className="page">
      <div className="wrap">
        <p className="kicker">API Sources</p>
        <h2>Client &amp; retries</h2>
        <p className="sub">
          rest_api uses dlt&apos;s retrying HTTP client by default. You tune it with [runtime] config,
          or inject your own requests.Session for full control.
        </p>

        <h3>Retry &amp; backoff config</h3>
        <p>Set these under [runtime] in config.toml (or as RUNTIME__ env vars).</p>
        <DataTable
          headers={['Key', 'Default', 'Purpose']}
          rows={[
            ['request_max_attempts', '5', 'max retry attempts'],
            ['request_backoff_factor', '1', 'exponential backoff multiplier'],
            ['request_timeout', '60', 'connect + read timeout (seconds)'],
            ['request_max_retry_delay', '300', 'cap on the exponential delay'],
          ]}
        />
        <CodeBlock label="config.toml" html={tomlBlock} />

        <h3>What gets retried</h3>
        <p>
          Automatically retried on all 5xx statuses plus 429, and on{' '}
          <span className="pill">ConnectionError</span>,{' '}
          <span className="pill">Timeout</span>, and{' '}
          <span className="pill">ChunkedEncodingError</span>. For 429/503 the{' '}
          <span className="pill">Retry-After</span> header is respected and overrides the computed backoff.
        </p>

        <h3>Custom session</h3>
        <p>
          Build a session from dlt&apos;s retry <span className="pill">Client</span> and pass it as{' '}
          <span className="pill">client.session</span> (or to{' '}
          <span className="pill">RESTClient(session=...)</span>) to override status codes, exceptions,
          or a custom retry predicate.
        </p>
        <CodeBlock label="inject a custom retry client" html={sessionBlock} />

        <h3>Security &amp; logging</h3>
        <p>
          dlt redacts sensitive query-param names in logs and exception messages &mdash; including{' '}
          <span className="pill">api_key</span>,{' '}
          <span className="pill">token</span>,{' '}
          <span className="pill">key</span>,{' '}
          <span className="pill">access_token</span>,{' '}
          <span className="pill">apikey</span>,{' '}
          <span className="pill">api-key</span>,{' '}
          <span className="pill">access-token</span>,{' '}
          <span className="pill">secret</span>,{' '}
          <span className="pill">password</span>,{' '}
          <span className="pill">pwd</span>,{' '}
          <span className="pill">client_secret</span>. Set{' '}
          <span className="pill">http_show_error_body = true</span> to include the response body in
          error logs (bounded by <span className="pill">http_max_error_body_length</span>).
        </p>

        <Note variant="warn">
          If you pass custom response <code>hooks</code> to the client, dlt does NOT auto-add its{' '}
          <code>raise_for_status</code> hook &mdash; you become responsible for raising on error
          statuses. Raising <code>IgnoreResponseException</code> inside a hook silently ends
          pagination.
        </Note>
      </div>
    </section>
  );
}
