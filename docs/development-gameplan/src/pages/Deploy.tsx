import Note from '../components/Note';
import CodeBlock from '../components/CodeBlock';

const OIDC_USER_SQL = `<span class="cmt">-- sql/02b_service_user_oidc.sql — keyless CI/CD identity</span>
<span class="kw">CREATE USER IF NOT EXISTS</span> DLT_DEPLOYER
  TYPE = <span class="kw">SERVICE</span>
  DEFAULT_ROLE = DLT_LOADER_ROLE
  WORKLOAD_IDENTITY = (
    TYPE    = OIDC
    ISSUER  = <span class="str">'https://token.actions.githubusercontent.com'</span>
    SUBJECT = <span class="str">'repo:&lt;owner&gt;/&lt;repo&gt;:environment:deploy'</span>
  );`;

const DEPLOY_YML = `<span class="cmt"># .github/workflows/deploy.yml (key steps)</span>
permissions:
  id-token: write        <span class="cmt"># mint the OIDC token</span>
  contents: read
jobs:
  deploy:
    environment: deploy  <span class="cmt"># gate + matches the OIDC subject</span>
    steps:
      - uses: actions/checkout@v4
      - uses: snowflakedb/snowflake-actions@v3
        with: { use-oidc: true }
      - run: snow connection test -x
      <span class="cmt"># sync registry.yml -&gt; table via emitted SQL (no connector creds)</span>
      - run: |
          python -m pipelines.registry_sync --emit-sql --prune &gt; sync.sql
          snow sql -f sync.sql -x
      - run: snow stage copy deploy/spcs/dlt_job.tmpl.yaml @DLT_DB.DEPLOY.SPECS --overwrite -x
      - run: |
          python -m deploy.tasks.generate_tasks &gt; tasks.sql
          snow sql -f tasks.sql -x`;

export default function Deploy() {
  return (
    <section className="page">
      <div className="wrap">
        <p className="kicker">Landing &amp; Running</p>
        <h2>Snowflake setup &amp; deployment</h2>
        <p className="sub">
          Run the bootstrap DDL once as an admin, then deploy each pipeline as an SPCS job on a Snowflake
          Task schedule (one Task per pipeline, generated from the registry).
        </p>

        <h3>
          Bootstrap DDL (<code>sql/</code>)
        </h3>
        <ol className="steps">
          <li>
            <b>Account setup.</b> Create a dedicated role hierarchy (e.g. <code>DLT_LOADER_ROLE</code>), a
            Gen2 multi-cluster load warehouse (<code>DLT_WH</code>, auto-suspend), an SPCS compute pool
            (<code>DLT_POOL</code>), the target database and schema, and grant the role the needed
            <code>USAGE</code>/<code>CREATE</code> privileges (<code>04_compute_pool.sql</code>,{' '}
            <code>05_load_warehouse.sql</code>).
          </li>
          <li>
            <b>Service user.</b> Create <code>DLT_LOADER</code>, assign the loader role, and register its
            RSA public key (<code>ALTER USER ... SET RSA_PUBLIC_KEY=...</code>) for key-pair auth from
            external runners.
          </li>
          <li>
            <b>External stage (optional).</b> Only if using external staging: create a storage integration
            and an external stage, and grant the loader role usage on both.
          </li>
          <li>
            <b>Config store.</b> Create the runtime registry table (<code>OPS.PIPELINE_REGISTRY</code>) and
            the specs stage (<code>@DLT_DB.DEPLOY.SPECS</code>) holding the job spec template
            (<code>dlt_job.tmpl.yaml</code>). Grant the loader role <code>SELECT</code> on the table and
            <code>READ</code> on the stage. (See <b>Scaling &amp; Multi-pipeline &rarr; Config as data</b>.)
          </li>
        </ol>

        <h3>Run natively in Snowflake (SPCS + Task)</h3>
        <ul className="plain">
          <li>
            <b>
              <code>deploy/spcs/Dockerfile</code>
            </b>{' '}
            — package Python, dlt, drivers, and the <code>pipelines/</code> code into an image; push to a
            Snowflake image repository.
          </li>
          <li>
            <b>
              <code>deploy/spcs/job.yaml</code>
            </b>{' '}
            — the default job-per-pipeline spec (run-to-completion). The container runs under a role, so
            the pipeline uses <code>authenticator="oauth"</code> with the session token — no credentials in
            the image. <code>service.yaml</code> is the optional long-running (near-real-time) variant.
          </li>
          <li>
            <b>
              <code>deploy/tasks/generate_tasks.py</code>
            </b>{' '}
            — reads the registry and emits <b>one Snowflake Task per pipeline</b>, each on its own cron.
            Each Task references the spec template on the stage and binds the pipeline name with{' '}
            <code>USING (pipeline =&gt; &apos;name&apos;)</code> — the job spec is not baked into the image.
          </li>
        </ul>

        <h3>Adding a pipeline (no rebuild)</h3>
        <ol className="steps">
          <li>
            <b>Edit</b> <code>registry.yml</code> (authoring format) and <b>sync</b> the entry into{' '}
            <code>OPS.PIPELINE_REGISTRY</code>.
          </li>
          <li>
            <b>Create its Task</b> with <code>generate_tasks.py</code> (one <code>CREATE TASK</code>), then{' '}
            <code>RESUME</code> it.
          </li>
          <li>
            That&apos;s it — <b>no image rebuild</b>. The container reads the new pipeline&apos;s config from
            the table at run time. Rebuild + repush the image only when <code>run.py</code>,{' '}
            <code>models.py</code>, or dependencies change.
          </li>
        </ol>

        <h3>Automated deploys (GitHub Actions + OIDC)</h3>
        <p>
          CI/CD runs on the official <code>snowflakedb/snowflake-actions</code> action, which installs
          the Snowflake CLI and authenticates with a <b>GitHub OIDC token</b> — no private keys stored as
          secrets. Snowflake validates the token against a <code>TYPE = SERVICE</code> user whose{' '}
          <code>WORKLOAD_IDENTITY</code> subject matches the workflow.
        </p>
        <CodeBlock label="keyless service identity" html={OIDC_USER_SQL} />
        <p>
          The <code>deploy</code> workflow does the <b>repeatable</b> deploy (the one-time bootstrap DDL
          stays an admin task): sync <code>registry.yml</code> into the table, upload the spec template,
          and (re)create the Tasks. The registry sync uses <code>registry_sync --emit-sql</code>, which
          prints inlined-literal <code>MERGE</code> statements so everything runs through <code>snow sql</code>{' '}
          on the OIDC auth alone — the runner needs no Python-connector credentials.
        </p>
        <CodeBlock label=".github/workflows/deploy.yml" html={DEPLOY_YML} />
        <Note variant="tip">
          <b>Least privilege:</b> the job needs <code>id-token: write</code> and{' '}
          <code>contents: read</code> only, targets a gated GitHub <code>environment</code> (add required
          reviewers), and sets <code>persist-credentials: false</code> on checkout. Generated Tasks are
          created <code>SUSPENDED</code>; resume them deliberately.
        </Note>

        <Note variant="tip">
          <b>Why in-Snowflake:</b> data never leaves Snowflake's boundary, there are no long-lived
          credentials to manage, and scheduling/observability live next to the data. External runners
          (laptop, CI) remain fully supported via key-pair for development and testing.
        </Note>
      </div>
    </section>
  );
}
