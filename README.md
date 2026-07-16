# dlt-snowflake-template

Registry-driven [dlt](https://dlthub.com) → Snowflake template. Define every pipeline once in
`pipelines/registry.yml`; the runner, SPCS task generator, and observability layer all read from
that single source of truth.

**What you get**

- Multiple pipelines (SQL Database, REST API, …) sharing one SPCS compute pool (`DLT_POOL`)
  and one Gen2 multi-cluster warehouse (`DLT_WH`).
- Structured logs via `snowflake.telemetry` — every run is visible in your Snowflake event table.
- A control table (`DLT_DB.OPS._DLT_RUNS`) for run-level observability without external tooling.
- Full docs under `docs/development-gameplan/`.

---

## Quick-start

### 1 — Install

```bash
# dev + Postgres extras; add mssql/mysql/oracle as needed
pip install -e ".[dev,postgres]"
```

### 2 — Configure

Copy the secrets example and fill in real values:

```bash
cp .dlt/secrets.toml.example .dlt/secrets.toml
$EDITOR .dlt/secrets.toml
```

Review `pipelines/registry.yml` — it already ships with two pipelines (`pg_public`, `github_issues`).
Add or edit pipeline entries there; do **not** hard-code credentials in the registry (use the
`secret:` prefix to reference a `secrets.toml` path instead).

Non-secret defaults (log level, SQL backend) live in `.dlt/config.toml`.

### 3 — Run locally

List all registered pipelines:

```bash
python -m pipelines.run --list
```

Dry-run against DuckDB (no Snowflake credentials needed):

```bash
DLT_DESTINATION=duckdb python -m pipelines.run pg_public
```

Run a single pipeline to Snowflake:

```bash
python -m pipelines.run pg_public
```

Run all pipelines:

```bash
python -m pipelines.run --all
```

Override log level for a single run:

```bash
LOG_LEVEL=DEBUG python -m pipelines.run github_issues
```

---

## Deploy to SPCS (7-phase)

### Phase 1-5 — Snowflake infrastructure

Run the SQL scripts in order:

```bash
# In Snowsight or SnowSQL, execute in order:
# sql/01_account_setup.sql     # roles, database, schemas (RAW/OPS/DEPLOY), image repo
# sql/02_service_user.sql      # DLT_LOADER + RSA key (external key-pair auth)
# sql/02b_service_user_oidc.sql # optional: keyless DLT_DEPLOYER for CI/CD (GitHub OIDC)
# sql/03_external_stage.sql    # optional: external staging
# sql/04_compute_pool.sql      # DLT_POOL
# sql/05_load_warehouse.sql    # DLT_WH (Gen2 multi-cluster)
# sql/06_pipeline_registry.sql # OPS.PIPELINE_REGISTRY table + @DEPLOY.SPECS stage
```

### Phase 6 — Build and push the image

```bash
docker build -f deploy/spcs/Dockerfile -t dlt-pipeline:latest .
docker tag dlt-pipeline:latest \
  <orgname>-<account>.registry.snowflakecomputing.com/DLT_DB/DEPLOY/IMAGES/dlt-pipeline:latest
docker push \
  <orgname>-<account>.registry.snowflakecomputing.com/DLT_DB/DEPLOY/IMAGES/dlt-pipeline:latest
```

### Phase 7 — Generate and activate tasks

```bash
python -m deploy.tasks.generate_tasks > 07_tasks.sql   # renders SQL from pipelines/registry.yml
# Review 07_tasks.sql, then run it in Snowsight.
```

Each pipeline gets its own Task; resume them in Snowsight:

```sql
ALTER TASK dlt_task_pg_public     RESUME;
ALTER TASK dlt_task_github_issues RESUME;
```

---

## CI/CD (GitHub Actions + OIDC)

Two workflows ship in `.github/workflows/`:

- **`ci.yml`** — offline checks on every push/PR: lint, import/compile, `run --list`, and the DuckDB smoke + unit tests. No Snowflake connection.
- **`deploy.yml`** — the repeatable deploy, gated to the `deploy` GitHub environment. It authenticates with a **GitHub OIDC token** (no stored keys) via the official [`snowflakedb/snowflake-actions`](https://github.com/snowflakedb/snowflake-actions) action, then:
  1. `snow connection test -x`
  2. `registry_sync --emit-sql --prune` → `snow sql -f` (syncs `registry.yml` into `OPS.PIPELINE_REGISTRY`)
  3. uploads `dlt_job.tmpl.yaml` to `@DLT_DB.DEPLOY.SPECS`
  4. `generate_tasks` → `snow sql -f` (creates/updates the per-pipeline Tasks)

Because the sync and task generation emit plain SQL, the whole deploy runs on the OIDC `snow` auth alone — the runner needs **no Python-connector credentials**.

**Setup:**

1. Run `sql/02b_service_user_oidc.sql` to create the keyless `DLT_DEPLOYER` service user. Set its `WORKLOAD_IDENTITY` subject to match your repo/environment (e.g. `repo:<owner>/<repo>:environment:deploy`).
2. In repo settings, add secret `SNOWFLAKE_ACCOUNT` and variables `SNOWFLAKE_USER` (`DLT_DEPLOYER`), `SNOWFLAKE_ROLE` (`DLT_LOADER_ROLE`), `SNOWFLAKE_WAREHOUSE` (`DLT_WH`).
3. Create a `deploy` environment (add required reviewers to gate production).

Preview the sync SQL locally without a connection:

```bash
python -m pipelines.registry_sync --emit-sql --prune
```

---

## Project layout

```
.
├── pipelines/
│   ├── registry.yml      # single source of truth for all pipelines
│   ├── run.py            # generic runner: python -m pipelines.run <name>
│   ├── models.py         # registry loader + validation
│   └── observability.py  # structured logs + OPS._DLT_RUNS collector
├── sources/              # optional custom source modules
├── sql/                  # 01-05 Snowflake bootstrap DDL
├── deploy/
│   ├── spcs/             # Dockerfile, job.yaml, service.yaml
│   └── tasks/            # generate_tasks.py (one CREATE TASK per pipeline)
├── tests/                # DuckDB smoke test (no Snowflake needed)
├── docs/development-gameplan/   # this gameplan site
├── .dlt/
│   ├── config.toml       # non-secret defaults (committed)
│   └── secrets.toml.example  # template (committed); copy → secrets.toml
├── .github/workflows/ci.yml
└── pyproject.toml
```

---

## Further reading

See `docs/development-gameplan/` for architecture decisions, schema conventions, and the full
SPCS deployment guide.
