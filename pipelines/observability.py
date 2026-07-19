"""Structured logging and run-metadata collection for the dlt pipeline runner.

Two public entry points:

    configure_logging(pipeline_name) -> logging.LoggerAdapter
        Attaches a structured formatter to the "dlt_pipeline" logger (once)
        and returns an adapter that injects {"pipeline": pipeline_name} into
        every log record.

    record_run(spec, *, status, load_id, row_counts, error) -> None
        Best-effort: writes one row to DLT_DB.OPS._DLT_RUNS via a transient
        dlt pipeline.  Any exception is swallowed so the data load is never
        blocked by telemetry failures.
"""

from __future__ import annotations

import logging
import os
from datetime import datetime, timezone
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from pipelines.models import PipelineSpec

_LOG_CONFIGURED: bool = False


class _PipelineDefaultFilter(logging.Filter):
    """Ensure every record has a `pipeline` attribute.

    The handler's formatter references %(pipeline)s, but records emitted without
    a LoggerAdapter (module-level `log`, and record_run's warnings) don't set it.
    Without this, formatting raises KeyError('pipeline') and floods stderr.
    """

    def filter(self, record: logging.LogRecord) -> bool:
        if not hasattr(record, "pipeline"):
            record.pipeline = "-"
        return True


def configure_logging(pipeline_name: str) -> logging.LoggerAdapter:
    """Attach a structured handler to the 'dlt_pipeline' logger (idempotent).

    Uses SnowflakeLogFormatter when the snowflake.telemetry package is
    available (in-Snowflake / SPCS).  Falls back to a plain Formatter so the
    runner works in local dev without the package installed.

    Level is read from the LOG_LEVEL env var (default: INFO).
    """
    global _LOG_CONFIGURED

    base = logging.getLogger("dlt_pipeline")

    if not _LOG_CONFIGURED:
        _LOG_CONFIGURED = True

        level_name: str = os.environ.get("LOG_LEVEL", "INFO").upper()
        level: int = getattr(logging, level_name, logging.INFO)
        base.setLevel(level)

        handler = logging.StreamHandler()
        handler.setLevel(level)
        handler.addFilter(_PipelineDefaultFilter())

        try:
            from snowflake.telemetry.logs import SnowflakeLogFormatter  # type: ignore[import]

            formatter: logging.Formatter = SnowflakeLogFormatter()
        except Exception:  # noqa: BLE001 — package absent in local dev
            formatter = logging.Formatter(
                "%(asctime)s %(levelname)s %(name)s [pipeline=%(pipeline)s] %(message)s"
            )

        handler.setFormatter(formatter)
        base.addHandler(handler)

    return logging.LoggerAdapter(base, {"pipeline": pipeline_name})


def record_run(
    spec: PipelineSpec,
    *,
    status: str,
    load_id: str | None,
    row_counts: dict[str, Any] | None,
    error: str | None = None,
) -> None:
    """Append one run-metadata row to DLT_DB.OPS._DLT_RUNS.

    This function is *best-effort*: any exception is caught and logged as a
    warning so a telemetry failure never blocks the actual data load.
    """
    _log = logging.getLogger("dlt_pipeline")

    try:
        import dlt  # noqa: PLC0415 — deferred to avoid hard dep at module load

        destination: str = os.environ.get("DLT_DESTINATION") or spec.destination

        ops_pipeline = dlt.pipeline(
            pipeline_name="ops_meta",
            destination=destination,
            dataset_name="OPS",
        )

        record: dict[str, Any] = {
            "pipeline": spec.name,
            "load_id": load_id,
            "status": status,
            "row_counts": row_counts,
            "error": error,
            "finished_at": datetime.now(timezone.utc).isoformat(),
        }

        ops_pipeline.run(
            [record],
            table_name="_dlt_runs",
            write_disposition="append",
        )

    except Exception as exc:  # noqa: BLE001
        _log.warning(
            "record_run failed for pipeline '%s' (status=%s): %s",
            spec.name,
            status,
            exc,
        )
