-- =============================================================================
-- 06_pipeline_registry.sql
-- Purpose : Create the control-plane objects for dynamic, config-as-data
--           pipelines:
--             1. DLT_DB.OPS.PIPELINE_REGISTRY  -- one row per pipeline
--             2. @DLT_DB.DEPLOY.SPECS          -- internal stage holding the
--                                                 SPCS job spec template
--           With these in place, adding a pipeline is an INSERT (via
--           `python -m pipelines.registry_sync`), not an image rebuild.
-- Run as  : ACCOUNTADMIN (or SYSADMIN once DB objects exist).
-- Prerequisites : 01_account_setup.sql (creates DLT_DB, OPS + DEPLOY schemas,
--                 DLT_LOADER_ROLE).
-- =============================================================================

USE ROLE ACCOUNTADMIN;

-- ---------------------------------------------------------------------------
-- 1. Control table
-- ---------------------------------------------------------------------------
-- Human source of truth is pipelines/registry.yml in git; registry_sync MERGEs
-- it into this table. The runner (pipelines/run.py) reads this table at
-- execution time when DLT_REGISTRY_SOURCE resolves to "table" (default in SPCS).
--
-- Column notes:
--   config           VARIANT  -- source-specific config (the YAML `config` block)
--   enabled          BOOLEAN  -- FALSE to pause a pipeline without deleting it;
--                                registry_sync sets TRUE only on first insert and
--                                never flips a manual disable back on.
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
-- Holds deploy/spcs/dlt_job.tmpl.yaml. The generated Tasks run:
--   EXECUTE JOB SERVICE ... FROM @DLT_DB.DEPLOY.SPECS
--       SPECIFICATION_TEMPLATE_FILE = 'dlt_job.tmpl.yaml'
--       USING (pipeline => '<name>')
-- Upload the template with:
--   PUT file://deploy/spcs/dlt_job.tmpl.yaml @DLT_DB.DEPLOY.SPECS
--       AUTO_COMPRESS = FALSE OVERWRITE = TRUE;
CREATE STAGE IF NOT EXISTS DLT_DB.DEPLOY.SPECS
    DIRECTORY   = (ENABLE = TRUE)
    COMMENT     = 'Holds the SPCS job spec template used by the per-pipeline Tasks.';

-- ---------------------------------------------------------------------------
-- 3. Grants
-- ---------------------------------------------------------------------------
-- Runtime read: the container SELECTs its spec from the table.
GRANT SELECT ON TABLE DLT_DB.OPS.PIPELINE_REGISTRY TO ROLE DLT_LOADER_ROLE;
-- registry_sync (run as DLT_LOADER_ROLE from laptop/CI) needs full DML.
GRANT INSERT, UPDATE, DELETE ON TABLE DLT_DB.OPS.PIPELINE_REGISTRY TO ROLE DLT_LOADER_ROLE;
-- EXECUTE JOB SERVICE reads the template file from the stage.
GRANT READ ON STAGE DLT_DB.DEPLOY.SPECS TO ROLE DLT_LOADER_ROLE;
-- Allow uploading a new template version (PUT) from the deploy role.
GRANT WRITE ON STAGE DLT_DB.DEPLOY.SPECS TO ROLE DLT_LOADER_ROLE;
