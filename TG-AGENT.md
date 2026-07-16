# TG-AGENT.md

Onboarding + setup + testing guide for this repo. Read this first when working in an
isolated session scoped to `dlt-snowflake-template/`.

## What this repo is

A batteries-included template for running **dlt** (data load tool) pipelines into
**Snowflake**, deployable natively via **SPCS** (Snowpark Container Services) jobs on
**Snowflake Tasks**. You declare pipelines once in `pipelines/registry.yml`; a single
generic runner and a single container image run them all.

The design is a **control-plane / data-plane split**:

- `pipelines/registry.yml` is the human-authored source of truth (git).
- `registry_sync` pushes it into the `DLT_DB.OPS.PIPELINE_REGISTRY` table (the runtime
  source of truth).
- The container reads its config from that table at run time, so **adding a pipeline is a
  table change plus one Task, never an image rebuild**. The image is rebuilt only when
  code or dependencies change.

Two compute surfaces are involved on every run:
1. **SPCS compute pool** (`DLT_POOL`) runs the dlt process (extract + normalize + orchestrate).
2. **Gen2 multi-cluster warehouse** (`DLT_WH`) runs `COPY INTO` / `MERGE`. Clusters scale
   for concurrency, not single-load speed.

## Repo map

```
pipelines/
  registry.yml          # authored pipeline list (pg_public, github_issues)
  models.py             # PipelineSpec + load_registry (YAML) + spec_from_row (table row)
  run.py                # generic runner; dual-mode config (table vs YAML)
  registry_store.py     # reads OPS.PIPELINE_REGISTRY (OAuth-in-SPCS or SNOWFLAKE_* env)
  registry_sync.py      # YAML -> table MERGE; also --emit-sql / --dry-run / --prune
  observability.py      # tagged logs + OPS._DLT_RUNS run collector
sources/                # custom + vendored verified sources (e.g. `dlt init salesforce snowflake`)
sql/                    # one-time bootstrap DDL, run by an admin in order
  01_account_setup.sql  # roles, DLT_DB, schemas RAW/OPS/DEPLOY, image repo
  02_service_user.sql   # DLT_LOADER + RSA key-pair (external/local auth)
  02b_service_user_oidc.sql # DLT_DEPLOYER keyless CI/CD user (GitHub OIDC)  [optional]
  03_external_stage.sql # external S3/GCS/Azure stage                        [optional]
  04_compute_pool.sql   # DLT_POOL
  05_load_warehouse.sql # DLT_WH (Gen2 multi-cluster)
  06_pipeline_registry.sql # OPS.PIPELINE_REGISTRY table + @DEPLOY.SPECS stage + grants
deploy/
  spcs/Dockerfile       # one image runs any pipeline; registry NOT baked in
  spcs/dlt_job.tmpl.yaml # SPCS job spec template ({{ pipeline }}), staged on @DEPLOY.SPECS
  spcs/job.yaml         # job-per-pipeline spec (manual/default)
  spcs/service.yaml     # long-running service variant (optional)
  tasks/generate_tasks.py # emits one CREATE OR ALTER TASK per pipeline (template + USING)
tests/
  test_registry_config.py # pure unit tests: spec_from_row + sync SQL (no dlt, no network)
  test_registry_smoke.py  # sqlite -> dlt -> DuckDB end-to-end (needs dlt + duckdb)
.github/workflows/
  ci.yml                # offline: lint, import/compile, run --list, tests
  deploy.yml            # OIDC CD: sync registry, upload template, apply Tasks
.dlt/
  config.toml           # non-secret settings (dataset, backend, staging, query_tag)
  secrets.toml.example  # every auth method documented; copy to secrets.toml (git-ignored)
.docs/                  # background research notes (dlt+snowflake, rest-api, verified sources)
docs/development-gameplan/ # the React docs site (build gameplan / reference)
```

## Environment knobs (read by the runner)

- `DLT_REGISTRY_SOURCE` = `auto` (default) | `table` | `yaml`.
  `auto` picks the table when an SPCS session token is mounted at
  `/snowflake/session/token`, otherwise YAML. Set `yaml` for local dev.
- `DLT_DESTINATION` = override destination for all pipelines (tests set `duckdb`).
- `LOG_LEVEL` = `INFO` (default), etc.
- In SPCS the spec template sets `DESTINATION__SNOWFLAKE__CREDENTIALS__AUTHENTICATOR=oauth`
  plus `..._DATABASE=DLT_DB` and `..._WAREHOUSE=DLT_WH`, and auth uses the ambient token.
- For external table reads/syncs, `registry_store` uses `SNOWFLAKE_ACCOUNT`, `SNOWFLAKE_USER`,
  and one of `SNOWFLAKE_PASSWORD` / key-pair, plus optional `SNOWFLAKE_ROLE` / `_WAREHOUSE`.

Secrets convention: any registry value written as `secret:<path>` is resolved from
`.dlt/secrets.toml` (or a Snowflake secret) at run time. Never put plaintext credentials in
`registry.yml` or the table.

## Local testing (no Snowflake)

```bash
# 1. Python env + deps (dev pulls duckdb + dlt[duckdb] + pytest + ruff)
python -m venv .venv && source .venv/bin/activate
pip install -e ".[dev,postgres]"     # add mssql / mysql / oracle extras as needed

# 2. Full test suite (config unit tests + DuckDB smoke)
pytest -q

# 3. Config-only unit tests (do NOT need dlt installed)
pytest tests/test_registry_config.py -q

# 4. Inspect the registry from YAML (needs dlt installed)
DLT_REGISTRY_SOURCE=yaml python -m pipelines.run --list

# 5. Preview the registry-sync SQL with NO connection (needs only pyyaml)
python -m pipelines.registry_sync --emit-sql --prune

# 6. Render the Task DDL from the registry
python -m deploy.tasks.generate_tasks
```

Notes:
- `run.py` imports `dlt` at module load, so `run --list` / `run <name>` require the `dev`
  (or `snowflake`) extra installed. The `--emit-sql` and `generate_tasks` paths need only
  `pyyaml`, which is why CD can run them on a lean runner.
- The DuckDB smoke test builds a throwaway sqlite DB, loads it through the real
  `sql_database` source, and asserts row counts. It is fully isolated in a temp dir.

## Docs site

```bash
cd docs/development-gameplan
npm install
npm run dev      # local preview
npm run build    # tsc --noEmit + vite build (should transform ~86 modules cleanly)
```

## Snowflake setup (one-time, run by an admin)

Run the `sql/` scripts in order in Snowsight/SnowSQL. Edit placeholders first.

```
01_account_setup.sql       # required: roles, DLT_DB, schemas, image repo
02_service_user.sql        # required for local/external key-pair auth
02b_service_user_oidc.sql  # optional: keyless CI/CD user (set the OIDC SUBJECT to your repo/env)
03_external_stage.sql      # optional: only if using external staging
04_compute_pool.sql        # required: DLT_POOL
05_load_warehouse.sql      # required: DLT_WH (set MIN=MAX=1 on Standard Edition)
06_pipeline_registry.sql   # required: OPS.PIPELINE_REGISTRY + @DEPLOY.SPECS + grants
```

Edition/region notes live in the file headers (Gen2 availability, multi-cluster needs
Enterprise+).

## Build and push the image

```bash
docker build -f deploy/spcs/Dockerfile -t dlt-pipeline:latest .
docker tag dlt-pipeline:latest \
  <org>-<account>.registry.snowflakecomputing.com/DLT_DB/DEPLOY/IMAGES/dlt-pipeline:latest
docker push \
  <org>-<account>.registry.snowflakecomputing.com/DLT_DB/DEPLOY/IMAGES/dlt-pipeline:latest
```

Rebuild only for code or dependency changes, not for pipeline additions.

## Deploy the pipelines

### Manual (Snowsight)

```bash
python -m pipelines.registry_sync --emit-sql --prune > sync.sql   # then run sync.sql
# upload the spec template once:
#   PUT file://deploy/spcs/dlt_job.tmpl.yaml @DLT_DB.DEPLOY.SPECS AUTO_COMPRESS=FALSE OVERWRITE=TRUE;
python -m deploy.tasks.generate_tasks > tasks.sql                 # then run tasks.sql
# Tasks are created SUSPENDED; resume when ready:
#   ALTER TASK dlt_task_pg_public RESUME;
```

### Automated (GitHub Actions + OIDC) via `deploy.yml`

Keyless: GitHub mints an OIDC token, Snowflake validates it against the `DLT_DEPLOYER`
service user's `WORKLOAD_IDENTITY`. The workflow syncs the registry, uploads the template,
and applies Tasks, all through `snow sql` (no connector credentials on the runner).

Required repo configuration:
- Secret: `SNOWFLAKE_ACCOUNT`
- Variables: `SNOWFLAKE_USER=DLT_DEPLOYER`, `SNOWFLAKE_ROLE=DLT_LOADER_ROLE`, `SNOWFLAKE_WAREHOUSE=DLT_WH`
- A GitHub environment named `deploy` (add required reviewers to gate it)
- In `02b_service_user_oidc.sql`, set `SUBJECT` to
  `repo:<owner>/<repo>:environment:deploy` (or your chosen trigger form)

## Adding a pipeline (no rebuild)

1. Add an entry to `pipelines/registry.yml` (name, source, schedule, config, `secret:` refs).
2. Sync it: `python -m pipelines.registry_sync` (or `--emit-sql` for CD).
3. Create its Task: `python -m deploy.tasks.generate_tasks`, run the new `CREATE TASK`, then
   `RESUME` it.
4. The running container reads the new config from the table. No image rebuild.

## Observability

- `OPS._DLT_RUNS` collects one row per run (status, load_id, row_counts, error) via
  `observability.record_run` (best-effort; never blocks the load).
- Logs are pipeline-tagged (`SnowflakeLogFormatter` in-Snowflake, plain formatter locally).
- SPCS container logs land in the account event table (`SNOWFLAKE.TELEMETRY.EVENTS`).
- Do NOT use `SYSTEM$GET_SERVICE_LOGS` for durable observability; query the event table.

## Suggested testing progression

1. `pytest tests/test_registry_config.py -q` (pure, always runnable).
2. `pip install -e ".[dev,postgres]"` then `pytest -q` (DuckDB smoke).
3. Local run to DuckDB against a real source you control:
   `DLT_DESTINATION=duckdb python -m pipelines.run <name>` (set `secret:` creds in `.dlt/secrets.toml`).
4. Apply `sql/01..06` to a dev Snowflake account.
5. `registry_sync --emit-sql` -> `snow sql -f`; confirm rows in `OPS.PIPELINE_REGISTRY`.
6. Build/push the image; run one pipeline as an SPCS job (`EXECUTE JOB SERVICE ... FROM @DEPLOY.SPECS ... USING (pipeline => '<name>')`).
7. Wire up `deploy.yml` (OIDC user + repo secret/vars + `deploy` environment).

## Verification status (as built)

Verified locally: `py_compile` of all `pipelines/` modules, `tests/test_registry_config.py`
(9 pass), `registry_sync --emit-sql`, `generate_tasks` output, dual-mode selection logic
(with `dlt` stubbed), docs `npm run build` clean.

Not yet exercised here (verify during testing):
- `pytest -q` DuckDB smoke and `run --list` require `dlt` installed (not present in the
  authoring environment).
- `sql/*.sql` compile/execute requires `DLT_DB` to exist (the template is not deployed to
  any account yet).
- `deploy.yml`'s `snow stage copy` step and the OIDC flow have not run against a live
  account; confirm the `snow` CLI version and stage-copy syntax on first use.

## Conventions

- Prefer OIDC over stored keys for CI. Pin the action to a SHA in production.
- Keep secrets out of `registry.yml` and the table (use `secret:` refs).
- Backends: `sqlalchemy` is general; `connectorx` is fastest but supports only certain
  dialects; `pyarrow`/`pandas` map types more cleanly to Snowflake. Pick per source.
- dlt is one-way EL (extract + load). Transformation is downstream (dbt / SQL / dynamic tables).
