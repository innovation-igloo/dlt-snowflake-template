import CodeBlock from '../../components/CodeBlock';
import DataTable from '../../components/DataTable';
import Note from '../../components/Note';

const incrementalHtml = `<span class="kw">@dlt</span>.resource(write_disposition=<span class="str">"merge"</span>)
<span class="kw">def</span> <b>opportunity</b>(
    last_ts: dlt.sources.incremental[str] = dlt.sources.<b>incremental</b>(<span class="str">"SystemModstamp"</span>, initial_value=<span class="kw">None</span>)
):
    <span class="kw">yield</span> get_records(client, <span class="str">"Opportunity"</span>, last_ts.last_value, <span class="str">"SystemModstamp"</span>)`;

const selectingHtml = `data = <b>salesforce_source</b>()
pipeline.<b>run</b>(data.with_resources(<span class="str">"opportunity"</span>, <span class="str">"contact"</span>))`;

const dispositionRows: React.ReactNode[][] = [
  ['replace', 'full refresh each run', 'small/reference objects (User, Product2)'],
  ['merge', 'upsert on primary key', 'incremental objects with a cursor (Opportunity, Account)'],
  ['append', 'insert only', 'immutable event streams'],
];

export default function VerifiedIncremental() {
  return (
    <section className="page">
      <div className="wrap">
        <p className="kicker">SaaS &amp; App Sources</p>
        <h2>Incremental &amp; write dispositions</h2>
        <p className="sub">
          Verified sources set a write disposition per resource (object/endpoint), and incremental
          resources track a cursor field so re-runs only pull changed records.
        </p>

        <h3>Per-resource dispositions</h3>
        <p>
          A single verified source yields many resources; some load{' '}
          <span className="pill">replace</span> (full refresh) and some{' '}
          <span className="pill">merge</span> (incremental upsert). You pick objects with{' '}
          <code>.with_resources(...)</code>.
        </p>

        <h3>Incremental cursor</h3>
        <CodeBlock label="incremental resource (Salesforce Opportunity)" html={incrementalHtml} />

        <h3>Selecting resources</h3>
        <CodeBlock label="load only some objects" html={selectingHtml} />

        <DataTable
          headers={['Disposition', 'Behavior', 'Use when']}
          rows={dispositionRows}
        />

        <Note variant="warn">
          Incremental state is keyed by pipeline name — keep the pipeline name + dataset stable
          across runs or dlt treats it as a new pipeline (dev-mode) and re-loads everything.
        </Note>
      </div>
    </section>
  );
}
