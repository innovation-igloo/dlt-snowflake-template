-- =============================================================================
-- prod/03b_service_user_oidc.sql
-- Purpose : Create a keyless CI/CD service account that authenticates with
--           GitHub Actions OIDC (workload identity federation). Recommended over
--           key-pair (prod/03_service_user.sql): no secret is stored anywhere --
--           GitHub mints a short-lived OIDC token that Snowflake validates.
-- Run as  : USERADMIN (least-privilege admin for users; owns DLT_LOADER_ROLE).
-- Prerequisites : base/01_roles.sql, base/02_control_plane.sql, prod/01_prod_db.sql,
--                 prod/02_compute.sql. (The deploy privileges CREATE TASK / EXECUTE
--                 TASK / registry DML are already granted to DLT_LOADER_ROLE in
--                 base/02 and base/03.)
--
-- Pairs with .github/workflows/deploy.yml (snowflakedb/snowflake-actions@v3, use-oidc: true).
-- =============================================================================

USE ROLE USERADMIN;

-- ---------------------------------------------------------------------------
-- Keyless service user (workload identity = GitHub OIDC)
-- ---------------------------------------------------------------------------
-- SUBJECT must match the claim GitHub emits for your workflow. Pick the format
-- that matches how the deploy job is triggered, and replace <owner>/<repo>:
--
--   repo:<owner>/<repo>:ref:refs/heads/main       -> push to main (no environment)
--   repo:<owner>/<repo>:pull_request              -> any pull_request event
--   repo:<owner>/<repo>:environment:<name>        -> job sets `environment: <name>`
--
-- deploy.yml targets a GitHub environment (recommended: required reviewers), so
-- the environment: form is the default below.
CREATE USER IF NOT EXISTS DLT_DEPLOYER
    TYPE              = SERVICE
    DEFAULT_ROLE      = DLT_LOADER_ROLE
    DEFAULT_WAREHOUSE = DLT_WH
    DEFAULT_NAMESPACE = DLT_PROD_DB.RAW
    WORKLOAD_IDENTITY = (
        TYPE    = OIDC
        ISSUER  = 'https://token.actions.githubusercontent.com'
        SUBJECT = 'repo:<owner>/<repo>:environment:deploy'
    )
    COMMENT = 'Keyless CI/CD deployer for dlt (GitHub Actions OIDC).';

GRANT ROLE DLT_LOADER_ROLE TO USER DLT_DEPLOYER;

-- ---------------------------------------------------------------------------
-- Verify
-- ---------------------------------------------------------------------------
-- After the first workflow run, confirm the login used workload identity:
--   SELECT * FROM SNOWFLAKE.ACCOUNT_USAGE.LOGIN_HISTORY
--     WHERE USER_NAME = 'DLT_DEPLOYER' ORDER BY EVENT_TIMESTAMP DESC LIMIT 10;
