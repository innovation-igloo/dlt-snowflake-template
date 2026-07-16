import Tabs from '../../components/Tabs';
import CodeBlock from '../../components/CodeBlock';
import Note from '../../components/Note';
import DataTable from '../../components/DataTable';

const parallelConfigCode = `[sources.sql_database.data_writer]
file_max_items = 100000
[normalize]
workers = 3
[normalize.data_writer]
file_max_items = 100000
[load]
workers = 11`;

const secretsCode = `[sources.sql_database.credentials]
drivername = <span class="str">"postgresql+psycopg2"</span>
host = <span class="str">"db.internal"</span>
database = <span class="str">"app"</span>
username = <span class="str">"readonly"</span>
password = <span class="str">"..."</span>
[destination.snowflake.credentials]
host = <span class="str">"orgname-accountname"</span>
warehouse = <span class="str">"DLT_WH"</span>
role = <span class="str">"DLT_LOADER_ROLE"</span>`;

export default function Performance() {
  return (
    <section className="page">
      <div className="wrap">
        <p className="kicker">Scaling the pipeline</p>
        <h2>Performance &amp; Config</h2>
        <p className="sub">
          dlt runs in three stages (extract, normalize, load), each independently tunable,
          plus config/secrets and state controls.
        </p>

        <Tabs
          tabs={[
            {
              label: 'Parallelism',
              content: (
                <>
                  <DataTable
                    headers={['Config (config.toml)', 'Default', 'Controls']}
                    rows={[
                      [<code>[extract] workers</code>, '5', 'Thread pool for parallelized sync resources'],
                      [<code>[extract] max_parallel_items</code>, '20', 'Max concurrent items queued in the extract pool'],
                      [<code>[normalize] workers</code>, '1', 'Process pool; set to CPU cores - 1'],
                      [<code>[load] workers</code>, '20', 'Thread pool for parallel file uploads (set to #load files + 1)'],
                    ]}
                  />
                  <p>
                    File rotation is what enables parallel normalize/load — set{' '}
                    <code>data_writer file_max_items</code> so extract/load files split into
                    multiple jobs. Set normalize <code>start_method="spawn"</code> if your
                    extraction code uses threads.
                  </p>
                  <ul className="plain">
                    <li>
                      <code>@dlt.resource(parallelized=True)</code> runs resources concurrently;
                      async generator resources are concurrent automatically.
                    </li>
                    <li>
                      <code>.parallelize()</code> on a source/resource.
                    </li>
                    <li>
                      <code>source().decompose(strategy="scc")</code> splits a source into
                      independent components (e.g. one Airflow task each).
                    </li>
                  </ul>
                  <CodeBlock
                    label=".dlt/config.toml (parallel pipeline)"
                    html={parallelConfigCode}
                  />
                </>
              ),
            },
            {
              label: 'Staging & formats',
              content: (
                <>
                  <p>
                    Every Snowflake load stages files then <code>COPY INTO</code>. Choose where
                    files land and their format.
                  </p>
                  <DataTable
                    headers={['Option', 'Effect']}
                    rows={[
                      [
                        'Internal stage (default)',
                        'dlt PUT to the implicit per-table stage; zero cloud setup',
                      ],
                      [
                        <code>keep_staged_files</code>,
                        'false deletes staged files after COPY; true to audit/debug',
                      ],
                      [
                        'External stage',
                        <>
                          staging=&#39;filesystem&#39; +{' '}
                          <code>bucket_url</code> (s3/gcs/azure); COPY reads from your bucket
                          — faster for large loads
                        </>,
                      ],
                      [
                        <code>stage_name</code>,
                        'Use a pre-created named Snowflake external stage',
                      ],
                    ]}
                  />
                  <DataTable
                    headers={['File format', 'Notes']}
                    rows={[
                      [
                        <><code>jsonl</code> (default when staging)</>,
                        'Preserves JSON as VARIANT correctly',
                      ],
                      [<code>parquet</code>, 'Fast for large tabular loads; CANNOT represent JSON as VARIANT'],
                      [<code>csv</code>, 'Simple; configure via [destination.snowflake.csv_format]'],
                    ]}
                  />
                  <ul className="plain">
                    <li>
                      <code>staging-optimized</code> replace +{' '}
                      <code>enable_atomic_swap</code> for zero-downtime full refresh.
                    </li>
                    <li>
                      <code>truncate_staging_dataset</code> to reclaim staging storage after load.
                    </li>
                  </ul>
                </>
              ),
            },
            {
              label: 'Config & secrets',
              content: (
                <>
                  <p>
                    Non-sensitive settings in <code>.dlt/config.toml</code>, credentials in{' '}
                    <code>.dlt/secrets.toml</code> (never commit). Resolution order: environment
                    variables &gt; toml files &gt; vault providers &gt; function defaults.
                  </p>
                  <p>
                    Env var naming — uppercase everything, replace the section dot with{' '}
                    <code>__</code> (double underscore). Example:{' '}
                    <code>DESTINATION__SNOWFLAKE__CREDENTIALS__PASSWORD</code>.
                  </p>
                  <CodeBlock label=".dlt/secrets.toml" html={secretsCode} />
                  <p>
                    Resource-level config uses{' '}
                    <code>[sources.sql_database.&lt;table&gt;]</code>; dlt resolves from
                    most-specific to least-specific section.
                  </p>
                </>
              ),
            },
            {
              label: 'State & refresh',
              content: (
                <>
                  <DataTable
                    headers={['Mode', 'Scope', 'Effect']}
                    rows={[
                      [
                        <code>dev_mode=True</code>,
                        'pipeline',
                        'Appends a datetime suffix to dataset_name each run — fresh dataset + state',
                      ],
                      [
                        <code>refresh="drop_sources"</code>,
                        'all sources in the run',
                        'Drop all tables + wipe all state + reset schema',
                      ],
                      [
                        <code>refresh="drop_resources"</code>,
                        'selected resources',
                        'Drop selected tables + wipe their resource state',
                      ],
                      [
                        <code>refresh="drop_data"</code>,
                        'selected resources',
                        'TRUNCATE tables (schema kept) + reset incremental cursor',
                      ],
                    ]}
                  />
                  <ul className="plain">
                    <li>
                      <code>pipeline.drop_pending_packages()</code> clears failed/partial load
                      packages before a retry.
                    </li>
                    <li>
                      CLI <code>dlt pipeline &lt;name&gt; drop</code> resets resources/state.
                    </li>
                    <li>
                      <code>restore_from_destination=false</code> skips remote state sync when
                      local working dir persists.
                    </li>
                  </ul>
                </>
              ),
            },
            {
              label: 'Retries',
              content: (
                <>
                  <DataTable
                    headers={['Setting', 'Section', 'Default', 'Behavior']}
                    rows={[
                      [<code>request_max_attempts</code>, '[runtime]', '5', 'HTTP client retry count'],
                      [<code>request_backoff_factor</code>, '[runtime]', '1.0', 'Exponential backoff multiplier'],
                      [<code>request_max_retry_delay</code>, '[runtime]', '300s', 'Cap on inter-retry wait'],
                      [<code>request_timeout</code>, '[runtime]', '60s', 'Per-request timeout'],
                      [<code>raise_on_failed_jobs</code>, '[load]', 'true', 'Raise on first terminal load-job failure'],
                      [<code>raise_on_max_retries</code>, '[load]', '5', 'Raise when a load job exceeds this retry count'],
                    ]}
                  />
                  <Note variant="tip">
                    After <code>run()</code>, also call{' '}
                    <code>info.raise_on_failed_jobs()</code> to raise programmatically on any
                    soft failed job — <code>run()</code> does not do this automatically.
                  </Note>
                </>
              ),
            },
          ]}
        />
      </div>
    </section>
  );
}
