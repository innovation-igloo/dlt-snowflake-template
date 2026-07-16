-- =============================================================================
-- 04_compute_pool.sql
-- Purpose : Create the SPCS compute pool used to run dlt pipeline jobs as
--           Snowpark Container Services job services, and grant the necessary
--           privileges to DLT_LOADER_ROLE.
-- Run as  : ACCOUNTADMIN.
-- Prerequisites : 01_account_setup.sql must have been run.
-- Cost note: CPU_X64_S = 0.11 credits/hr per node.  SPCS bills in 1-minute
--            increments with a 5-minute minimum per job run.  MAX_NODES=3
--            caps concurrent jobs; adjust to your concurrency needs.
-- =============================================================================

USE ROLE ACCOUNTADMIN;

-- ---------------------------------------------------------------------------
-- 1. Compute pool
-- ---------------------------------------------------------------------------
CREATE COMPUTE POOL IF NOT EXISTS DLT_POOL
    MIN_NODES          = 1
    MAX_NODES          = 3
    INSTANCE_FAMILY    = CPU_X64_S
    AUTO_SUSPEND_SECS  = 300       -- idle for 5 min before suspending
    AUTO_RESUME        = TRUE      -- resumes automatically on new job submission
    COMMENT            = 'SPCS compute pool for dlt pipeline job services. CPU_X64_S (2 vCPU / 8 GiB). 0.11 cr/hr/node, 5-min billing minimum.';

-- ---------------------------------------------------------------------------
-- 2. Pool grants
-- ---------------------------------------------------------------------------
-- USAGE  : required to submit job services to this pool.
-- MONITOR: allows DLT_LOADER_ROLE to inspect pool status and node metrics.
GRANT USAGE   ON COMPUTE POOL DLT_POOL TO ROLE DLT_LOADER_ROLE;
GRANT MONITOR ON COMPUTE POOL DLT_POOL TO ROLE DLT_LOADER_ROLE;

-- ---------------------------------------------------------------------------
-- 3. Service creation grant
-- ---------------------------------------------------------------------------
-- Allows DLT_LOADER_ROLE to CREATE SERVICE (job service) objects inside the
-- DEPLOY schema where the image repository lives.  BIND SERVICE ENDPOINT is
-- not required for job services (no public endpoint needed); include it only
-- if you add a long-running service with an HTTP endpoint later.
GRANT CREATE SERVICE ON SCHEMA DLT_DB.DEPLOY TO ROLE DLT_LOADER_ROLE;
