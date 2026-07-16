"""Generic dlt pipeline runner driven by pipelines/registry.yml.

Usage:
    python -m pipelines.run <name>        # run one pipeline by name
    python -m pipelines.run --group G     # run every pipeline in group G
    python -m pipelines.run --all         # run every pipeline sequentially
    python -m pipelines.run --list        # print the registry and exit

One container image, N configs: the source is built dynamically from each
registry entry's `source` + `config`, then loaded into Snowflake.

Auth:
  * In-Snowflake (SPCS): the Snowflake destination uses the ambient OAuth
    session token — set DLT credentials via env in the SPCS spec; no secrets
    baked into the image.
  * External (laptop / CI): key-pair or password via .dlt/secrets.toml.

The destination defaults to each pipeline's `destination` field (snowflake) but
can be overridden globally with the DLT_DESTINATION env var (the smoke test sets
it to duckdb).

Config source (control plane):
  Specs are read from the DLT_DB.OPS.PIPELINE_REGISTRY table in Snowflake/SPCS
  and from pipelines/registry.yml for local dev. DLT_REGISTRY_SOURCE selects:
    * "auto"  (default) -> table when an SPCS session token is mounted, else YAML
    * "table" -> always read the registry table
    * "yaml"  -> always read registry.yml
  This keeps the image config-agnostic: adding a pipeline is an INSERT into the
  table, not an image rebuild.
"""

from __future__ import annotations

import argparse
import logging
import os
import sys
from typing import Any

import dlt

from pipelines.models import PipelineSpec, load_registry
from pipelines.observability import configure_logging, record_run

# Module-level logger used before a per-pipeline adapter is available (e.g. in main).
log = logging.getLogger("dlt_pipeline")

# Any string value prefixed with this marker is a reference into dlt secrets;
# everything else is passed through as a literal value.
# Example: credentials: "secret:sources.pg_public.credentials"
SECRET_PREFIX: str = "secret:"


def _resolve_secrets(obj: Any) -> Any:
    """Walk a config tree; replace 'secret:<path>' strings with dlt.secrets values."""
    if isinstance(obj, dict):
        return {k: _resolve_secrets(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_resolve_secrets(v) for v in obj]
    if isinstance(obj, str) and obj.startswith(SECRET_PREFIX):
        return dlt.secrets[obj[len(SECRET_PREFIX):]]
    return obj


def build_source(spec: PipelineSpec):
    """Construct a dlt source object from a registry entry, dispatching on `source`."""
    cfg: dict[str, Any] = _resolve_secrets(spec.config)

    if spec.source == "sql_database":
        from dlt.sources.sql_database import sql_database  # noqa: PLC0415

        return sql_database(
            credentials=cfg.get("credentials"),
            schema=cfg.get("schema"),
            table_names=cfg.get("table_names"),
            backend=cfg.get("backend", "sqlalchemy"),
        )

    if spec.source == "rest_api":
        from dlt.sources.rest_api import rest_api_source  # noqa: PLC0415

        return rest_api_source(cfg)

    # models.validate() guards this; this branch is a defensive fallback.
    raise ValueError(f"unhandled source type: {spec.source!r}")


def run_pipeline(spec: PipelineSpec) -> None:
    """Execute a single pipeline end-to-end and record the outcome in OPS._DLT_RUNS."""
    pipeline_log = configure_logging(spec.name)

    destination: str = os.environ.get("DLT_DESTINATION") or spec.destination

    pipeline_log.info(
        "starting pipeline (source=%s, destination=%s, dataset=%s, disposition=%s)",
        spec.source,
        destination,
        spec.dataset_name,
        spec.write_disposition,
    )

    pipeline = dlt.pipeline(
        pipeline_name=spec.name,
        destination=destination,
        dataset_name=spec.dataset_name,
    )

    try:
        info = pipeline.run(
            build_source(spec),
            write_disposition=spec.write_disposition,
        )
        info.raise_on_failed_jobs()

        row_counts: dict[str, Any] = (
            dict(pipeline.last_trace.last_normalize_info.row_counts)
            if pipeline.last_trace
            else {}
        )

        pipeline_log.info("load complete: %s", info)
        if row_counts:
            pipeline_log.info("row counts: %s", row_counts)

        load_id: str | None = info.loads_ids[0] if info.loads_ids else None
        record_run(spec, status="ok", load_id=load_id, row_counts=row_counts)

    except Exception as exc:
        record_run(spec, status="failed", load_id=None, row_counts=None, error=str(exc))
        raise


def _registry_mode() -> str:
    """Return 'table' or 'yaml' based on DLT_REGISTRY_SOURCE (default: auto).

    In 'auto' mode the table wins when running inside SPCS (session token
    mounted) and YAML is used everywhere else.
    """
    mode = os.environ.get("DLT_REGISTRY_SOURCE", "auto").lower()
    if mode == "auto":
        from pipelines import registry_store  # noqa: PLC0415

        return "table" if registry_store._in_spcs() else "yaml"
    if mode not in ("table", "yaml"):
        raise ValueError(
            f"DLT_REGISTRY_SOURCE must be auto|table|yaml, got '{mode}'"
        )
    return mode


def resolve_specs(args: argparse.Namespace) -> list[PipelineSpec]:
    """Return the specs selected by *args*, reading from the table or YAML.

    Selection semantics are identical across both backends:
      --all / --list -> every (enabled) pipeline
      --group G      -> every (enabled) pipeline in group G
      <name>         -> the single pipeline named <name>
    """
    mode = _registry_mode()
    log.info("resolving pipeline specs from %s", mode)

    if mode == "table":
        from pipelines import registry_store  # noqa: PLC0415

        if args.all or args.list:
            return registry_store.get_all()
        if args.group:
            return registry_store.get_by_group(args.group)
        return [registry_store.get_spec(args.name)]

    registry = load_registry()
    if args.all or args.list:
        return registry.pipelines
    if args.group:
        return registry.by_group(args.group)
    return [registry.get(args.name)]


def _parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        prog="pipelines.run",
        description="Run dlt pipelines registered in registry.yml.",
    )
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("name", nargs="?", help="name of the pipeline to run")
    group.add_argument("--group", metavar="G", help="run every pipeline in group G")
    group.add_argument("--all", action="store_true", help="run every pipeline sequentially")
    group.add_argument("--list", action="store_true", help="print the registry and exit")
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    """CLI entry point.  Returns 0 on full success, 1 if any pipeline failed."""
    logging.basicConfig(
        level=os.environ.get("LOG_LEVEL", "INFO").upper(),
        format="%(asctime)s %(levelname)s %(name)s %(message)s",
    )

    args = _parse_args(sys.argv[1:] if argv is None else argv)
    specs = resolve_specs(args)

    if args.list:
        for p in specs:
            print(
                f"{p.name:<24} source={p.source:<14} "
                f"schedule={str(p.schedule):<18} group={p.group}"
            )
        return 0

    if args.group and not specs:
        log.error("no pipelines in group '%s'", args.group)
        return 1

    failures = 0
    for spec in specs:
        try:
            run_pipeline(spec)
        except Exception:  # noqa: BLE001 — one bad pipeline must not kill the batch
            log.exception("pipeline '%s' failed", spec.name)
            failures += 1

    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
