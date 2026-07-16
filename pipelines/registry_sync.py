"""Sync pipelines/registry.yml into the DLT_DB.OPS.PIPELINE_REGISTRY table.

The YAML file is the human-edited source of truth in git; this script pushes it
into the control table that the runner reads at execution time. Run it from a
laptop or CI after editing registry.yml:

    python -m pipelines.registry_sync             # upsert every YAML entry
    python -m pipelines.registry_sync --prune     # ...and delete table rows not in YAML
    python -m pipelines.registry_sync --dry-run   # print SQL + params, touch nothing
    python -m pipelines.registry_sync --emit-sql  # print a runnable .sql (for `snow sql -f`)

The --emit-sql mode inlines all values as literals and does not open a
connection, so CD can pipe it straight into `snow sql` using only the OIDC
`snow` auth -- no Python-connector credentials required in the runner.

Upsert semantics (MERGE):
  * config fields are overwritten from YAML on every sync.
  * `enabled` is set TRUE only on INSERT; a manual disable in the table is
    preserved across syncs (we never flip it back on).
  * `updated_at` is stamped with CURRENT_TIMESTAMP() on insert and update.

Connection reuses registry_store._connect() (SNOWFLAKE_* env vars externally).
"""

from __future__ import annotations

import argparse
import json
import logging
import os
import sys
from typing import Any

from pipelines.models import PipelineSpec, load_registry
from pipelines.registry_store import REGISTRY_TABLE, _connect

log = logging.getLogger("dlt_pipeline")

# Column order for the USING(SELECT ...) clause. Shared by the parameterised
# (connector) path and the literal (--emit-sql) path so the two never drift.
_MERGE_TAIL = """) AS s
ON t.name = s.name
WHEN MATCHED THEN UPDATE SET
    source = s.source,
    schedule = s.schedule,
    dataset_name = s.dataset_name,
    write_disposition = s.write_disposition,
    pipeline_group = s.pipeline_group,
    config = s.config,
    updated_at = CURRENT_TIMESTAMP()
WHEN NOT MATCHED THEN INSERT
    (name, source, schedule, dataset_name, write_disposition,
     pipeline_group, config, enabled, updated_at)
    VALUES
    (s.name, s.source, s.schedule, s.dataset_name, s.write_disposition,
     s.pipeline_group, s.config, TRUE, CURRENT_TIMESTAMP())"""


def _merge_header(vals: "list[str]") -> str:
    """Build the MERGE ... USING(SELECT ...) header from 7 value tokens.

    vals order: name, source, schedule, dataset_name, write_disposition,
    pipeline_group, config (the config token already wrapped in PARSE_JSON(...)).
    """
    return (
        f"MERGE INTO {REGISTRY_TABLE} AS t\n"
        "USING (SELECT\n"
        f"    {vals[0]} AS name,\n"
        f"    {vals[1]} AS source,\n"
        f"    {vals[2]} AS schedule,\n"
        f"    {vals[3]} AS dataset_name,\n"
        f"    {vals[4]} AS write_disposition,\n"
        f"    {vals[5]} AS pipeline_group,\n"
        f"    {vals[6]} AS config\n"
    )


# Parameterised MERGE for a single pipeline row. %s order must match _row_params().
MERGE_SQL = _merge_header(["%s", "%s", "%s", "%s", "%s", "%s", "PARSE_JSON(%s)"]) + _MERGE_TAIL


def _row_params(spec: PipelineSpec) -> tuple[Any, ...]:
    """Return the %s bind values for MERGE_SQL, in order."""
    return (
        spec.name,
        spec.source,
        spec.schedule,
        spec.dataset_name,
        spec.write_disposition,
        spec.group,
        json.dumps(spec.config),
    )


def _sql_literal(val: Any) -> str:
    """Render a scalar as a Snowflake SQL literal ('...' with quotes doubled, or NULL)."""
    if val is None:
        return "NULL"
    return "'" + str(val).replace("'", "''") + "'"


def merge_sql_literal(spec: PipelineSpec) -> str:
    """Return a self-contained MERGE statement with inlined literals (no binds).

    Used by --emit-sql so the whole sync can run through `snow sql -f` without the
    Python connector (and without connector credentials) in CI. The config VARIANT
    is dollar-quoted to avoid backslash/quote escaping issues inside PARSE_JSON.
    """
    config_json = json.dumps(spec.config)
    vals = [
        _sql_literal(spec.name),
        _sql_literal(spec.source),
        _sql_literal(spec.schedule),
        _sql_literal(spec.dataset_name),
        _sql_literal(spec.write_disposition),
        _sql_literal(spec.group),
        f"PARSE_JSON($${config_json}$$)",
    ]
    return _merge_header(vals) + _MERGE_TAIL + ";"


def _prune_sql(names: list[str]) -> tuple[str, tuple[Any, ...]]:
    """Return (sql, params) that deletes table rows whose name is not in *names*."""
    placeholders = ", ".join(["%s"] * len(names))
    sql = f"DELETE FROM {REGISTRY_TABLE} WHERE name NOT IN ({placeholders})"
    return sql, tuple(names)


def _prune_sql_literal(names: list[str]) -> str:
    """Return a DELETE statement with inlined name literals (for --emit-sql)."""
    name_list = ", ".join(_sql_literal(n) for n in names)
    return f"DELETE FROM {REGISTRY_TABLE} WHERE name NOT IN ({name_list});"


def emit_sql(specs: list[PipelineSpec], *, prune: bool = False) -> str:
    """Return a runnable .sql script (MERGE per pipeline, optional prune) as text."""
    parts: list[str] = [
        "-- Generated by `python -m pipelines.registry_sync --emit-sql`.",
        "-- Applies pipelines/registry.yml to DLT_DB.OPS.PIPELINE_REGISTRY.",
        "-- Run with: snow sql -f registry_sync.sql",
        "",
    ]
    for spec in specs:
        parts.append(merge_sql_literal(spec))
        parts.append("")
    if prune:
        parts.append(_prune_sql_literal([s.name for s in specs]))
        parts.append("")
    return "\n".join(parts).strip() + "\n"


def sync(
    specs: list[PipelineSpec],
    *,
    prune: bool = False,
    dry_run: bool = False,
) -> None:
    """Upsert every spec into the registry table; optionally prune stray rows."""
    names = [s.name for s in specs]

    if dry_run:
        for spec in specs:
            log.info("MERGE %s params=%s", spec.name, _row_params(spec))
        if prune:
            sql, params = _prune_sql(names)
            log.info("PRUNE %s params=%s", sql, params)
        return

    conn = _connect()
    try:
        cur = conn.cursor()
        try:
            for spec in specs:
                cur.execute(MERGE_SQL, _row_params(spec))
                log.info("synced pipeline '%s'", spec.name)
            if prune:
                sql, params = _prune_sql(names)
                cur.execute(sql, params)
                log.info("pruned %s row(s) not present in YAML", cur.rowcount)
            conn.commit()
        finally:
            cur.close()
    finally:
        conn.close()


def _parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        prog="pipelines.registry_sync",
        description="Sync registry.yml into DLT_DB.OPS.PIPELINE_REGISTRY.",
    )
    parser.add_argument(
        "--prune",
        action="store_true",
        help="delete table rows whose name is not present in registry.yml",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="print the SQL and bind params without touching the table",
    )
    parser.add_argument(
        "--emit-sql",
        action="store_true",
        help="print a runnable .sql script (inlined literals) and exit; no connection",
    )
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    logging.basicConfig(
        level=os.environ.get("LOG_LEVEL", "INFO").upper(),
        format="%(asctime)s %(levelname)s %(name)s %(message)s",
    )
    args = _parse_args(sys.argv[1:] if argv is None else argv)
    registry = load_registry()

    if args.emit_sql:
        # Write only the SQL to stdout so `... --emit-sql > sync.sql` is clean.
        print(emit_sql(registry.pipelines, prune=args.prune), end="")
        return 0

    sync(registry.pipelines, prune=args.prune, dry_run=args.dry_run)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
