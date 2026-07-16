import DataTable from '../../components/DataTable';
import Note from '../../components/Note';

export default function VerifiedOverview() {
  return (
    <section className="page">
      <div className="wrap">
        <p className="kicker">SaaS & App Sources</p>
        <h2>Verified sources</h2>
        <p className="sub">
          dlt has two source families — core (generic, config-driven, built into the library) and
          verified (per-SaaS Python modules maintained in a separate repo). This section covers
          verified sources end to end.
        </p>

        <h3>Core vs verified</h3>
        <DataTable
          headers={['', 'Core sources', 'Verified sources']}
          rows={[
            [
              'What',
              <>
                Generic connectors (<code>rest_api</code>, <code>sql_database</code>,{' '}
                <code>filesystem</code>)
              </>,
              'Prebuilt modules for specific SaaS APIs (Salesforce, HubSpot, Stripe, ...)',
            ],
            [
              'Where',
              'Built into the dlt library',
              <>
                Separate repo <code>dlt-hub/verified-sources</code>
              </>,
            ],
            [
              'How you get it',
              <>
                Import from <code>dlt.sources</code>
              </>,
              <>
                <code>dlt init &lt;slug&gt; &lt;dest&gt;</code> vendors the code into your project
              </>,
            ],
            [
              'Shape',
              'Config-driven (our registry dispatches these)',
              'Vendored Python you can customize',
            ],
            [
              'Count',
              <>
                3 core (30+ SQL dialects via <code>sql_database</code>)
              </>,
              '~29 verified sources',
            ],
          ]}
        />

        <h3>When to use which</h3>
        <p>
          Prefer a verified source when one exists for your SaaS — it handles objects, auth, and
          incremental loading out of the box. Use the core <code>rest_api</code> source to hand-roll
          an integration when no verified source covers your API. Use <code>sql_database</code> for
          relational databases.
        </p>

        <Note variant="warn">
          One-way only: verified sources are ingestion (source → Snowflake). dlt does not write back
          — there is no bilateral or reverse sync. Reverse-ETL (pushing to Salesforce etc.) needs
          different tooling.
        </Note>

        <p>
          See the <strong>Catalog</strong> page for the full list of available verified sources, and
          the <strong>Onboarding</strong> page for the <code>dlt init</code> workflow.
        </p>
      </div>
    </section>
  );
}
