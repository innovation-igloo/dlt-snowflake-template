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

To load to Snowflake from your laptop **without** filling in `.dlt/secrets.toml`, reuse an
existing `snow` CLI connection — its auth (password, key-pair, PAT, or `externalbrowser`)
is mapped to dlt env vars for that run only, so `connections.toml` stays the single source
of truth:

```bash
make run-sf NAME=pg_public                 # uses your default snow connection -> DLT_DEV_DB.DEV_<user>
make run-sf NAME=pg_public CONN=my-conn SF_DATABASE=DLT_PROD_DB DATASET=RAW
# inspect what it would export (eval to load into your own shell):
eval "$(make snow-env CONN=my-conn)"
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

The account is split into a shared **control plane** (`DLT_DB`: registry table, image
repo, spec stage) plus isolated data databases: **`DLT_DEV_DB`** (ad-hoc, per-developer
`DEV_<user>` schemas) and **`DLT_PROD_DB`** (scheduled loads into `RAW`). Dev and prod
get their own compute (`DLT_DEV_POOL`/`DLT_DEV_WH` vs `DLT_POOL`/`DLT_WH`) and roles
(`DLT_DEV_ROLE` vs `DLT_LOADER_ROLE`).

**Development is the primary path** — this template exists to get developers building
pipelines in an isolated Snowflake sandbox. Run the shared base once, then set up dev.
Production is a **separate, customer-tailored flow** you stand up later, once you know the
customer's scheduling, sizing, and governance needs.

```bash
# 1. Shared control plane (run once). Add CONFIRM=1 to actually apply.
make setup-base CONFIRM=1     # sql/base/*  -> roles, DLT_DB, registry, spec stage, image repo

# 2. Development (primary): ad-hoc runs -> DLT_DEV_DB.DEV_<user>
make setup-dev  CONFIRM=1     # sql/dev/*   -> DLT_DEV_DB, DLT_DEV_POOL, DLT_DEV_WH
#   then grant the dev role to developers: GRANT ROLE DLT_DEV_ROLE TO USER <login>;

# 3. Production (later, tailor sql/prod/* to the customer first): scheduled Tasks -> DLT_PROD_DB.RAW
make setup-prod CONFIRM=1     # sql/prod/01_prod_db, 02_compute, 03_service_user
#   optional, edit placeholders first: sql/prod/03b_service_user_oidc.sql (keyless CI/CD)
```

Or run the files under `sql/base`, `sql/dev`, `sql/prod` directly in Snowsight in
filename order.

Each script switches to the least-privilege admin role it needs (`USE ROLE`): roles and
users are created as `USERADMIN`, all databases/schemas/warehouses/pools/stages as
`SYSADMIN` (which then grants to the functional roles), and `ACCOUNTADMIN` is used only
for `EXECUTE TASK ON ACCOUNT` (`base/02`). Run setup as an operator who can assume all
three (e.g. connect as `ACCOUNTADMIN`, which inherits them).


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

## Develop in Snowflake

Rather than wiring source credentials into a local `.dlt/secrets.toml`, you can develop
entirely in Snowflake: an SPCS job runs the pipeline in a container and loads into your own
isolated `DLT_DEV_DB.DEV_<snowflake_user>` schema. The bundled `sample` pipeline is an
in-code generator, so it needs **no source secret** — the quickest proof the path works.

```bash
make setup-base CONFIRM=1     # once (shared control plane)
make setup-dev  CONFIRM=1     # once (DLT_DEV_DB + dev compute + DLT_DEV_ROLE)

# One-time prep for the container path:
make image-push               # build + push the image to DLT_DB.DEPLOY.IMAGES
make sync-apply               # sync registry -> DLT_DB.OPS.PIPELINE_REGISTRY (the container reads this)
make dev-spec-upload          # upload the dev spec templates to @DLT_DB.DEPLOY.SPECS
make dev-pool-status          # wait until DLT_DEV_POOL is ACTIVE/IDLE

# Smoke test — no source secret needed:
make dev-run NAME=sample      # SPCS -> DLT_DEV_DB.DEV_<snowflake_user>

# Real source — bind its credential from a Snowflake SECRET:
make dev-run NAME=github_issues \
  SECRET=DLT_DB.OPS.GITHUB_ISSUES_TOKEN \
  ENVVAR=SOURCES__GITHUB_ISSUES__TOKEN   # add EAI=<name> for external egress
```

How it chains together: for a real source the dev spec binds the Snowflake SECRET into the
container env var named by `ENVVAR`; `pipelines/run.py` resolves any `secret:<path>` in the
registry through `dlt.secrets`, which reads that env var. `DLT_DATASET` (defaulting to
`DEV_<snowflake_user>` from your connection) sends the load to your isolated schema. Clean
up when done: `DROP SCHEMA IF EXISTS DLT_DEV_DB.DEV_<user>;`.

> Note: the `CREATE SECRET` SQL and the optional External Access Integration (for external
> sources) are a follow-up step and are not yet in `sql/dev/`. `make dev-run` prints the
> exact secret/env-var wiring it expects.


---

## CI/CD (GitHub Actions + OIDC)

Two workflows ship in `.github/workflows/`:

- **`ci.yml`** — offline checks on every push/PR: lint, import/compile, `run --list`, and the DuckDB smoke + unit tests. No Snowflake connection.
- **`deploy.yml`** — the repeatable deploy. **Manual only** (run it from the Actions tab / `workflow_dispatch`) so it never fails before Snowflake auth is configured. Gated to the `deploy` GitHub environment, it authenticates with a **GitHub OIDC token** (no stored keys) via the official [`snowflakedb/snowflake-actions`](https://github.com/snowflakedb/snowflake-actions) action, then:
  1. `snow connection test -x`
  2. `registry_sync --emit-sql --prune` → `snow sql -f` (syncs `registry.yml` into `OPS.PIPELINE_REGISTRY`)
  3. uploads `dlt_job.tmpl.yaml` to `@DLT_DB.DEPLOY.SPECS`
  4. `generate_tasks` → `snow sql -f` (creates/updates the per-pipeline Tasks)

Because the sync and task generation emit plain SQL, the whole deploy runs on the OIDC `snow` auth alone — the runner needs **no Python-connector credentials**.

**Setup:**

1. Run `sql/prod/03b_service_user_oidc.sql` to create the keyless `DLT_DEPLOYER` service user. Set its `WORKLOAD_IDENTITY` subject to match your repo/environment (e.g. `repo:<owner>/<repo>:environment:deploy`).
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
