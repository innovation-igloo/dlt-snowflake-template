-- =============================================================================
-- 02_service_user.sql
-- Purpose : Create the DLT_LOADER service account and configure key-pair
--           authentication for connector / local-dev use.
-- Run as  : ACCOUNTADMIN (or SECURITYADMIN for the USER DDL).
-- Prerequisites : 01_account_setup.sql must have been run (role + warehouse
--                 references must already exist).
-- =============================================================================

USE ROLE ACCOUNTADMIN;

-- ---------------------------------------------------------------------------
-- 1. Service user
-- ---------------------------------------------------------------------------
CREATE USER IF NOT EXISTS DLT_LOADER
    DEFAULT_ROLE      = DLT_LOADER_ROLE
    DEFAULT_WAREHOUSE = DLT_WH
    DEFAULT_NAMESPACE = DLT_DB.RAW
    COMMENT           = 'Service account for dlt pipeline runs.';

GRANT ROLE DLT_LOADER_ROLE TO USER DLT_LOADER;

-- ---------------------------------------------------------------------------
-- 2. Key-pair authentication  (for connector / local-dev runs)
-- ---------------------------------------------------------------------------
-- Generate a 2048-bit RSA key pair locally:
--
--   openssl genrsa 2048 | openssl pkcs8 -topk8 -nocrypt -out rsa_key.p8
--   openssl rsa -in rsa_key.p8 -pubout -out rsa_key.pub
--
-- Then strip the PEM header/footer from rsa_key.pub and paste the base64
-- body (no line breaks) into the statement below.
--
-- Store rsa_key.p8 securely (e.g. Vault, AWS Secrets Manager) and reference
-- it via the PRIVATE_KEY_PATH / PRIVATE_KEY env vars in your dlt profile.
--
-- ALTER USER DLT_LOADER SET RSA_PUBLIC_KEY = '<paste base64 key body here>';

-- ---------------------------------------------------------------------------
-- 3. In-SPCS / container runs — no key needed
-- ---------------------------------------------------------------------------
-- When dlt runs inside a Snowpark Container Services (SPCS) job, Snowflake
-- injects an OAuth session token automatically via the SNOWFLAKE_TOKEN
-- environment variable.  Set AUTHENTICATOR=oauth in your dlt Snowflake
-- connector config to use it; no RSA key pair is required in that scenario.
