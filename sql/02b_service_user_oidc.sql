-- =============================================================================
-- 02b_service_user_oidc.sql
-- Purpose : Create a keyless service account for CI/CD that authenticates with
--           GitHub Actions OIDC (workload identity federation). Recommended over
--           key-pair (02_service_user.sql): no secret is stored anywhere -- GitHub
--           mints a short-lived OIDC token that Snowflake validates directly.
-- Run as  : ACCOUNTADMIN (or SECURITYADMIN for the USER DDL).
-- Prerequisites : 01_account_setup.sql (DLT_LOADER_ROLE + DLT_WH must exist).
-- Requires : Snowflake CLI 3.11+ in the workflow (snowflakedb/snowflake-actions@v3).
--
-- Pairs with .github/workflows/deploy.yml, which uses:
--   - uses: snowflakedb/snowflake-actions@v3
--     with: { use-oidc: true }
-- =============================================================================

USE ROLE ACCOUNTADMIN;

-- ---------------------------------------------------------------------------
-- 1. Keyless service user (workload identity = GitHub OIDC)
-- ---------------------------------------------------------------------------
-- SUBJECT must match the claim GitHub emits for your workflow. Pick the format
-- that matches how the deploy job is triggered (see the table below), and
-- replace <owner>/<repo> (and the branch or environment name) accordingly.
--
--   repo:<owner>/<repo>:ref:refs/heads/main       -> push to main (no job environment)
--   repo:<owner>/<repo>:pull_request              -> any pull_request event
--   repo:<owner>/<repo>:environment:<name>        -> job sets `environment: <name>`
--
-- deploy.yml targets a GitHub environment (recommended: required reviewers), so
-- the environment: subject form is the default below.
CREATE USER IF NOT EXISTS DLT_DEPLOYER
    TYPE              = SERVICE
    DEFAULT_ROLE      = DLT_LOADER_ROLE
    DEFAULT_WAREHOUSE = DLT_WH
    DEFAULT_NAMESPACE = DLT_DB.RAW
    WORKLOAD_IDENTITY = (
        TYPE    = OIDC
        ISSUER  = 'https://token.actions.githubusercontent.com'
        SUBJECT = 'repo:<owner>/<repo>:environment:deploy'
    )
    COMMENT = 'Keyless CI/CD deployer for dlt (GitHub Actions OIDC).';

GRANT ROLE DLT_LOADER_ROLE TO USER DLT_DEPLOYER;

-- ---------------------------------------------------------------------------
-- 2. Privileges the deployer needs beyond DLT_LOADER_ROLE's data grants
-- ---------------------------------------------------------------------------
-- Applying bootstrap DDL and creating Tasks requires schema-level CREATE and the
-- task-execution privilege. Grant these to DLT_LOADER_ROLE (or a dedicated deploy
-- role) so the OIDC user can run the full deploy.yml pipeline.
GRANT USAGE ON DATABASE DLT_DB TO ROLE DLT_LOADER_ROLE;
GRANT USAGE ON SCHEMA DLT_DB.OPS TO ROLE DLT_LOADER_ROLE;
GRANT CREATE TASK ON SCHEMA DLT_DB.OPS TO ROLE DLT_LOADER_ROLE;
GRANT EXECUTE TASK ON ACCOUNT TO ROLE DLT_LOADER_ROLE;
-- INSERT/UPDATE/DELETE on the registry table are granted in 06_pipeline_registry.sql.

-- ---------------------------------------------------------------------------
-- 3. Verify
-- ---------------------------------------------------------------------------
-- After the first workflow run, confirm the login used workload identity:
--   SELECT * FROM SNOWFLAKE.ACCOUNT_USAGE.LOGIN_HISTORY
--     WHERE USER_NAME = 'DLT_DEPLOYER' ORDER BY EVENT_TIMESTAMP DESC LIMIT 10;
