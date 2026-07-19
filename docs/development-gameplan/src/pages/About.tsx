import AboutHero from '../components/AboutHero';
import Card from '../components/Card';
import Tabs from '../components/Tabs';
import Flow from '../components/Flow';
import DataTable from '../components/DataTable';
import CodeBlock from '../components/CodeBlock';
import Note from '../components/Note';

const MIN_PIPELINE = `<span class="kw">import</span> dlt

pipeline = dlt.<b>pipeline</b>(
    pipeline_name=<span class="str">"my_pipeline"</span>,
    destination=<span class="str">"snowflake"</span>,
    dataset_name=<span class="str">"raw_data"</span>,
)
load_info = pipeline.<b>run</b>(my_source())`;

const MERGE_RESOURCE = `<span class="cmt"># merge upserts on the primary key; re-runs only change matched rows</span>
<span class="kw">@dlt.resource</span>(primary_key=<span class="str">"id"</span>, write_disposition=<span class="str">"merge"</span>)
<span class="kw">def</span> <b>users</b>():
    <span class="kw">yield</span> [
        {<span class="str">"id"</span>: 1, <span class="str">"name"</span>: <span class="str">"Alice"</span>},
        {<span class="str">"id"</span>: 2, <span class="str">"name"</span>: <span class="str">"Bob"</span>},
    ]

pipeline.<b>run</b>(users())`;

const DLT_INIT = `<span class="cmt"># scaffold a verified source INTO your repo — you own & edit the code</span>
dlt init salesforce snowflake
<span class="cmt"># creates sources/salesforce/ + a runnable pipeline script</span>`;

const SNOWFLAKE_SECRETS = `<span class="cmt"># .dlt/secrets.toml (git-ignored) — password or key-pair or OAuth</span>
[destination.snowflake.credentials]
database  = <span class="str">"DLT_PROD_DB"</span>
username  = <span class="str">"DLT_LOADER"</span>
host      = <span class="str">"&lt;account-identifier&gt;"</span>
warehouse = <span class="str">"DLT_WH"</span>       <span class="cmt"># optional if the user has a default</span>
role      = <span class="str">"DLT_LOADER_ROLE"</span>`;

const EXTERNAL_STAGING = `<span class="cmt"># external staging is optional; internal stage is the default</span>
pipeline = dlt.<b>pipeline</b>(
    pipeline_name=<span class="str">"chess_pipeline"</span>,
    destination=<span class="str">"snowflake"</span>,
    staging=<span class="str">"filesystem"</span>,      <span class="cmt"># S3 / GCS / Azure -&gt; COPY INTO</span>
    dataset_name=<span class="str">"player_data"</span>,
)`;

export default function About() {
  return (
    <>
      <AboutHero />
      <section className="page">
      <div className="wrap">
        <p className="kicker">The Package</p>
        <h2>What dlt is</h2>
        <p className="sub">
          <b>dlt</b> is an open-source Python library from <b>dltHub</b> (Apache 2.0) that extracts data
          from sources and loads it into well-structured tables in a destination. It handles the{' '}
          <b>&quot;EL&quot; of ELT</b> — extract and load; transformation is left to downstream tools like
          dbt. It is a <code>pip install dlt</code> library, not a platform or UI: code-first, no external
          SaaS dependency, and it runs anywhere Python does — a laptop, CI, Airflow, or an SPCS container.
        </p>

        <div className="grid grid-3" style={{ marginTop: 26 }}>
          <Card icon="🐍" title="A Python library">
            <code>pip install dlt</code> — not a managed service. Pipelines are code you own, version, and
            run on your own compute. Contrast with Fivetran/Airbyte&apos;s hosted connectors.
          </Card>
          <Card icon="↳" title="EL, not transformation">
            dlt <b>extracts</b> and <b>loads</b>; it infers and evolves schema on the way in. Modeling and
            business logic run downstream in Snowflake (dbt, SQL, dynamic tables).
          </Card>
          <Card icon="📦" title="Runs anywhere">
            The same pipeline code targets DuckDB in dev and Snowflake in prod. Wrap it in a container and
            schedule it as an SPCS job — which is exactly what this template does.
          </Card>
        </div>

        <div className="quote" style={{ marginTop: 26 }}>
          The mental model is four words: <code>source</code> &rarr; <code>resource</code> &rarr;{' '}
          <code>pipeline</code> &rarr; <code>destination</code>. Everything else is detail.
        </div>

        <Tabs
          tabs={[
            {
              label: 'Mental model',
              content: (
                <>
                  <Flow
                    nodes={[
                      { icon: '🗄️', title: 'Source', sub: 'where data lives', variant: 'src' },
                      { icon: '🔗', title: 'Resource', sub: 'one endpoint / table' },
                      { icon: '⚙️', title: 'Pipeline', sub: 'extract · normalize · load' },
                      { icon: '❄️', title: 'Destination', sub: 'Snowflake', variant: 'dest' },
                    ]}
                  />
                  <DataTable
                    headers={['Term', 'What it means in dlt']}
                    rows={[
                      [
                        <code>source</code>,
                        'A location holding one or more resources — and the Python function that extracts from it.',
                      ],
                      [
                        <code>resource</code>,
                        <>
                          A logical unit within a source (one API endpoint, one DB table). A function
                          decorated with <code>@dlt.resource</code>.
                        </>,
                      ],
                      [
                        <code>pipeline</code>,
                        <>
                          Moves data source &rarr; destination in three stages. Created with{' '}
                          <code>dlt.pipeline(...)</code>; executed with <code>.run(...)</code>.
                        </>,
                      ],
                      [
                        <code>destination</code>,
                        'The store data lands in (Snowflake here; DuckDB, BigQuery, etc. supported).',
                      ],
                    ]}
                  />
                  <CodeBlock label="a minimal pipeline" html={MIN_PIPELINE} />
                </>
              ),
            },
            {
              label: 'Capabilities',
              content: (
                <>
                  <p>
                    dlt does the tedious parts of loading automatically — you describe the data, it manages
                    the tables.
                  </p>
                  <DataTable
                    headers={['Capability', 'What dlt does']}
                    rows={[
                      [
                        'Schema inference & evolution',
                        'Infers column types from the data and adds new columns/tables on later runs. Schema contracts can restrict evolution.',
                      ],
                      [
                        'JSON normalization',
                        <>
                          Unnests nested lists/dicts into relational child tables with <code>_dlt_id</code>,{' '}
                          <code>_dlt_parent_id</code>, and <code>_dlt_list_idx</code> for referential
                          integrity.
                        </>,
                      ],
                      [
                        'Write dispositions',
                        <>
                          <code>append</code>, <code>replace</code>, or <code>merge</code>. Merge strategies
                          include delete-insert, upsert, SCD2, and insert-only.
                        </>,
                      ],
                      [
                        'Incremental & state',
                        <>
                          <code>dlt.sources.incremental</code> loads only new/changed rows by a cursor; state
                          persists in <code>_dlt_pipeline_state</code> so it survives restarts.
                        </>,
                      ],
                      [
                        'Resilience',
                        'Re-running a pipeline resumes unfinished load jobs in the current load package.',
                      ],
                    ]}
                  />
                  <CodeBlock label="merge (upsert) resource" html={MERGE_RESOURCE} />
                  <Note variant="warn">
                    <code>merge</code> needs a <code>primary_key</code> (upsert/dedup) or{' '}
                    <code>merge_key</code> (delete-insert). Without a key dlt can&apos;t identify matching
                    rows.
                  </Note>
                </>
              ),
            },
            {
              label: 'Sources',
              content: (
                <>
                  <p>
                    Two families of sources ship with dlt. The template documents both in depth (see{' '}
                    <b>SQL Databases</b>, <b>Verified Sources</b>, and <b>REST APIs</b>).
                  </p>
                  <DataTable
                    headers={['Family', 'What', 'How you use it']}
                    rows={[
                      [
                        <>
                          Core sources <span className="pill rec">bundled</span>
                        </>,
                        <>
                          <code>sql_database</code>, <code>rest_api</code>, <code>filesystem</code> — generic
                          collectors in the <code>dlt</code> library itself.
                        </>,
                        'Import and configure. No scaffolding; the majority of usage.',
                      ],
                      [
                        'Verified sources (~30)',
                        <>
                          Prebuilt SaaS connectors (Salesforce, HubSpot, Stripe, Notion, Zendesk, Shopify,
                          GitHub, Slack, Jira, Kafka, MongoDB, Google Sheets/Analytics, …).
                        </>,
                        <>
                          Scaffolded with <code>dlt init</code> — the code is <b>copied into your repo</b>,
                          so you own and modify it.
                        </>,
                      ],
                    ]}
                  />
                  <CodeBlock label="scaffold a verified source" html={DLT_INIT} />
                  <Note variant="tip">
                    Verified sources are <b>vendored, not a versioned dependency</b>: <code>dlt init</code>{' '}
                    copies source code in, and upstream fixes are not auto-pulled — re-init or merge changes
                    manually. They are one-way EL (not reverse-ETL).
                  </Note>
                </>
              ),
            },
            {
              label: 'Snowflake destination',
              content: (
                <>
                  <p>
                    Install with <code>pip install &quot;dlt[snowflake]&quot;</code>. dlt stages files, then
                    runs <code>COPY INTO</code> — and <code>MERGE</code> for the merge disposition — using
                    Snowflake&apos;s own compute.
                  </p>
                  <DataTable
                    headers={['Aspect', 'Detail']}
                    rows={[
                      [
                        'Staging',
                        <>
                          Internal Snowflake stage by default; optional external S3/GCS/Azure via{' '}
                          <code>staging=&quot;filesystem&quot;</code>.
                        </>,
                      ],
                      [
                        'Load',
                        <>
                          <code>COPY INTO</code> from staged files (JSONL default, or Parquet/CSV);{' '}
                          <code>MERGE</code> runs in a staging dataset within an atomic transaction.
                        </>,
                      ],
                      [
                        'Auth',
                        <>
                          Password, key-pair (base64 DER/PEM), or OAuth — including the ambient Snowflake
                          OAuth token when running in SPCS.
                        </>,
                      ],
                      [
                        'Schema',
                        'Automatic ALTER TABLE ADD COLUMN migrations run before each load.',
                      ],
                    ]}
                  />
                  <CodeBlock label=".dlt/secrets.toml" html={SNOWFLAKE_SECRETS} />
                  <CodeBlock label="optional external staging" html={EXTERNAL_STAGING} />
                  <Note variant="tip">
                    In SPCS, dlt auto-detects the Snowflake-provided OAuth token when{' '}
                    <code>authenticator=oauth</code> and no host/token is passed — so no credentials are
                    baked into the image. dlt also tags every session (<code>QUERY_TAG</code>) with the
                    pipeline, resource, and load id for observability (enabled via <code>query_tag</code>{' '}
                    in <code>.dlt/config.toml</code>; it is off by default in dlt).
                  </Note>
                </>
              ),
            },
            {
              label: 'How a run works',
              content: (
                <>
                  <Flow
                    nodes={[
                      { icon: '📤', title: 'Extract', sub: 'pull to a load package', variant: 'src' },
                      { icon: '🧱', title: 'Normalize', sub: 'infer schema, unnest' },
                      { icon: '📥', title: 'Load', sub: 'migrate + COPY INTO', variant: 'dest' },
                    ]}
                  />
                  <p>
                    Each <code>pipeline.run(...)</code> runs three stages. Extract writes a{' '}
                    <b>load package</b> (with a unique <code>load_id</code>) to disk; normalize computes the
                    schema and produces destination-ready files; load runs any DDL migrations then loads the
                    files in parallel jobs. It is safe to re-run — unfinished jobs resume.
                  </p>
                  <DataTable
                    headers={['dlt metadata table', 'Purpose']}
                    rows={[
                      [
                        <code>_dlt_loads</code>,
                        <>
                          One row per completed load (<code>load_id</code>, status, <code>inserted_at</code>).
                        </>,
                      ],
                      [
                        <code>_dlt_pipeline_state</code>,
                        'Serialized pipeline state — incremental cursors and checkpoints per run.',
                      ],
                      [<code>_dlt_version</code>, 'Full schema version history (JSON) for audit / compatibility.'],
                    ]}
                  />
                </>
              ),
            },
            {
              label: 'Gotchas',
              content: (
                <DataTable
                  headers={['Thing to know', 'Detail']}
                  rows={[
                    [
                      'One-directional',
                      <>
                        dlt is EL (source &rarr; destination). A custom <code>@dlt.destination</code>{' '}
                        can push data out (reverse ETL), but that&apos;s out of scope here: it bypasses
                        the Snowflake destination and has no state restore, so it&apos;s a poor fit for
                        ephemeral SPCS jobs.
                      </>,
                    ],
                    [
                      'Verified sources are vendored',
                      <>
                        <code>dlt init</code> copies code in; upstream changes are not auto-pulled.
                      </>,
                    ],
                    [
                      <>
                        <code>sql_database</code> backends
                      </>,
                      <>
                        <code>connectorx</code> supports only certain dialects; <code>sqlalchemy</code>{' '}
                        (with <code>pyarrow</code>/<code>pandas</code> modes) is general. Pick per source.
                      </>,
                    ],
                    [
                      'Naming convention',
                      'Names are lowercased snake_case by default — differs from Snowflake\u2019s default uppercase.',
                    ],
                    [
                      'Nested explosion',
                      <>
                        Deeply nested JSON creates many child tables; cap depth with{' '}
                        <code>max_table_nesting</code>.
                      </>,
                    ],
                  ]}
                />
              ),
            },
          ]}
        />

        <Note variant="tip">
          <b>Next:</b> the <b>Overview</b> under <b>The Template</b> shows what this repo builds on top of
          dlt; <b>SQL Databases</b>, <b>Verified Sources</b>, and <b>REST APIs</b> go deep on each source
          family.
        </Note>
      </div>
    </section>
    </>
  );
}
