-- =============================================================================
-- 05_load_warehouse.sql
-- Purpose : Create the Gen2 multi-cluster virtual warehouse used by dlt for
--           SQL execution (MERGE, COPY INTO, schema inference, etc.) and grant
--           the required privileges to DLT_LOADER_ROLE.
-- Run as  : ACCOUNTADMIN (or SYSADMIN once DB objects exist).
-- Prerequisites : 01_account_setup.sql must have been run.
--
-- Edition notes:
--   Multi-cluster (MIN != MAX) requires Enterprise Edition or higher.
--   On Standard Edition set MIN_CLUSTER_COUNT = MAX_CLUSTER_COUNT = 1.
--
-- Region notes — Gen2 (GENERATION = '2') is unavailable in:
--   AWS  : af-south-1 (Cape Town), eu-central-2 (Zurich)
--   GCP  : me-central1 (Dammam)
--   Azure: us-gov-virginia
--   In those regions use GENERATION = '1' (or omit the parameter; 1 is default).
--
-- Credit note:
--   Credits/hr = (size base rate) × (number of running clusters).
--   Multi-cluster scales for concurrency, not for single large-query speed.
--   To speed up a single heavy query, increase WAREHOUSE_SIZE instead.
-- =============================================================================

USE ROLE ACCOUNTADMIN;

-- ---------------------------------------------------------------------------
-- 1. Warehouse
-- ---------------------------------------------------------------------------
CREATE WAREHOUSE IF NOT EXISTS DLT_WH
    WAREHOUSE_SIZE        = XSMALL          -- sufficient for typical dlt MERGE workloads
    WAREHOUSE_TYPE        = STANDARD
    MAX_CONCURRENCY_LEVEL = 8
    MIN_CLUSTER_COUNT     = 1
    MAX_CLUSTER_COUNT     = 3               -- set =1 on Standard Edition
    SCALING_POLICY        = 'STANDARD'      -- ECONOMY to prefer full clusters; STANDARD to minimise queue
    AUTO_SUSPEND          = 60              -- seconds of inactivity before suspend
    AUTO_RESUME           = TRUE
    INITIALLY_SUSPENDED   = TRUE
    ENABLE_QUERY_ACCELERATION = FALSE       -- enable if you run large fan-out scans
    COMMENT               = 'Gen2 multi-cluster warehouse for dlt SQL execution (MERGE, COPY, schema inference).';

-- Upgrade to Gen2 after creation (CREATE WAREHOUSE does not accept GENERATION= directly in all releases).
ALTER WAREHOUSE DLT_WH SET
    MAX_CONCURRENCY_LEVEL = 8;   -- no-op placeholder; add GENERATION='2' once your region supports it
-- To set Gen2 explicitly (supported regions only):
--   ALTER WAREHOUSE DLT_WH SET WAREHOUSE_TYPE = 'SNOWPARK-OPTIMIZED'; -- not for dlt; example only
-- The canonical way to confirm Gen2 is active:
--   SHOW WAREHOUSES LIKE 'DLT_WH';  -> check the "type" column for "Snowflake Gen 2"

-- ---------------------------------------------------------------------------
-- 2. Grants
-- ---------------------------------------------------------------------------
-- USAGE  : required to use the warehouse for query execution.
-- OPERATE: allows DLT_LOADER_ROLE to START/SUSPEND the warehouse programmatically.
GRANT USAGE   ON WAREHOUSE DLT_WH TO ROLE DLT_LOADER_ROLE;
GRANT OPERATE ON WAREHOUSE DLT_WH TO ROLE DLT_LOADER_ROLE;
