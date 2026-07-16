import CodeBlock from '../../components/CodeBlock';
import DataTable from '../../components/DataTable';
import Note from '../../components/Note';

const secretsHtml = `<span class="cmt"># Salesforce</span>
[sources.salesforce]
user_name = <span class="str">"you@example.com"</span>
password = <span class="str">"..."</span>
security_token = <span class="str">"..."</span>

<span class="cmt"># Stripe</span>
[sources.stripe_analytics]
stripe_secret_key = <span class="str">"sk_live_..."</span>`;

const credentialRows: React.ReactNode[][] = [
  [
    'User/pass + security token',
    'Salesforce',
    <code>[sources.salesforce] user_name / password / security_token</code>,
  ],
  [
    'API key / token',
    'Stripe, Notion, Airtable, Zendesk',
    <code>[sources.{'<name>'}] api_key = "..." (or token)</code>,
  ],
  [
    'OAuth2',
    'HubSpot, Google Ads/Analytics',
    <code>client_id / client_secret / refresh_token</code>,
  ],
  [
    'Connection string / cloud creds',
    'MongoDB, Kafka, Amazon Kinesis',
    'connection URL or cloud access keys',
  ],
];

export default function VerifiedAuth() {
  return (
    <section className="page">
      <div className="wrap">
        <p className="kicker">SaaS &amp; App Sources</p>
        <h2>Auth &amp; secrets</h2>
        <p className="sub">
          Verified sources authenticate in different ways depending on the SaaS; credentials live
          in <code>.dlt/secrets.toml</code> under a <code>[sources.{'<name>'}]</code> section,
          referenced from your pipeline.
        </p>

        <h3>Credential patterns</h3>
        <DataTable
          headers={['Pattern', 'Example sources', 'Secrets shape']}
          rows={credentialRows}
        />

        <h3>secrets.toml layout</h3>
        <CodeBlock label=".dlt/secrets.toml (per-source sections)" html={secretsHtml} />

        <h3>Referencing from our registry</h3>
        <p>
          The template's registry uses a <span className="pill">secret:</span> prefix to point
          config values at a secrets path (e.g.{' '}
          <code>secret:sources.salesforce.user_name</code>); the runner resolves it via{' '}
          <code>dlt.secrets</code>. Never inline credentials in <code>registry.yml</code>.
        </p>

        <Note variant="tip">
          Verified sources set credentials as <code>dlt.secrets.value</code> defaults on their
          source function, so dlt auto-resolves from <code>[sources.{'<name>'}]</code> by section
          name — keep the secrets section name matching the source name.
        </Note>
      </div>
    </section>
  );
}
