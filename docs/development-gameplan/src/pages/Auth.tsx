import DataTable from '../components/DataTable';
import CodeBlock from '../components/CodeBlock';
import Note from '../components/Note';

const SECRETS_TOML = `<span class="cmt"># ---- Snowflake destination: key-pair auth (recommended for external runs) ----</span>
[destination.snowflake.credentials]
host = <span class="str">"orgname-accountname"</span>   <span class="cmt"># account identifier, not the full URL</span>
username = <span class="str">"DLT_LOADER"</span>
database = <span class="str">"ANALYTICS"</span>
warehouse = <span class="str">"DLT_WH"</span>
role = <span class="str">"DLT_LOADER_ROLE"</span>
private_key_path = <span class="str">"/secrets/rsa_key.p8"</span>
private_key_passphrase = <span class="str">"..."</span>   <span class="cmt"># omit if key is unencrypted</span>

<span class="cmt"># ---- Source: SQL database (example: Postgres) ----</span>
[sources.sql_database.credentials]
drivername = <span class="str">"postgresql+psycopg2"</span>
host = <span class="str">"db.internal"</span>
port = 5432
database = <span class="str">"app"</span>
username = <span class="str">"readonly"</span>
password = <span class="str">"..."</span>

<span class="cmt"># ---- Source: REST API bearer token ----</span>
[sources.rest_api]
token = <span class="str">"..."</span>`;

export default function Auth() {
  return (
    <section className="page">
      <div className="wrap">
        <p className="kicker">Credentials</p>
        <h2>Authentication &amp; secrets</h2>
        <p className="sub">
          The Snowflake destination supports four ways to authenticate. The template documents all of
          them and defaults to key-pair for external runners and the session token for in-Snowflake runs.
        </p>

        <DataTable
          headers={['Method', 'Config keys', 'Best for']}
          rows={[
            [
              <>
                <b>Key-pair</b> <span className="pill rec">default (external)</span>
              </>,
              <>
                <code>private_key_path</code> (or <code>private_key</code>) + optional{' '}
                <code>private_key_passphrase</code>
              </>,
              'Automated / service pipelines run from CI or a VM. No password to rotate in plaintext.',
            ],
            [
              <>
                <b>Session token</b> <span className="pill rec">default (in-Snowflake)</span>
              </>,
              <>
                <code>authenticator="oauth"</code>; dlt reads the ambient token +{' '}
                <code>SNOWFLAKE_ACCOUNT</code> / <code>SNOWFLAKE_HOST</code> env automatically
              </>,
              'Running inside SPCS. Credential-free: nothing stored in the image or config.',
            ],
            [
              <>
                <b>OAuth</b>
              </>,
              <>
                <code>authenticator="oauth"</code> + <code>token</code> (or provider config)
              </>,
              'SSO-governed orgs, interactive/external OAuth providers.',
            ],
            [
              <>
                <b>Username / password</b>
              </>,
              <>
                <code>username</code> + <code>password</code>
              </>,
              'Quick local testing only. Not recommended for enterprise automation.',
            ],
          ]}
        />

        <CodeBlock label=".dlt/secrets.toml.example" html={SECRETS_TOML} />

        <Note variant="warn">
          <b>In SPCS, delete the destination credentials block.</b> Set{' '}
          <code>authenticator = "oauth"</code> and let dlt pick up the session token. The service's
          assigned Snowflake role governs what it can write.
        </Note>
      </div>
    </section>
  );
}
