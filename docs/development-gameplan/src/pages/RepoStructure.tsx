import RepoTree from '../components/RepoTree';
import Note from '../components/Note';

const TREE = `<span class="dir">dlt-snowflake-template/</span>
&#9500;&#9472; README.md                    <span class="cmt"># quickstart: clone &rarr; configure &rarr; first load</span>
&#9500;&#9472; Makefile                     <span class="cmt"># uv setup + make setup-base/prod/dev + dev-run</span>
&#9500;&#9472; pyproject.toml               <span class="cmt"># dlt[snowflake] + backends + dialect drivers</span>
&#9500;&#9472; uv.lock                      <span class="cmt"># pinned deps (uv sync)</span>
&#9500;&#9472; .gitignore                   <span class="cmt"># MUST ignore .dlt/secrets.toml</span>
&#9500;&#9472; <span class="dir">.dlt/</span>
&#9474;   &#9500;&#9472; config.toml              <span class="cmt"># non-secret: dataset, backend, staging, query_tag</span>
&#9474;   &#9492;&#9472; secrets.toml.example     <span class="cmt"># every auth method, documented, no real secrets</span>
&#9500;&#9472; <span class="dir">pipelines/</span>
&#9474;   &#9500;&#9472; __init__.py
&#9474;   &#9500;&#9472; registry.yml             <span class="cmt"># authoring source; synced to OPS.PIPELINE_REGISTRY</span>
&#9474;   &#9500;&#9472; run.py                   <span class="cmt"># generic runner: reads config for the named pipeline, loads</span>
&#9474;   &#9500;&#9472; sample_source.py         <span class="cmt"># in-code generator source (zero-dep smoke: local + SPCS)</span>
&#9474;   &#9500;&#9472; models.py                <span class="cmt"># typed registry loader + validation</span>
&#9474;   &#9500;&#9472; registry_store.py        <span class="cmt"># runtime read of OPS.PIPELINE_REGISTRY (SPCS OAuth / env)</span>
&#9474;   &#9500;&#9472; registry_sync.py         <span class="cmt"># push registry.yml -&gt; OPS.PIPELINE_REGISTRY (no rebuild)</span>
&#9474;   &#9492;&#9472; observability.py         <span class="cmt"># tagged logs + OPS._DLT_RUNS collector</span>
&#9500;&#9472; <span class="dir">sources/</span>                    <span class="cmt"># custom + vendored verified sources (e.g. salesforce/)</span>
&#9474;   &#9492;&#9472; __init__.py
&#9500;&#9472; <span class="dir">sql/</span>                        <span class="cmt"># Snowflake bootstrap DDL, grouped by scope (run base first)</span>
&#9474;   &#9500;&#9472; <span class="dir">base/</span>                   <span class="cmt"># shared control plane (run once)</span>
&#9474;   &#9474;   &#9500;&#9472; 01_roles.sql         <span class="cmt"># DLT_LOADER_ROLE + DLT_DEV_ROLE (USERADMIN)</span>
&#9474;   &#9474;   &#9500;&#9472; 02_control_plane.sql <span class="cmt"># DLT_DB: OPS + DEPLOY, image repo (SYSADMIN)</span>
&#9474;   &#9474;   &#9492;&#9472; 03_registry.sql      <span class="cmt"># OPS.PIPELINE_REGISTRY + @DEPLOY.SPECS</span>
&#9474;   &#9500;&#9472; <span class="dir">prod/</span>                   <span class="cmt"># production data + compute</span>
&#9474;   &#9474;   &#9500;&#9472; 01_prod_db.sql       <span class="cmt"># DLT_PROD_DB (RAW + OPS)</span>
&#9474;   &#9474;   &#9500;&#9472; 02_compute.sql       <span class="cmt"># DLT_POOL + DLT_WH (Gen2 multi-cluster)</span>
&#9474;   &#9474;   &#9500;&#9472; 03_service_user.sql  <span class="cmt"># DLT_LOADER + RSA key-pair</span>
&#9474;   &#9474;   &#9492;&#9472; 03b_service_user_oidc.sql <span class="cmt"># keyless CI/CD user (GitHub OIDC) [optional]</span>
&#9474;   &#9492;&#9472; <span class="dir">dev/</span>                    <span class="cmt"># isolated in-Snowflake development</span>
&#9474;       &#9500;&#9472; 01_dev_db.sql        <span class="cmt"># DLT_DEV_DB + CREATE SCHEMA (per-dev DEV_&lt;user&gt;)</span>
&#9474;       &#9492;&#9472; 02_compute.sql       <span class="cmt"># DLT_DEV_POOL + DLT_DEV_WH</span>
&#9500;&#9472; <span class="dir">deploy/</span>
&#9474;   &#9500;&#9472; <span class="dir">spcs/</span>
&#9474;   &#9474;   &#9500;&#9472; Dockerfile           <span class="cmt"># one image runs any pipeline; registry NOT baked in</span>
&#9474;   &#9474;   &#9500;&#9472; dlt_job.tmpl.yaml    <span class="cmt"># prod spec template ({{ pipeline }}); writes DLT_PROD_DB</span>
&#9474;   &#9474;   &#9500;&#9472; dlt_dev_job.tmpl.yaml <span class="cmt"># dev spec: binds a SECRET, writes DLT_DEV_DB.DEV_&lt;user&gt;</span>
&#9474;   &#9474;   &#9500;&#9472; dlt_dev_job_nosecret.tmpl.yaml <span class="cmt"># dev spec for no-secret sources (e.g. sample)</span>
&#9474;   &#9474;   &#9500;&#9472; job.yaml             <span class="cmt"># job-per-pipeline spec (default)</span>
&#9474;   &#9474;   &#9492;&#9472; service.yaml         <span class="cmt"># long-running service (optional, near-real-time)</span>
&#9474;   &#9492;&#9472; <span class="dir">tasks/</span>
&#9474;       &#9492;&#9472; generate_tasks.py    <span class="cmt"># one CREATE TASK per pipeline (template + USING)</span>
&#9500;&#9472; <span class="dir">tests/</span>
&#9474;   &#9500;&#9472; test_registry_smoke.py   <span class="cmt"># DuckDB-backed smoke test, no Snowflake needed</span>
&#9474;   &#9492;&#9472; test_registry_config.py  <span class="cmt"># spec_from_row + registry_sync SQL unit tests</span>
&#9500;&#9472; <span class="dir">.github/workflows/</span>
&#9474;   &#9500;&#9472; ci.yml                   <span class="cmt"># lint + import/compile check</span>
&#9474;   &#9492;&#9472; deploy.yml               <span class="cmt"># OIDC CD: sync registry, ship template, apply Tasks</span>
&#9492;&#9472; <span class="dir">docs/</span>
    &#9492;&#9472; <span class="dir">development-gameplan/</span>    <span class="cmt"># this docs site (React)</span>`;

export default function RepoStructure() {
  return (
    <section className="page">
      <div className="wrap">
        <p className="kicker">Scaffold</p>
        <h2>Repository structure</h2>
        <p className="sub">
          A predictable layout so a new user knows exactly where config, pipelines, Snowflake DDL, and
          deployment artifacts live.
        </p>

        <RepoTree html={TREE} />

        <Note>
          <b>
            Dependencies (<code>pyproject.toml</code>):
          </b>{' '}
          <code>dlt[snowflake]</code>, plus <code>connectorx</code> and <code>pyarrow</code> for fast SQL
          extraction, plus the source dialect drivers you need: <code>psycopg2-binary</code> (Postgres),{' '}
          <code>pyodbc</code> (SQL Server), <code>pymysql</code> (MySQL/MariaDB), <code>oracledb</code>{' '}
          (Oracle). REST needs no extra driver.
        </Note>
      </div>
    </section>
  );
}
