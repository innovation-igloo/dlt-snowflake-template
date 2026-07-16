import CodeBlock from '../../components/CodeBlock';
import DataTable from '../../components/DataTable';
import Note from '../../components/Note';

const INIT_CODE = `<span class="cmt"># copies the source module + requirements + secrets template into your project</span>
<span class="kw">dlt</span> init <span class="str">salesforce</span> <span class="str">snowflake</span>
<span class="kw">pip</span> install -r requirements.txt`;

export default function VerifiedOnboarding() {
  return (
    <section className="page">
      <div className="wrap">
        <p className="kicker">SaaS & App Sources</p>
        <h2>Onboarding a verified source</h2>
        <p className="sub">
          Unlike core sources, a verified source is scaffolded into your repo with{' '}
          <code>dlt init</code>, then customized.
        </p>

        <h3>dlt init</h3>
        <CodeBlock label="scaffold a verified source" html={INIT_CODE} />

        <h3>What gets vendored</h3>
        <DataTable
          headers={['Path', 'What it is']}
          rows={[
            [
              <>
                <code>&lt;source&gt;/</code> (e.g. <code>salesforce/</code>)
              </>,
              <>
                the source module — <code>__init__.py</code>, <code>helpers.py</code>,{' '}
                <code>settings.py</code>; yours to edit
              </>,
            ],
            [
              <code>requirements.txt</code>,
              <>
                the source deps (e.g. <code>simple-salesforce</code>)
              </>,
            ],
            [<code>.dlt/secrets.toml</code>, 'credential template for the source'],
            [
              <code>&lt;source&gt;_pipeline.py</code>,
              'an example pipeline you adapt',
            ],
          ]}
        />

        <h3>Fitting our registry (design note)</h3>
        <p>
          Our runner dispatches core sources (<code>sql_database</code> / <code>rest_api</code>)
          purely from <code>registry.yml</code>. A verified source is vendored code, so integrating
          it means vendoring the module under <code>sources/</code> and adding a dispatch branch in{' '}
          <code>run.py</code> (e.g.{' '}
          <code>source: salesforce → salesforce_source(...)</code>). Note this is a forthcoming
          template change, not built yet.
        </p>

        <Note variant="tip">
          Keep the vendored module under version control so your customizations (e.g. added objects,
          changed query limits) survive <code>dlt</code> upgrades.
        </Note>
      </div>
    </section>
  );
}
