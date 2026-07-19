import Tabs from '../components/Tabs';
import Flow from '../components/Flow';
import DataTable from '../components/DataTable';
import CodeBlock from '../components/CodeBlock';
import Note from '../components/Note';

const REGISTRY_YML = `<span class="cmt"># pipelines/registry.yml — one entry per pipeline</span>
defaults:
  destination: snowflake
  load_warehouse: DLT_WH        <span class="cmt"># shared Gen2 multi-cluster WH</span>
  compute_pool: DLT_POOL        <span class="cmt"># shared SPCS pool</span>
pipelines:
  - name: pg_public
    source: sql_database
    schedule: <span class="str">"0 * * * *"</span>       <span class="cmt"># hourly cron (UTC)</span>
    dataset_name: RAW_PG
    config:
      credentials: <span class="str">"secret:sources.pg_public.credentials"</span>
      schema: public
      backend: connectorx`;

const RUNNER = `<span class="cmt"># one image, any pipeline — the name is just an argument</span>
python -m pipelines.run pg_public
python -m pipelines.run --group batch_hourly   <span class="cmt"># several pipelines, one job</span>`;

const WAREHOUSE_SQL = `<span class="kw">CREATE WAREHOUSE</span> DLT_WH
  WAREHOUSE_SIZE = XSMALL
  GENERATION = <span class="str">'2'</span>              <span class="cmt">-- Gen2 (caps at 4XL)</span>
  MIN_CLUSTER_COUNT = 1
  MAX_CLUSTER_COUNT = 3         <span class="cmt">-- auto-scale clusters for concurrency</span>
  SCALING_POLICY = <span class="str">'STANDARD'</span>
  AUTO_SUSPEND = 60 AUTO_RESUME = <span class="kw">TRUE</span>;`;

const TASK_SQL = `<span class="cmt">-- one Task per pipeline, generated from registry.yml</span>
<span class="kw">CREATE OR ALTER TASK</span> dlt_task_pg_public
  WAREHOUSE = DLT_WH
  SCHEDULE = <span class="str">'USING CRON 0 * * * * UTC'</span>
<span class="kw">AS</span>
  <span class="kw">EXECUTE JOB SERVICE</span> <span class="kw">IN COMPUTE POOL</span> DLT_POOL
    NAME = dlt_job_pg_public
    <span class="kw">FROM</span> @DLT_DB.DEPLOY.SPECS
    SPECIFICATION_TEMPLATE_FILE = <span class="str">'dlt_job.tmpl.yaml'</span>
    <span class="kw">USING</span> (pipeline => <span class="str">'pg_public'</span>);   <span class="cmt">-- name only; config read from the table</span>`;

const REGISTRY_TABLE_SQL = `<span class="cmt">-- runtime source of truth (authored in registry.yml, synced here)</span>
<span class="kw">CREATE TABLE IF NOT EXISTS</span> DLT_DB.OPS.PIPELINE_REGISTRY (
  name              <span class="kw">STRING</span> <span class="kw">PRIMARY KEY</span>,
  source            <span class="kw">STRING</span>,          <span class="cmt">-- sql_database | rest_api | ...</span>
  schedule          <span class="kw">STRING</span>,          <span class="cmt">-- cron (UTC)</span>
  dataset_name      <span class="kw">STRING</span>,
  write_disposition <span class="kw">STRING</span>,
  pipeline_group    <span class="kw">STRING</span>,
  config            <span class="kw">VARIANT</span>,         <span class="cmt">-- source config; secret: refs only, no plaintext</span>
  enabled           <span class="kw">BOOLEAN</span> <span class="kw">DEFAULT</span> <span class="kw">TRUE</span>,
  updated_at        <span class="kw">TIMESTAMP_NTZ</span> <span class="kw">DEFAULT</span> <span class="kw">CURRENT_TIMESTAMP</span>()
);`;

const SPEC_TEMPLATE = `<span class="cmt"># deploy/spcs/dlt_job.tmpl.yaml — on @DLT_DB.DEPLOY.SPECS</span>
spec:
  containers:
    - name: dlt
      image: /DLT_DB/DEPLOY/IMAGES/dlt-pipeline:latest
      args:
        - <span class="str">"{{ pipeline }}"</span>        <span class="cmt"># injected by USING at run time</span>
      env:
        DESTINATION__SNOWFLAKE__CREDENTIALS__AUTHENTICATOR: oauth
        DESTINATION__SNOWFLAKE__CREDENTIALS__DATABASE: DLT_PROD_DB
        DESTINATION__SNOWFLAKE__CREDENTIALS__WAREHOUSE: DLT_WH`;

const TASK_TEMPLATE_SQL = `<span class="cmt">-- one Task per pipeline — spec lives on a stage, name passed via USING</span>
<span class="kw">CREATE OR ALTER TASK</span> dlt_task_pg_public
  WAREHOUSE = DLT_WH
  SCHEDULE = <span class="str">'USING CRON 0 * * * * UTC'</span>
<span class="kw">AS</span>
  <span class="kw">EXECUTE JOB SERVICE</span> <span class="kw">IN COMPUTE POOL</span> DLT_POOL
    NAME = dlt_job_pg_public
    <span class="kw">FROM</span> @DLT_DB.DEPLOY.SPECS
    SPECIFICATION_TEMPLATE_FILE = <span class="str">'dlt_job.tmpl.yaml'</span>
    <span class="kw">USING</span> (pipeline => <span class="str">'pg_public'</span>);`;

const RUNTIME_READ = `<span class="cmt"># inside the container: name comes from args, config from the table</span>
name = sys.argv[1]                       <span class="cmt"># "pg_public"</span>
row = session.<b>sql</b>(
    <span class="str">"select config, source, dataset_name, write_disposition "</span>
    <span class="str">"from DLT_DB.OPS.PIPELINE_REGISTRY where name = ? and enabled"</span>,
    params=[name],
).<b>collect</b>()
<span class="kw">if not</span> row:
    <span class="kw">raise</span> SystemExit(<span class="str">f"unknown or disabled pipeline: {name}"</span>)
spec = build_spec(row[0])                <span class="cmt"># same PipelineSpec, sourced from Snowflake</span>`;

export default function Scaling() {
  return (
    <section className="page">
      <div className="wrap">
        <p className="kicker">Ops</p>
        <h2>Scaling &amp; multi-pipeline</h2>
        <p className="sub">
          Running more than one pipeline splits across <b>two independent compute surfaces</b>. Getting
          the split right is what keeps a busy account both fast and cheap — and it&apos;s the most common
          thing people get wrong, because &quot;multi-cluster&quot; is not the knob for &quot;more
          pipelines.&quot;
        </p>

        <Tabs
          tabs={[
            {
              label: 'Two compute surfaces',
              content: (
                <>
                  <Flow
                    nodes={[
                      { icon: '📋', title: 'registry.yml', sub: 'N pipeline configs', variant: 'src' },
                      { icon: '⚙️', title: 'Compute pool', sub: 'runs the dlt container' },
                      { icon: '❄️', title: 'Multi-cluster WH', sub: 'runs COPY INTO / MERGE', variant: 'dest' },
                    ]}
                  />
                  <p>
                    Every dlt run touches two separate compute layers. Scaling &quot;more pipelines&quot;
                    and scaling &quot;more concurrent loads&quot; happen on different ones:
                  </p>
                  <DataTable
                    headers={['You want…', 'Lever', 'Layer']}
                    rows={[
                      [
                        'Run many pipelines on shared compute',
                        <>
                          Pack jobs/services; autoscale <b>nodes</b> (<code>MIN_NODES</code>/
                          <code>MAX_NODES</code>)
                        </>,
                        'Compute pool',
                      ],
                      [
                        'Many pipelines loading at the same time without queueing',
                        <>
                          Add <b>clusters</b> (<code>MIN_CLUSTER_COUNT</code>/<code>MAX_CLUSTER_COUNT</code>)
                        </>,
                        'Multi-cluster warehouse',
                      ],
                      [
                        'A single big load to finish faster',
                        <>
                          Size the warehouse <b>up</b>
                        </>,
                        'Warehouse size',
                      ],
                    ]}
                  />
                  <Note variant="warn">
                    Multi-cluster does <b>not</b> run your pipelines and does <b>not</b> speed up a single
                    load — it only adds clusters so concurrent <code>COPY INTO</code>/<code>MERGE</code>{' '}
                    from many pipelines don&apos;t queue. Packing pipelines onto shared compute is a{' '}
                    <b>compute pool</b> concern (nodes), not a warehouse one.
                  </Note>
                </>
              ),
            },
            {
              label: 'Compute pool',
              content: (
                <>
                  <p>
                    The pool is where the dlt <i>process</i> runs (extract + normalize + orchestrate the
                    load). One pool hosts many pipelines; nodes autoscale between <code>MIN_NODES</code>{' '}
                    and <code>MAX_NODES</code> to fit concurrent work.
                  </p>
                  <DataTable
                    headers={['Pattern', 'How', 'When']}
                    rows={[
                      [
                        <>
                          Job-per-pipeline <span className="pill rec">default</span>
                        </>,
                        <>
                          A Task fires <code>EXECUTE JOB SERVICE</code>; the container runs to completion
                          and exits
                        </>,
                        'Scheduled batch — you pay for pool nodes only while a job runs (5-min minimum each)',
                      ],
                      [
                        'Grouped job',
                        <>
                          One job runs several pipelines (<code>run.py --group G</code>)
                        </>,
                        'Many tiny pipelines — amortize the 5-minute-per-job minimum into one run',
                      ],
                      [
                        'Long-running service',
                        'Always-on container that loops / schedules internally',
                        'Near-real-time; pays for idle nodes, so reserve it for genuinely continuous work',
                      ],
                    ]}
                  />
                  <Note variant="tip">
                    Start pipelines on a small CPU family (e.g. <code>CPU_X64_S</code>) — extraction is
                    usually I/O-bound. The <b>5-minute minimum</b> per job is why firing dozens of tiny
                    pipelines as separate jobs wastes credits; batch them with <code>--group</code>. See{' '}
                    <b>Compute &amp; Credits</b> for per-family rates.
                  </Note>
                </>
              ),
            },
            {
              label: 'Load warehouse',
              content: (
                <>
                  <p>
                    dlt&apos;s Snowflake destination runs <code>COPY INTO</code>/<code>MERGE</code> on a
                    virtual warehouse. One shared <b>Gen2 multi-cluster</b> warehouse lets many pipelines
                    load concurrently; clusters start and stop with demand.
                  </p>
                  <CodeBlock label="sql/prod/02_compute.sql (warehouse)" html={WAREHOUSE_SQL} />
                  <p>
                    Credits/hour = <b>size-rate × running clusters</b>, billed per-second and only while a
                    cluster is up. An XSMALL Gen2 on AWS (1.35 cr/hr) auto-scaling to 3 clusters peaks
                    around <b>4.05 cr/hr</b> — but sits at 0 when idle (<code>AUTO_SUSPEND</code>).
                  </p>
                  <Note variant="warn">
                    Snowflake&apos;s own guidance: multi-cluster warehouses &quot;are not as beneficial for
                    improving the performance of slow-running queries or data loading. For these types of
                    operations, resizing the warehouse provides more benefits.&quot; So use{' '}
                    <b>clusters for concurrency</b>, <b>size for a single heavy load</b>. Multi-cluster
                    needs Enterprise Edition; on Standard, set <code>MIN=MAX=1</code>.
                  </Note>
                </>
              ),
            },
            {
              label: 'Config registry',
              content: (
                <>
                  <p>
                    Pipelines are declared in one <code>registry.yml</code>. A generic runner builds the
                    dlt source from each entry&apos;s <code>source</code> + <code>config</code> — one
                    container image, N configs — and a generator emits one Task per pipeline.
                  </p>
                  <CodeBlock label="pipelines/registry.yml" html={REGISTRY_YML} />
                  <CodeBlock label="run any pipeline by name" html={RUNNER} />
                  <CodeBlock label="deploy/tasks — one Task per pipeline" html={TASK_SQL} />
                  <Note variant="tip">
                    Secrets never live in the registry: a <code>secret:</code> prefix points at a key in{' '}
                    <code>.dlt/secrets.toml</code> (or a Snowflake secret). In-Snowflake runs use the
                    ambient OAuth session token for the destination, so no credentials are baked into the
                    image.
                  </Note>
                </>
              ),
            },
            {
              label: 'Config as data (no rebuild)',
              content: (
                <>
                  <p>
                    Baking <code>registry.yml</code> into the image means a config change forces an image
                    rebuild. The fix is a <b>control-plane / data-plane split</b>: keep config in Snowflake
                    and let the container read it at run time. The image becomes pure code + deps — rebuilt
                    only when <code>run.py</code> or dependencies change, <b>not</b> when you add a pipeline.
                  </p>
                  <DataTable
                    headers={['Change', 'Cost']}
                    rows={[
                      ['Add / edit / disable a pipeline', 'Sync a table row + one CREATE TASK — no rebuild'],
                      ['Change a schedule', 'ALTER TASK — no rebuild'],
                      [
                        <>
                          Change <code>run.py</code> / <code>models.py</code> / deps
                        </>,
                        'Rebuild + repush the image (infra change)',
                      ],
                    ]}
                  />
                  <h3>1 — Registry as a table</h3>
                  <p>
                    <code>registry.yml</code> stays the <b>authoring</b> format; a small sync step writes it
                    into <code>OPS.PIPELINE_REGISTRY</code>, the <b>runtime</b> source of truth (queryable,
                    RBAC&apos;d, with Time Travel history).
                  </p>
                  <CodeBlock label="the runtime registry table" html={REGISTRY_TABLE_SQL} />
                  <h3>2 — A spec template on a stage</h3>
                  <p>
                    The job spec lives on a stage with a <code>{'{{ pipeline }}'}</code> variable instead of
                    being inlined per pipeline in the image.
                  </p>
                  <CodeBlock label="spec template (stage)" html={SPEC_TEMPLATE} />
                  <h3>3 — One Task per pipeline passes its name</h3>
                  <p>
                    Each Task references the template and binds the pipeline name with <code>USING</code>.
                    Adding a pipeline is one <code>CREATE TASK</code> generated from the registry.
                  </p>
                  <CodeBlock label="task -> templated job" html={TASK_TEMPLATE_SQL} />
                  <h3>4 — The container reads its config at run time</h3>
                  <p>
                    The Task passes only the <i>name</i>; the container uses the ambient OAuth token to look
                    up the rest from the table, validates it, and builds the same <code>PipelineSpec</code>.
                  </p>
                  <CodeBlock label="runtime lookup in the container" html={RUNTIME_READ} />
                  <Note variant="warn">
                    Tradeoffs: the container role needs <code>SELECT</code> on{' '}
                    <code>OPS.PIPELINE_REGISTRY</code> and must validate the passed name (reject
                    unknown/disabled). Per-source credentials stay in Snowflake <b>secret objects</b>{' '}
                    (injected via <code>containers.secrets</code>) — never in the table. Adding a pipeline
                    still needs one <code>CREATE TASK</code> (cheap SQL, not a rebuild); if you want
                    zero-DDL adds, a single dispatcher Task can read the registry and fire due pipelines,
                    at the cost of reimplementing scheduling.
                  </Note>
                  <Note variant="tip">
                    This is what the template ships today: <code>registry_sync.py</code> pushes{' '}
                    <code>registry.yml</code> into <code>OPS.PIPELINE_REGISTRY</code>,{' '}
                    <code>dlt_job.tmpl.yaml</code> lives on <code>@DLT_DB.DEPLOY.SPECS</code>, and{' '}
                    <code>generate_tasks.py</code> emits the templated <code>USING</code> Task above. The
                    image carries code + deps only; adding a pipeline is a table sync plus one{' '}
                    <code>CREATE TASK</code>, never a rebuild.
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
