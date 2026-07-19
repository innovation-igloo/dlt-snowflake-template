import Flow from '../components/Flow';
import CodeBlock from '../components/CodeBlock';
import Note from '../components/Note';

const SETUP_BASE = `<span class="cmt"># Shared control plane — run once. CONFIRM=1 actually applies.</span>
make setup-base CONFIRM=1     <span class="cmt"># sql/base/* → roles, DLT_DB, registry, image repo, spec stage</span>`;

const SETUP_PROD = `<span class="cmt"># Production: scheduled loads into DLT_PROD_DB.RAW</span>
make setup-prod CONFIRM=1     <span class="cmt"># sql/prod/01_prod_db, 02_compute, 03_service_user</span>
<span class="cmt"># optional, edit placeholders first: sql/prod/03b_service_user_oidc.sql (keyless CI/CD)</span>`;

const SETUP_DEV = `<span class="cmt"># Development: ad-hoc runs into per-developer DLT_DEV_DB.DEV_&lt;user&gt; schemas</span>
make setup-dev CONFIRM=1      <span class="cmt"># sql/dev/* → DLT_DEV_DB, DLT_DEV_POOL, DLT_DEV_WH</span>
<span class="cmt"># then grant the dev role to developers:</span>
<span class="cmt">--   GRANT ROLE DLT_DEV_ROLE TO USER &lt;login&gt;;</span>`;

const IMAGE = `<span class="cmt"># SPCS pools are x86_64 -> the image MUST be linux/amd64.</span>
<span class="cmt"># Prefer the CI build (deploy.yml) on an amd64 runner; local builds on Apple</span>
<span class="cmt"># Silicon emulate via QEMU and are slow.</span>
make image-push               <span class="cmt"># build (uv, linux/amd64) + login + push to DLT_DB.DEPLOY.IMAGES</span>`;

const TASKS = `<span class="cmt"># Sync registry + generate Tasks, then apply (see Snowflake &amp; Deploy for CD)</span>
make emit                     <span class="cmt"># build/sync.sql + build/tasks.sql</span>
make deploy                   <span class="cmt"># applies both; Tasks are created SUSPENDED</span>
<span class="cmt"># resume when ready:</span>
<span class="cmt">--   ALTER TASK dlt_task_pg_public RESUME;</span>`;

const DEV_RUN = `<span class="cmt"># In-Snowflake dev run (SPCS). One-time prep:</span>
make image-push               <span class="cmt"># image the container runs</span>
make sync-apply               <span class="cmt"># put pipelines in DLT_DB.OPS.PIPELINE_REGISTRY (the container reads this)</span>
make dev-spec-upload          <span class="cmt"># upload the dev spec templates to @DEPLOY.SPECS</span>
make dev-pool-status          <span class="cmt"># wait until DLT_DEV_POOL is ACTIVE/IDLE</span>

<span class="cmt"># Smoke test — the sample generator needs no source secret:</span>
make dev-run NAME=sample      <span class="cmt"># runs in SPCS → DLT_DEV_DB.DEV_&lt;snowflake_user&gt;</span>
<span class="cmt"># success prints: Job DLT_DEV_SAMPLE completed successfully with status: DONE.</span>

<span class="cmt"># Verify the load (expect 5 + 5):</span>
<span class="cmt">--   SELECT COUNT(*) FROM DLT_DEV_DB.DEV_&lt;user&gt;.CUSTOMERS;</span>
<span class="cmt">--   SELECT COUNT(*) FROM DLT_DEV_DB.DEV_&lt;user&gt;.ORDERS;</span>

<span class="cmt"># Real source — bind its credential from a Snowflake SECRET:</span>
make dev-run NAME=github_issues \\
  SECRET=DLT_DB.OPS.GITHUB_ISSUES_TOKEN \\
  ENVVAR=SOURCES__GITHUB_ISSUES__TOKEN   <span class="cmt"># add EAI=&lt;name&gt; for external egress</span>`;

export default function Setup() {
  return (
    <section className="page">
      <div className="wrap">
        <p className="kicker">Getting Started</p>
        <h2>Setup plan</h2>
        <p className="sub">
          The ordered runbook to stand up the template in a Snowflake account. Infrastructure is split
          into a shared <b>control plane</b> (<code>DLT_DB</code>) plus isolated <b>production</b>{' '}
          (<code>DLT_PROD_DB</code>) and <b>development</b> (<code>DLT_DEV_DB</code>) databases, each with
          its own compute and role. <b>Development is the primary path</b> — get developers productive in
          Snowflake first. Production is a separate, customer-tailored flow you stand up later, once you
          know the scheduling, sizing, and governance the customer needs.
        </p>

        <Flow
          nodes={[
            { icon: '🧰', title: 'Prerequisites', sub: 'uv · docker · snow', variant: 'src' },
            { icon: '🏛️', title: 'Base', sub: 'roles + control plane' },
            { icon: '📦', title: 'Image', sub: 'shared by dev + prod' },
            { icon: '🧪', title: 'Dev', sub: 'primary developer loop', variant: 'dest' },
            { icon: '🏭', title: 'Prod', sub: 'later, tailored' },
          ]}
        />

        <Note>
          <b>Dev-first.</b> This template is a starting point to get developers building pipelines in an
          isolated Snowflake sandbox. Do <b>not</b> stand up production objects before dev — production is
          its own flow, adapted to each customer&apos;s needs, covered at the end.
        </Note>

        <h3>0. Prerequisites</h3>
        <p>
          Install <code>uv</code>, <code>docker</code>, and the Snowflake CLI (<code>snow</code>) — run{' '}
          <code>make doctor</code> to check them. The operator running setup needs to assume the admin
          roles the scripts switch to; connecting as <code>ACCOUNTADMIN</code> (which inherits{' '}
          <code>SYSADMIN</code> and <code>USERADMIN</code>) is simplest.
        </p>

        <Note>
          <b>Least privilege by design.</b> Each script switches to the lowest admin role it needs:{' '}
          <code>USERADMIN</code> creates roles and users, <code>SYSADMIN</code> owns all
          databases/schemas/warehouses/pools/stages (and grants to the functional roles), and{' '}
          <code>ACCOUNTADMIN</code> is used only for the two account-level steps that require it —{' '}
          <code>EXECUTE TASK ON ACCOUNT</code> (base) and, if used, a <code>STORAGE INTEGRATION</code>.
        </Note>

        <h3>1. Shared base (run once)</h3>
        <p>
          Creates the roles (<code>DLT_LOADER_ROLE</code>, <code>DLT_DEV_ROLE</code>) and the{' '}
          <code>DLT_DB</code> control plane: <code>OPS.PIPELINE_REGISTRY</code>, the{' '}
          <code>DEPLOY.IMAGES</code> image repository, and the <code>@DEPLOY.SPECS</code> spec stage.
        </p>
        <CodeBlock label="shared control plane" html={SETUP_BASE} />

        <h3>2. Build &amp; push the image</h3>
        <p>
          One image runs any pipeline and is shared by <b>both</b> dev and prod SPCS jobs; the registry is{' '}
          <b>not</b> baked in. Push it once so dev runs can start, and rebuild only when code or
          dependencies change — never for a new pipeline. SPCS pools are <b>x86_64</b>, so the image must
          be <code>linux/amd64</code>: build it in CI (<code>.github/workflows/deploy.yml</code>) on an
          amd64 runner rather than an Apple Silicon laptop, where it emulates via QEMU and crawls.
        </p>
        <CodeBlock label="image" html={IMAGE} />

        <h3>3. Development — the primary path</h3>
        <p>
          Creates <code>DLT_DEV_DB</code> with a <code>CREATE SCHEMA</code> grant so dlt auto-creates a
          per-developer <code>DEV_&lt;user&gt;</code> schema on first run, plus the small{' '}
          <code>DLT_DEV_POOL</code> / <code>DLT_DEV_WH</code> compute. Developers assume{' '}
          <code>DLT_DEV_ROLE</code> in their own connection — no dev service user needed.
        </p>
        <CodeBlock label="development" html={SETUP_DEV} />
        <p>
          Then develop entirely in Snowflake — no local <code>.dlt/secrets.toml</code>. The bundled{' '}
          <code>sample</code> pipeline is an in-code generator, so it runs in an SPCS container with{' '}
          <b>no source secret</b> — the fastest proof the whole path works. For a real source, its
          credential lives in a Snowflake <b>SECRET</b> that the dev spec binds into the container env var
          named by <code>ENVVAR</code>; <code>pipelines/run.py</code> resolves the registry&apos;s{' '}
          <code>secret:</code> ref through <code>dlt.secrets</code>, which reads that env var.{' '}
          <code>DLT_DATASET</code> (defaulting to <code>DEV_&lt;snowflake_user&gt;</code> from your
          connection) targets your isolated schema. The container reads its config from{' '}
          <code>DLT_DB.OPS.PIPELINE_REGISTRY</code>, so <code>make sync-apply</code> must run first.
        </p>
        <CodeBlock label="develop in Snowflake (SPCS)" html={DEV_RUN} />
        <Note variant="tip">
          Clean up a sandbox when done: <code>DROP SCHEMA IF EXISTS DLT_DEV_DB.DEV_&lt;user&gt;;</code>. The{' '}
          <code>CREATE SECRET</code> DDL and optional External Access Integration (for external sources)
          are a follow-up step; <code>make dev-run</code> prints the exact wiring it expects.
        </Note>

        <h3>4. Production — a separate, customer-tailored flow</h3>
        <p>
          Stand up production only when you are ready to schedule real loads, and{' '}
          <b>review <code>sql/prod/*</code> first</b> — warehouse sizing, multi-cluster settings, service
          accounts, and scheduling should match the customer&apos;s workload and governance. The files
          below are a starting point, not a prescription.
        </p>
        <CodeBlock label="production (tailor first)" html={SETUP_PROD} />
        <p>
          Then sync <code>registry.yml</code> into <code>OPS.PIPELINE_REGISTRY</code> and generate one Task
          per scheduled pipeline. See <b>Snowflake &amp; Deploy</b> for the automated OIDC path.
        </p>
        <CodeBlock label="tasks" html={TASKS} />
      </div>
    </section>
  );
}
