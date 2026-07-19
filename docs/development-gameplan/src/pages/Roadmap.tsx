interface Phase {
  badge: string;
  title: string;
  items: string[];
  done: string;
}

const PHASES: Phase[] = [
  {
    badge: 'Phase 1',
    title: 'Scaffold & config',
    items: [
      'Create pyproject.toml: dlt[snowflake] + connectorx/pyarrow, dialect drivers as extras (postgres/mssql/mysql/oracle), pyyaml, and duckdb for dev',
      'Add .dlt/config.toml (default dataset, backend, staging, query_tag) and secrets.toml.example covering every auth method',
      'Add .gitignore that excludes .dlt/secrets.toml',
      'Write README.md quickstart mirroring this gameplan',
    ],
    done: 'A clean venv installs the project and `python -c "import dlt"` runs.',
  },
  {
    badge: 'Phase 2',
    title: 'Pipeline registry & runner',
    items: [
      'Define registry.yml: defaults block + pipelines list (name, source, schedule, dataset_name, write_disposition, group, config)',
      'Implement pipelines/models.py: typed loader that merges defaults and validates (known source, unique names, valid disposition)',
      'Implement pipelines/run.py: dispatch by source (sql_database / rest_api), resolve secret: refs, support name / --group / --all / --list, log LoadInfo + row counts',
      'Make OPS.PIPELINE_REGISTRY the runtime source (synced from registry.yml) so run.py reads config from Snowflake — adding a pipeline needs no image rebuild',
    ],
    done: '`python -m pipelines.run --list` prints the registry and a DuckDB smoke run of one entry loads rows.',
  },
  {
    badge: 'Phase 3',
    title: 'SQL sources',
    items: [
      'Add sql_database entries to the registry; choose a backend per dialect (connectorx/pyarrow) per the Backends guidance',
      'Configure incremental cursors + merge/primary_key; set reflection_level for type fidelity',
      'Use the Databases catalog for the URL prefix, driver, and gotchas of each dialect',
    ],
    done: 'An incremental sql_database entry loads to Snowflake and a re-run picks up only changed rows (two rows in _dlt_loads).',
  },
  {
    badge: 'Phase 4',
    title: 'REST sources',
    items: [
      'Add rest_api entries: client (base_url, auth, paginator), resource_defaults, resources',
      'Cover an incremental resource ({incremental.start_value}) and a dependent resource ({resources.*})',
      'Set write_disposition=merge + primary_key for idempotent upserts; reference tokens with the secret: prefix',
    ],
    done: 'A rest_api entry loads, a second run is incremental, and a parent-child pair populates linked tables.',
  },
  {
    badge: 'Phase 5',
    title: 'Snowflake bootstrap DDL',
    items: [
      'sql/base/01_roles.sql: DLT_LOADER_ROLE + DLT_DEV_ROLE (USERADMIN)',
      'sql/base/02_control_plane.sql: DLT_DB (OPS + DEPLOY), image repository, shared grants (SYSADMIN)',
      'sql/base/03_registry.sql: OPS.PIPELINE_REGISTRY + @DEPLOY.SPECS stage',
      'sql/prod/01_prod_db.sql: DLT_PROD_DB (RAW + OPS) + grants to DLT_LOADER_ROLE',
      'sql/prod/02_compute.sql: DLT_POOL + DLT_WH Gen2 multi-cluster (single-cluster fallback for Standard Edition)',
      'sql/prod/03_service_user.sql + 03b_service_user_oidc.sql: DLT_LOADER key-pair + optional keyless OIDC deployer',
      'sql/dev/01_dev_db.sql + 02_compute.sql: DLT_DEV_DB (per-dev DEV_<user> schemas) + DLT_DEV_POOL / DLT_DEV_WH',
    ],
    done: 'make setup-base then setup-prod/setup-dev run clean; each role can use its compute and create in its target database.',
  },
  {
    badge: 'Phase 6',
    title: 'Native deployment',
    items: [
      'deploy/spcs/Dockerfile: one image (ENTRYPOINT python -m pipelines.run) built and pushed to the image repository',
      'deploy/spcs/job.yaml: job-per-pipeline spec using the OAuth session token (no stored creds); service.yaml as the long-running alternative',
      'deploy/tasks/generate_tasks.py: emit one CREATE TASK per registry entry (its cron -> EXECUTE JOB SERVICE with the pipeline name)',
      'Stage a spec template (dlt_job.tmpl.yaml) and have each Task bind the pipeline via USING(pipeline=>..) so the spec is not baked in; rebuild the image only on code/dependency changes',
    ],
    done: 'A manual EXECUTE JOB SERVICE loads a pipeline in-Snowflake with no stored credentials, and a resumed Task runs it on schedule.',
  },
  {
    badge: 'Phase 7',
    title: 'Observability & hardening',
    items: [
      'Call info.raise_on_failed_jobs() and write each run to a shared OPS._dlt_runs control table keyed by pipeline (the collector)',
      'Tag logs with the pipeline (SnowflakeLogFormatter + LoggerAdapter); point dashboards/alerts at the event table via snow.service.name LIKE \'DLT_JOB_%\'',
      'Apply schema contracts + document the evolution policy; set query_tag; add resource-monitor / auto-suspend cost guardrails',
      'Add tests/test_registry_smoke.py (DuckDB) and .github/workflows/ci.yml (lint + import/compile + smoke)',
    ],
    done: 'A failing load raises and is visible in OPS._dlt_runs and the event table grouped by pipeline; CI passes on a clean checkout.',
  },
];

export default function Roadmap() {
  return (
    <section className="page">
      <div className="wrap">
        <p className="kicker">Execution Plan</p>
        <h2>Phased build roadmap</h2>
        <p className="sub">
          Build the template in this order. Each phase produces something runnable and ends with a{' '}
          <b>Done when</b> check, so the template is never in a broken half-state. The plan reflects the
          registry-driven, multi-pipeline design: sources are config entries, not hardcoded scripts, and
          many pipelines share one pool and one Gen2 multi-cluster warehouse.
        </p>

        {PHASES.map((phase) => (
          <div className="phase" key={phase.badge}>
            <h4>
              <span className="badge">{phase.badge}</span> {phase.title}
            </h4>
            <ul className="check">
              {phase.items.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
            <p className="done">
              <b>Done when:</b> {phase.done}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
