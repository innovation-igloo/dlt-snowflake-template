-- =============================================================================
-- 01_account_setup.sql
-- Purpose : Bootstrap RBAC, database/schema objects, and the SPCS image
--           repository required by the dlt->Snowflake template.
-- Run as  : ACCOUNTADMIN (account-level DDL).  Role/grant statements alone
--           could be scoped to SECURITYADMIN; DB/schema objects to SYSADMIN.
-- Prerequisites : None — this is the first script in the sequence.
-- =============================================================================

USE ROLE ACCOUNTADMIN;

-- ---------------------------------------------------------------------------
-- 1. Functional role
-- ---------------------------------------------------------------------------
CREATE ROLE IF NOT EXISTS DLT_LOADER_ROLE
    COMMENT = 'Functional role for dlt pipeline: loading, observability, SPCS.';

-- Allow SYSADMIN to administer objects owned by this role.
GRANT ROLE DLT_LOADER_ROLE TO ROLE SYSADMIN;

-- ---------------------------------------------------------------------------
-- 2. Database and schemas
-- ---------------------------------------------------------------------------
CREATE DATABASE IF NOT EXISTS DLT_DB
    COMMENT = 'Root database for dlt pipelines.';

-- RAW  : pipeline-managed landing tables and dlt state tables (_dlt_*)
CREATE SCHEMA IF NOT EXISTS DLT_DB.RAW
    COMMENT = 'Raw / landing layer written by dlt.';

-- OPS  : operational control tables incl. _DLT_RUNS and pipeline metadata
CREATE SCHEMA IF NOT EXISTS DLT_DB.OPS
    COMMENT = 'Pipeline operational metadata and _DLT_RUNS table.';

-- DEPLOY : SPCS image repository and future deployment artefacts
CREATE SCHEMA IF NOT EXISTS DLT_DB.DEPLOY
    COMMENT = 'Deployment artefacts: SPCS image repository.';

-- ---------------------------------------------------------------------------
-- 3. SPCS image repository
-- ---------------------------------------------------------------------------
CREATE IMAGE REPOSITORY IF NOT EXISTS DLT_DB.DEPLOY.IMAGES
    COMMENT = 'Stores dlt container images for SPCS job runs.';

-- ---------------------------------------------------------------------------
-- 4. Grants to DLT_LOADER_ROLE  (least-privilege)
-- ---------------------------------------------------------------------------

-- Database visibility
GRANT USAGE ON DATABASE DLT_DB TO ROLE DLT_LOADER_ROLE;

-- Schema-level usage
GRANT USAGE ON SCHEMA DLT_DB.RAW    TO ROLE DLT_LOADER_ROLE;
GRANT USAGE ON SCHEMA DLT_DB.OPS    TO ROLE DLT_LOADER_ROLE;
GRANT USAGE ON SCHEMA DLT_DB.DEPLOY TO ROLE DLT_LOADER_ROLE;

-- RAW: dlt creates tables (data) and stages (_dlt_load files)
GRANT CREATE TABLE  ON SCHEMA DLT_DB.RAW TO ROLE DLT_LOADER_ROLE;
GRANT CREATE VIEW   ON SCHEMA DLT_DB.RAW TO ROLE DLT_LOADER_ROLE;
GRANT CREATE STAGE  ON SCHEMA DLT_DB.RAW TO ROLE DLT_LOADER_ROLE;

-- OPS: dlt creates _DLT_RUNS and pipeline control tables
GRANT CREATE TABLE  ON SCHEMA DLT_DB.OPS TO ROLE DLT_LOADER_ROLE;
GRANT CREATE VIEW   ON SCHEMA DLT_DB.OPS TO ROLE DLT_LOADER_ROLE;
GRANT CREATE STAGE  ON SCHEMA DLT_DB.OPS TO ROLE DLT_LOADER_ROLE;

-- DEPLOY: push/pull container images; CREATE SERVICE granted in 04_compute_pool.sql
GRANT READ  ON IMAGE REPOSITORY DLT_DB.DEPLOY.IMAGES TO ROLE DLT_LOADER_ROLE;
GRANT WRITE ON IMAGE REPOSITORY DLT_DB.DEPLOY.IMAGES TO ROLE DLT_LOADER_ROLE;

-- NOTE: GRANT USAGE ON COMPUTE POOL and GRANT CREATE SERVICE ON SCHEMA
--       DLT_DB.DEPLOY are handled in 04_compute_pool.sql after the pool exists.
-- NOTE: GRANT USAGE, OPERATE ON WAREHOUSE DLT_WH is handled in
--       05_load_warehouse.sql after the warehouse exists.
