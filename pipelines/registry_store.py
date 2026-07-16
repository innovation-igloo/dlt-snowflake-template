"""Read pipeline specs from the DLT_DB.OPS.PIPELINE_REGISTRY control table.

This is the *table* half of the dual-mode config system. The runner
(pipelines/run.py) picks between this module and models.load_registry() at
runtime: the table is authoritative in Snowflake/SPCS, the YAML is the
fallback for local dev.

Connection strategy (`_connect`):

  * In-SPCS  -> an OAuth session token is mounted at /snowflake/session/token.
    We connect with authenticator="oauth" + that token, using the SNOWFLAKE_*
    env vars the SPCS runtime injects (HOST/ACCOUNT) plus DATABASE/WAREHOUSE.

  * External -> standard SNOWFLAKE_* env vars (SNOWFLAKE_USER plus either
    SNOWFLAKE_PASSWORD or SNOWFLAKE_PRIVATE_KEY_PATH / _AUTHENTICATOR). Used by
    registry_sync when run from a laptop or CI.

The public API mirrors models.Registry so callers are interchangeable:
    get_spec(name)          -> PipelineSpec   (raises RegistryError if missing/disabled)
    get_all(enabled_only)   -> list[PipelineSpec]
    get_by_group(group)     -> list[PipelineSpec]
"""

from __future__ import annotations

import logging
import os
from pathlib import Path
from typing import TYPE_CHECKING, Any

from pipelines.models import RegistryError, spec_from_row

if TYPE_CHECKING:
    from pipelines.models import PipelineSpec

_log = logging.getLogger("dlt_pipeline")

# Snowflake mounts the OAuth session token here for any container running in SPCS.
_SPCS_TOKEN_PATH = "/snowflake/session/token"

# Fully-qualified control table. Schema/db are fixed by the account setup DDL.
REGISTRY_TABLE = "DLT_DB.OPS.PIPELINE_REGISTRY"

# Columns selected from the table; column order is irrelevant since we read by name.
_COLUMNS = (
    "name",
    "source",
    "schedule",
    "dataset_name",
    "write_disposition",
    "pipeline_group",
    "config",
    "enabled",
)


def _in_spcs() -> bool:
    """True when running inside an SPCS container (OAuth token file present)."""
    return Path(_SPCS_TOKEN_PATH).exists()


def _connect():  # noqa: ANN202 — returns a snowflake.connector connection
    """Open a snowflake-connector-python connection for the current environment.

    Deferred import so importing this module never hard-requires the connector
    (the YAML path in run.py must work without any Snowflake deps installed).
    """
    import snowflake.connector  # noqa: PLC0415

    database = os.environ.get("SNOWFLAKE_DATABASE", "DLT_DB")
    warehouse = os.environ.get("SNOWFLAKE_WAREHOUSE", "DLT_WH")

    if _in_spcs():
        token = Path(_SPCS_TOKEN_PATH).read_text()
        return snowflake.connector.connect(
            host=os.environ["SNOWFLAKE_HOST"],
            account=os.environ["SNOWFLAKE_ACCOUNT"],
            token=token,
            authenticator="oauth",
            database=database,
            warehouse=warehouse,
        )

    # External (local / CI). Password or key-pair via standard env vars.
    account = os.environ.get("SNOWFLAKE_ACCOUNT")
    user = os.environ.get("SNOWFLAKE_USER")
    if not account or not user:
        raise RegistryError(
            "cannot read the registry table: set SNOWFLAKE_ACCOUNT and "
            "SNOWFLAKE_USER (plus SNOWFLAKE_PASSWORD or a key-pair) for external "
            "access, or run where /snowflake/session/token is mounted."
        )

    kwargs: dict[str, Any] = {
        "account": account,
        "user": user,
        "database": database,
        "warehouse": warehouse,
    }
    if os.environ.get("SNOWFLAKE_PASSWORD"):
        kwargs["password"] = os.environ["SNOWFLAKE_PASSWORD"]
    if os.environ.get("SNOWFLAKE_AUTHENTICATOR"):
        kwargs["authenticator"] = os.environ["SNOWFLAKE_AUTHENTICATOR"]
    if os.environ.get("SNOWFLAKE_ROLE"):
        kwargs["role"] = os.environ["SNOWFLAKE_ROLE"]
    if os.environ.get("SNOWFLAKE_PRIVATE_KEY_PATH"):
        kwargs["private_key_file"] = os.environ["SNOWFLAKE_PRIVATE_KEY_PATH"]

    return snowflake.connector.connect(**kwargs)


def _fetch(where: str, params: tuple[Any, ...]) -> list[dict[str, Any]]:
    """Run a SELECT against the registry table and return rows as dicts."""
    from snowflake.connector import DictCursor  # noqa: PLC0415

    cols = ", ".join(_COLUMNS)
    sql = f"SELECT {cols} FROM {REGISTRY_TABLE} WHERE {where}"

    conn = _connect()
    try:
        cur = conn.cursor(DictCursor)
        try:
            cur.execute(sql, params)
            # DictCursor yields uppercase keys; normalise to lowercase for spec_from_row.
            return [{k.lower(): v for k, v in row.items()} for row in cur.fetchall()]
        finally:
            cur.close()
    finally:
        conn.close()


def get_spec(name: str) -> PipelineSpec:
    """Return the enabled spec named *name*; raise RegistryError if missing/disabled."""
    rows = _fetch("name = %s AND enabled = TRUE", (name,))
    if not rows:
        raise RegistryError(
            f"no enabled pipeline named '{name}' in {REGISTRY_TABLE}"
        )
    return spec_from_row(rows[0])


def get_all(enabled_only: bool = True) -> list[PipelineSpec]:
    """Return every spec in the table (enabled only by default)."""
    where = "enabled = TRUE" if enabled_only else "1 = 1"
    return [spec_from_row(r) for r in _fetch(where, ())]


def get_by_group(group: str, enabled_only: bool = True) -> list[PipelineSpec]:
    """Return all enabled specs in *group* (empty list if none)."""
    where = "pipeline_group = %s"
    if enabled_only:
        where += " AND enabled = TRUE"
    return [spec_from_row(r) for r in _fetch(where, (group,))]
