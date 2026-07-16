/**
 * Support tier for a dialect:
 * - 'Verified'          dlt ships dialect-specific handling in its source and documents it.
 * - 'SQLAlchemy dialect' works via the generic SQLAlchemy path; documented but no special code.
 * - 'Unofficial'        a community/unofficial SQLAlchemy dialect (dlt names it as such).
 */
export type SupportTier = 'Verified' | 'SQLAlchemy dialect' | 'Unofficial';

export interface DatabaseEntry {
  /** Display name. */
  name: string;
  /** SQLAlchemy connection URL prefix (dialect+driver). */
  urlPrefix: string;
  /** pip package(s) providing the driver. */
  driver: string;
  /** How well dlt supports this dialect. */
  tier: SupportTier;
  /**
   * dlt sql_database backends available for this source. `sqlalchemy`, `pyarrow`,
   * and `pandas` read through SQLAlchemy so they work for every dialect; `connectorx`
   * uses its own Rust connectors and is only listed where it supports the dialect.
   */
  backends: string;
  /** Dialect-specific notes / caveats for Snowflake loads. */
  gotchas: string;
}

// dlt backends are a per-call choice: TableBackend = "sqlalchemy" | "pyarrow" | "pandas" | "connectorx".
const ALL = 'sqlalchemy · pyarrow · pandas · connectorx';
const SA = 'sqlalchemy · pyarrow · pandas';

// The supported-database catalog. dlt supports *all* SQLAlchemy dialects
// (docs: sql_database/index.md); the list below is the documented set.
// Grow it by appending entries — the "Supported databases" tab renders and
// filters it automatically.
export const databases: DatabaseEntry[] = [
  // ── Tier 1: dlt ships dialect-specific handling ──────────────────────────
  {
    name: 'PostgreSQL',
    urlPrefix: 'postgresql+psycopg2',
    driver: 'psycopg2-binary',
    tier: 'Verified',
    backends: ALL,
    gotchas: 'UUIDs forced to strings for stable casing across loads.',
  },
  {
    name: 'SQL Server',
    urlPrefix: 'mssql+pyodbc',
    driver: 'pyodbc + ODBC Driver 18',
    tier: 'Verified',
    backends: ALL,
    gotchas:
      'dlt maps UNIQUEIDENTIFIER → text and DATETIMEOFFSET → tz-aware timestamp. Options: TrustServerCertificate=yes, LongAsMax=yes, trusted_connection=yes (Windows auth). connectorx needs Encrypt=yes&encrypt=true.',
  },
  {
    name: 'MySQL',
    urlPrefix: 'mysql+pymysql',
    driver: 'pymysql',
    tier: 'Verified',
    backends: ALL,
    gotchas:
      'SA dialect casts DOUBLE → Decimal; reverse with a _double_as_decimal_adapter if you want floats. SSL via ?ssl_ca=/?ssl_cert=/?ssl_key=.',
  },
  {
    name: 'Oracle',
    urlPrefix: 'oracle+oracledb',
    driver: 'oracledb',
    tier: 'Verified',
    backends: ALL,
    gotchas:
      'dlt forces NUMBER → Decimal (reflect listener) to avoid precision loss. TIMESTAMP WITH TIME ZONE loses tz. connectorx works only in oracledb thick mode (incompatible with thin mode).',
  },
  // ── Tier 2: generic SQLAlchemy path, documented ─────────────────────────
  {
    name: 'MariaDB',
    urlPrefix: 'mariadb+pymysql',
    driver: 'pymysql (or mariadb)',
    tier: 'SQLAlchemy dialect',
    backends: ALL,
    gotchas: 'Behaves like MySQL; same DOUBLE→Decimal caveat applies.',
  },
  {
    name: 'SQLite',
    urlPrefix: 'sqlite:///',
    driver: 'stdlib (built in)',
    tier: 'SQLAlchemy dialect',
    backends: ALL,
    gotchas: 'Handy for local dev/tests. File-based; no server URL.',
  },
  {
    name: 'IBM DB2',
    urlPrefix: 'db2+ibm_db',
    driver: 'ibm_db_sa',
    tier: 'SQLAlchemy dialect',
    backends: SA,
    gotchas:
      'Dialect maps DOUBLE → Python float instead of Numeric; dlt adds extra casts. Identifiers lowercased by SQLAlchemy.',
  },
  {
    name: 'Snowflake (as source)',
    urlPrefix: 'snowflake://',
    driver: 'snowflake-sqlalchemy',
    tier: 'SQLAlchemy dialect',
    backends: SA,
    gotchas:
      'TIMESTAMP_NTZ does not inherit from sa.DateTime — supply a type_adapter_callback mapping it to sa.DateTime(timezone=True).',
  },
  {
    name: 'Google BigQuery',
    urlPrefix: 'bigquery://',
    driver: 'sqlalchemy-bigquery',
    tier: 'SQLAlchemy dialect',
    backends: ALL,
    gotchas: 'Standard dialect support; no dlt-specific notes.',
  },
  {
    name: 'Amazon Redshift',
    urlPrefix: 'redshift+redshift_connector',
    driver: 'sqlalchemy-redshift',
    tier: 'SQLAlchemy dialect',
    backends: ALL,
    gotchas: 'connectorx connects via the Postgres protocol. Standard dialect support otherwise.',
  },
  {
    name: 'Hive / Presto',
    urlPrefix: 'hive:// · presto://',
    driver: 'PyHive',
    tier: 'SQLAlchemy dialect',
    backends: SA,
    gotchas: 'Standard dialect support; no dlt-specific notes.',
  },
  {
    name: 'SAP HANA',
    urlPrefix: 'hana://',
    driver: 'sqlalchemy-hana',
    tier: 'SQLAlchemy dialect',
    backends: SA,
    gotchas: 'Standard dialect support; no dlt-specific notes.',
  },
  {
    name: 'CockroachDB',
    urlPrefix: 'cockroachdb+psycopg2',
    driver: 'psycopg2 + sqlalchemy-cockroachdb',
    tier: 'SQLAlchemy dialect',
    backends: SA,
    gotchas: 'Postgres-wire compatible; inherits Postgres-style behaviour.',
  },
  {
    name: 'Firebird',
    urlPrefix: 'firebird+fdb',
    driver: 'fdb',
    tier: 'SQLAlchemy dialect',
    backends: SA,
    gotchas: 'Standard dialect support; no dlt-specific notes.',
  },
  {
    name: 'Teradata Vantage',
    urlPrefix: 'teradatasql+teradatasqlalchemy',
    driver: 'teradatasqlalchemy',
    tier: 'SQLAlchemy dialect',
    backends: SA,
    gotchas: 'Standard dialect support; no dlt-specific notes.',
  },
  {
    name: 'ClickHouse',
    urlPrefix: 'clickhouse+native',
    driver: 'clickhouse-sqlalchemy',
    tier: 'SQLAlchemy dialect',
    backends: ALL,
    gotchas: 'Community dialect; connectorx lists ClickHouse as a source.',
  },
  {
    name: 'Databricks',
    urlPrefix: 'databricks://',
    driver: 'databricks-sql-connector',
    tier: 'SQLAlchemy dialect',
    backends: SA,
    gotchas: 'Reads via the Databricks SQL warehouse; watch DECIMAL/TIMESTAMP precision.',
  },
  {
    name: 'Trino',
    urlPrefix: 'trino://',
    driver: 'trino[sqlalchemy]',
    tier: 'SQLAlchemy dialect',
    backends: ALL,
    gotchas: 'Query federation engine; catalog.schema in the path. connectorx lists Trino.',
  },
  {
    name: 'Vertica',
    urlPrefix: 'vertica+vertica_python',
    driver: 'sqlalchemy-vertica-python',
    tier: 'SQLAlchemy dialect',
    backends: SA,
    gotchas: 'Community dialect; no dlt-specific handling.',
  },
  {
    name: 'SingleStore',
    urlPrefix: 'singlestoredb://',
    driver: 'singlestoredb',
    tier: 'SQLAlchemy dialect',
    backends: SA,
    gotchas: 'MySQL-wire compatible; MySQL-style caveats apply.',
  },
  {
    name: 'Greenplum',
    urlPrefix: 'postgresql+psycopg2',
    driver: 'psycopg2-binary',
    tier: 'SQLAlchemy dialect',
    backends: ALL,
    gotchas: 'Postgres-wire compatible; connect via the Postgres dialect (connectorx works too).',
  },
  // ── Tier 3: unofficial dialect ──────────────────────────────────────────
  {
    name: 'DuckDB',
    urlPrefix: 'duckdb:///',
    driver: 'duckdb-engine',
    tier: 'Unofficial',
    backends: SA,
    gotchas: 'dlt names DuckDB as an unofficial dialect. Great for local prototyping.',
  },
];
