import CodeBlock from '../../components/CodeBlock';
import DataTable from '../../components/DataTable';
import Note from '../../components/Note';

const SETUP_CODE = `<span class="cmt"># scaffold the source</span>
dlt init salesforce snowflake

<span class="cmt"># .dlt/secrets.toml</span>
[<span class="kw">sources.salesforce</span>]
user_name = <span class="str">"you@example.com"</span>
password = <span class="str">"..."</span>
security_token = <span class="str">"..."</span>     <span class="cmt"># reset from Salesforce UI: Settings &gt; My Personal Information &gt; Reset My Security Token</span>`;

const RUN_CODE = `<span class="kw">import</span> dlt
<span class="kw">from</span> salesforce <span class="kw">import</span> salesforce_source

pipeline = dlt.<b>pipeline</b>(pipeline_name=<span class="str">"salesforce"</span>, destination=<span class="str">"snowflake"</span>, dataset_name=<span class="str">"raw_salesforce"</span>)
info = pipeline.<b>run</b>(salesforce_source().<b>with_resources</b>(<span class="str">"opportunity"</span>, <span class="str">"account"</span>, <span class="str">"contact"</span>))`;

export default function VerifiedSalesforce() {
  return (
    <section className="page">
      <div className="wrap">
        <p className="kicker">SaaS &amp; App Sources</p>
        <h2>Salesforce</h2>
        <p className="sub">
          The dlt Salesforce verified source loads Salesforce SObjects via the Salesforce API;
          standard objects come with sensible write dispositions and incremental tracking built in.
        </p>

        <h3>Setup</h3>
        <CodeBlock label="scaffold + credentials" html={SETUP_CODE} />

        <h3>Resources &amp; dispositions</h3>
        <DataTable
          headers={['Object', 'Disposition']}
          rows={[
            ['User', <span className="pill">replace</span>],
            ['UserRole', <span className="pill">replace</span>],
            ['Lead', <span className="pill">replace</span>],
            ['Contact', <span className="pill">replace</span>],
            ['Campaign', <span className="pill">replace</span>],
            ['Product2', <span className="pill">replace</span>],
            ['Pricebook2', <span className="pill">replace</span>],
            ['PricebookEntry', <span className="pill">replace</span>],
            ['Opportunity', <span className="pill">merge</span>],
            ['OpportunityLineItem', <span className="pill">merge</span>],
            ['OpportunityContactRole', <span className="pill">merge</span>],
            ['Account', <span className="pill">merge</span>],
            ['CampaignMember', <span className="pill">merge</span>],
            ['Task', <span className="pill">merge</span>],
            ['Event', <span className="pill">merge</span>],
          ]}
        />

        <h3>Run it</h3>
        <CodeBlock label="load selected objects" html={RUN_CODE} />

        <h3>Caveats</h3>
        <DataTable
          headers={['Gotcha', 'Detail']}
          rows={[
            [
              'Formula fields',
              'Included but NOT back-updated when their Salesforce definition changes — reproduce calcs from base fields downstream',
            ],
            ['API request limits', 'Salesforce caps API calls by edition/license'],
            [
              'Dev throttle',
              <><code>settings.py</code> <code>IS_PRODUCTION=False</code> limits to 100 calls; query limit lives in <code>helpers.py</code></>,
            ],
            [
              'Incremental key',
              <><code>SystemModstamp</code> drives merge resources; keep pipeline name stable</>,
            ],
          ]}
        />

        <Note variant="tip">
          Incremental (merge) resources only pull records changed since the last{' '}
          <code>SystemModstamp</code>; replace resources reload fully each run. Combine with a
          stable <code>pipeline_name</code> so dlt state persists.
        </Note>
      </div>
    </section>
  );
}
