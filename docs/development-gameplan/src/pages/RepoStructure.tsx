import RepoTree from '../components/RepoTree';
import Note from '../components/Note';

const TREE = `<span class="dir">dlt-snowflake-template/</span>
&#9500;&#9472; README.md                    <span class="cmt"># quickstart: clone &rarr; configure &rarr; first load</span>
&#9500;&#9472; pyproject.toml               <span class="cmt"># dlt[snowflake] + backends + dialect drivers</span>
&#9500;&#9472; .gitignore                   <span class="cmt"># MUST ignore .dlt/secrets.toml</span>
&#9500;&#9472; <span class="dir">.dlt/</span>
&#9474;   &#9500;&#9472; config.toml              <span class="cmt"># non-secret: dataset, backend, staging, query_tag</span>
&#9474;   &#9492;&#9472; secrets.toml.example     <span class="cmt"># every auth method, documented, no real secrets</span>
&#9500;&#9472; <span class="dir">pipelines/</span>
&#9474;   &#9500;&#9472; __init__.py
&#9474;   &#9500;&#9472; registry.yml             <span class="cmt"># authoring source; synced to OPS.PIPELINE_REGISTRY</span>
&#9474;   &#9500;&#9472; run.py                   <span class="cmt"># generic runner: reads config for the named pipeline, loads</span>
&#9474;   &#9500;&#9472; models.py                <span class="cmt"># typed registry loader + validation</span>
&#9474;   &#9500;&#9472; registry_store.py        <span class="cmt"># runtime read of OPS.PIPELINE_REGISTRY (SPCS OAuth / env)</span>
&#9474;   &#9500;&#9472; registry_sync.py         <span class="cmt"># push registry.yml -&gt; OPS.PIPELINE_REGISTRY (no rebuild)</span>
&#9474;   &#9492;&#9472; observability.py         <span class="cmt"># tagged logs + OPS._DLT_RUNS collector</span>
&#9500;&#9472; <span class="dir">sources/</span>                    <span class="cmt"># custom + vendored verified sources (e.g. salesforce/)</span>
&#9474;   &#9492;&#9472; __init__.py
&#9500;&#9472; <span class="dir">sql/</span>                        <span class="cmt"># Snowflake bootstrap DDL, run once by admin</span>
&#9474;   &#9500;&#9472; 01_account_setup.sql     <span class="cmt"># role hierarchy, database, schema, grants</span>
&#9474;   &#9500;&#9472; 02_service_user.sql      <span class="cmt"># service user + RSA public key (key-pair auth)</span>
&#9474;   &#9500;&#9472; 02b_service_user_oidc.sql <span class="cmt"># keyless CI/CD user (GitHub OIDC workload identity)</span>
&#9474;   &#9500;&#9472; 03_external_stage.sql    <span class="cmt"># optional: storage integration + external stage</span>
&#9474;   &#9500;&#9472; 04_compute_pool.sql      <span class="cmt"># shared SPCS pool for pipeline jobs</span>
&#9474;   &#9500;&#9472; 05_load_warehouse.sql    <span class="cmt"># Gen2 multi-cluster warehouse for loads</span>
&#9474;   &#9492;&#9472; 06_pipeline_registry.sql <span class="cmt"># OPS.PIPELINE_REGISTRY table + @DEPLOY.SPECS stage</span>
&#9500;&#9472; <span class="dir">deploy/</span>
&#9474;   &#9500;&#9472; <span class="dir">spcs/</span>
&#9474;   &#9474;   &#9500;&#9472; Dockerfile           <span class="cmt"># one image runs any pipeline; registry NOT baked in</span>
&#9474;   &#9474;   &#9500;&#9472; dlt_job.tmpl.yaml    <span class="cmt"># spec template ({{ pipeline }}); staged on @DEPLOY.SPECS</span>
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
