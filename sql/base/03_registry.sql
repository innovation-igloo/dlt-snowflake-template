-- =============================================================================
-- base/03_registry.sql
-- Purpose : Create the control-plane objects that make pipelines config-as-data:
--             1. DLT_DB.OPS.PIPELINE_REGISTRY  -- one row per pipeline
--             2. @DLT_DB.DEPLOY.SPECS          -- stage holding SPCS job spec
--                                                 templates (prod + dev)
--           With these in place, adding a pipeline is an INSERT (via
--           `python -m pipelines.registry_sync`), not an image rebuild.
-- Run as  : SYSADMIN (owns DLT_DB; creates the table + stage and grants on them).
-- Prerequisites : base/01_roles.sql, base/02_control_plane.sql.
-- =============================================================================

USE ROLE SYSADMIN;

-- ---------------------------------------------------------------------------
-- 1. Control table
-- ---------------------------------------------------------------------------
-- Human source of truth is pipelines/registry.yml in git; registry_sync MERGEs
-- it into this table. The runner (pipelines/run.py) reads this table at
-- execution time when DLT_REGISTRY_SOURCE resolves to "table" (default in SPCS).
-- Read by BOTH prod and dev jobs via the fully-qualified name below, regardless
-- of which data database (DLT_PROD_DB / DLT_DEV_DB) the job loads into.
--
-- Column notes:
--   config           VARIANT  -- source-specific config (the YAML `config` block)
--   dataset_name     STRING   -- prod default schema (RAW); dev overrides via the
--                                DLT_DATASET env var to a per-developer schema.
--   enabled          BOOLEAN  -- FALSE to pause a pipeline without deleting it.
--   pipeline_group   STRING   -- optional grouping for `run.py --group G`
CREATE TABLE IF NOT EXISTS DLT_DB.OPS.PIPELINE_REGISTRY (
    name              STRING            NOT NULL,
    source            STRING            NOT NULL,
    schedule          STRING,
    dataset_name      STRING            DEFAULT 'RAW',
    write_disposition STRING            DEFAULT 'merge',
    pipeline_group    STRING,
    config            VARIANT,
    enabled           BOOLEAN           DEFAULT TRUE,
    updated_at        TIMESTAMP_NTZ     DEFAULT CURRENT_TIMESTAMP(),
    CONSTRAINT pk_pipeline_registry PRIMARY KEY (name)
)
COMMENT = 'Control-plane registry of dlt pipelines. Synced from pipelines/registry.yml.';

-- ---------------------------------------------------------------------------
-- 2. Spec-template stage
-- ---------------------------------------------------------------------------
-- Holds the SPCS job spec templates:
--   deploy/spcs/dlt_job.tmpl.yaml       -- prod (scheduled Tasks, writes DLT_PROD_DB)
--   deploy/spcs/dlt_dev_job.tmpl.yaml   -- dev  (ad-hoc, writes DLT_DEV_DB, binds a secret)
-- Upload with (see Makefile `dev-spec-upload` / deploy docs):
--   PUT file://deploy/spcs/dlt_job.tmpl.yaml     @DLT_DB.DEPLOY.SPECS AUTO_COMPRESS=FALSE OVERWRITE=TRUE;
--   PUT file://deploy/spcs/dlt_dev_job.tmpl.yaml @DLT_DB.DEPLOY.SPECS AUTO_COMPRESS=FALSE OVERWRITE=TRUE;
CREATE STAGE IF NOT EXISTS DLT_DB.DEPLOY.SPECS
    DIRECTORY   = (ENABLE = TRUE)
    COMMENT     = 'Holds the SPCS job spec templates used by prod Tasks and dev runs.';

-- ---------------------------------------------------------------------------
-- 3. Grants
-- ---------------------------------------------------------------------------
-- Runtime read: both prod and dev containers SELECT their spec from the table.
GRANT SELECT ON TABLE DLT_DB.OPS.PIPELINE_REGISTRY TO ROLE DLT_LOADER_ROLE;
GRANT SELECT ON TABLE DLT_DB.OPS.PIPELINE_REGISTRY TO ROLE DLT_DEV_ROLE;
-- registry_sync (run as DLT_LOADER_ROLE from laptop/CI) needs full DML.
GRANT INSERT, UPDATE, DELETE ON TABLE DLT_DB.OPS.PIPELINE_REGISTRY TO ROLE DLT_LOADER_ROLE;

-- EXECUTE JOB SERVICE reads the template file from the stage (both roles).
GRANT READ ON STAGE DLT_DB.DEPLOY.SPECS TO ROLE DLT_LOADER_ROLE;
GRANT READ ON STAGE DLT_DB.DEPLOY.SPECS TO ROLE DLT_DEV_ROLE;
-- Uploading a new template version (PUT) is a deploy-role action.
GRANT WRITE ON STAGE DLT_DB.DEPLOY.SPECS TO ROLE DLT_LOADER_ROLE;
