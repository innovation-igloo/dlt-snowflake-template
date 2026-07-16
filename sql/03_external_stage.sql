-- =============================================================================
-- 03_external_stage.sql
-- Purpose : OPTIONAL — create an S3-backed external stage for dlt when you
--           want to land files outside Snowflake before loading.
--           Skip this file entirely if you are using dlt's default internal
--           staging (most common setup).
-- Run as  : ACCOUNTADMIN (storage integration requires account-level DDL).
-- Prerequisites : 01_account_setup.sql must have been run.
-- =============================================================================

-- Replace every <PLACEHOLDER> value before running.

USE ROLE ACCOUNTADMIN;

-- ---------------------------------------------------------------------------
-- 1. Storage integration  (AWS S3 example)
-- ---------------------------------------------------------------------------
-- After creation, run:
--   DESC INTEGRATION DLT_S3_INTEGRATION;
-- Copy the STORAGE_AWS_IAM_USER_ARN and STORAGE_AWS_EXTERNAL_ID values and
-- add them to your S3 bucket trust policy so Snowflake can assume the role.

CREATE STORAGE INTEGRATION IF NOT EXISTS DLT_S3_INTEGRATION
    TYPE                      = EXTERNAL_STAGE
    STORAGE_PROVIDER          = 'S3'
    ENABLED                   = TRUE
    STORAGE_AWS_ROLE_ARN      = 'arn:aws:iam::<ACCOUNT_ID>:role/<ROLE_NAME>'
    STORAGE_ALLOWED_LOCATIONS = ('s3://<BUCKET_NAME>/<PREFIX>/')
    COMMENT                   = 'Allows Snowflake to read/write the dlt landing bucket.';

-- ---------------------------------------------------------------------------
-- 2. External stage
-- ---------------------------------------------------------------------------
CREATE STAGE IF NOT EXISTS DLT_DB.RAW.EXT_STAGE
    STORAGE_INTEGRATION = DLT_S3_INTEGRATION
    URL                 = 's3://<BUCKET_NAME>/<PREFIX>/'
    FILE_FORMAT         = (TYPE = 'PARQUET')   -- adjust to your dlt file format
    COMMENT             = 'External stage for dlt-managed pipeline files.';

-- ---------------------------------------------------------------------------
-- 3. Grants
-- ---------------------------------------------------------------------------
GRANT USAGE ON INTEGRATION DLT_S3_INTEGRATION TO ROLE DLT_LOADER_ROLE;
GRANT READ, WRITE ON STAGE DLT_DB.RAW.EXT_STAGE TO ROLE DLT_LOADER_ROLE;
