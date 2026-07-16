import CodeBlock from '../../components/CodeBlock';
import DataTable from '../../components/DataTable';
import Note from '../../components/Note';

const AUTH_CODE = `<span class="cmt"># shorthand bearer — the {"token": ...} dict defaults to bearer</span>
<span class="str">"client"</span>: {<span class="str">"auth"</span>: {<span class="str">"token"</span>: <b>dlt</b>.secrets[<span class="str">"sources.rest_api.token"</span>]}}
<span class="cmt"># explicit OAuth2 client-credentials</span>
<span class="str">"client"</span>: {
    <span class="str">"auth"</span>: {
        <span class="str">"type"</span>: <span class="str">"oauth2_client_credentials"</span>,
        <span class="str">"access_token_url"</span>: <span class="str">"https://api.example.com/oauth/token"</span>,
        <span class="str">"client_id"</span>: <b>dlt</b>.secrets[<span class="str">"sources.rest_api.client_id"</span>],
        <span class="str">"client_secret"</span>: <b>dlt</b>.secrets[<span class="str">"sources.rest_api.client_secret"</span>],
    }
}`;

export default function ApiAuth() {
  return (
    <section className="page">
      <div className="wrap">
        <p className="kicker">API Sources</p>
        <h2>Authentication</h2>
        <p className="sub">
          rest_api ships several auth classes. Pass one as <code>client.auth</code> (default for all
          endpoints) or as an endpoint&apos;s <code>auth</code> to override. Credentials resolve
          from secrets.toml / env vars via dlt&apos;s config system.
        </p>

        <h3>Built-in auth classes</h3>
        <DataTable
          headers={['Class', 'String alias', 'Key params']}
          rows={[
            [
              <code>BearerTokenAuth</code>,
              <span className="pill">bearer</span>,
              <><code>token</code> — adds <code>Authorization: Bearer &lt;token&gt;</code></>,
            ],
            [
              <code>APIKeyAuth</code>,
              <span className="pill">api_key</span>,
              <>
                <code>name</code> (default <code>"Authorization"</code>), <code>api_key</code>,{' '}
                <code>location</code>: <code>header</code> / <code>query</code>
              </>,
            ],
            [
              <code>HttpBasicAuth</code>,
              <span className="pill">http_basic</span>,
              <><code>username</code>, <code>password</code></>,
            ],
            [
              <code>OAuth2ClientCredentials</code>,
              <span className="pill">oauth2_client_credentials</span>,
              <>
                <code>access_token_url</code>, <code>client_id</code>, <code>client_secret</code>,{' '}
                <code>access_token_request_data</code>, <code>default_token_expiration</code> (3600)
              </>,
            ],
            [
              <code>OAuthJWTAuth</code>,
              'no alias — instance only',
              <>
                <code>client_id</code>, <code>private_key</code>, <code>auth_endpoint</code>,{' '}
                <code>scopes</code> (JWT RS256; needs PyJWT + cryptography)
              </>,
            ],
          ]}
        />

        <h3>Passing auth</h3>
        <CodeBlock label="bearer token from secrets + oauth2 client credentials" html={AUTH_CODE} />

        <Note variant="warn">
          <strong>Gotchas</strong> — <code>APIKeyAuth</code> <code>location="cookie"</code> raises{' '}
          <code>NotImplementedError</code> (only <code>header</code>/<code>query</code> work). Only
          the OAuth2 client-credentials flow is built in (no authorization-code / PKCE / device
          flows). <code>OAuthJWTAuth</code> has no string alias — construct it as an instance and
          pass the object. For anything custom, subclass <code>AuthConfigBase</code> and register it
          with <code>register_auth(name, cls)</code>. Endpoint-level auth overrides client-level
          auth.
        </Note>
      </div>
    </section>
  );
}
