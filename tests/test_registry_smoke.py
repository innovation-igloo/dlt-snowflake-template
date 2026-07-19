"""Smoke tests for the pipeline registry — no Snowflake, no network required."""
from __future__ import annotations

import sqlite3
import sys
from pathlib import Path
from textwrap import dedent

import pytest

# Ensure `import pipelines.*` works when pytest is run from the repo root
# without the package installed in the active environment.
_ROOT = Path(__file__).parent.parent.resolve()
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

# Guard: skip the entire module when the core runtime deps are absent.
pytest.importorskip("dlt")
pytest.importorskip("duckdb")

import dlt  # noqa: E402  (must follow importorskip)

from pipelines.models import PipelineSpec, RegistryError, load_registry  # noqa: E402


# ---------------------------------------------------------------------------
# Registry unit tests (pure Python — no I/O beyond reading registry.yml)
# ---------------------------------------------------------------------------


def test_registry_loads_and_validates() -> None:
    registry = load_registry()
    assert len(registry.pipelines) >= 1, "registry must contain at least one pipeline"

    for spec in registry.pipelines:
        assert spec.source in ("sql_database", "rest_api", "sample"), (
            f"unsupported source '{spec.source}' in pipeline '{spec.name}'"
        )
        assert isinstance(spec.config, dict) and spec.config, (
            f"pipeline '{spec.name}' has an empty config"
        )

    names = [spec.name for spec in registry.pipelines]
    assert len(names) == len(set(names)), "pipeline names must be unique"

    pg = registry.get("pg_public")
    assert pg.dataset_name and isinstance(pg.dataset_name, str), (
        "pg_public.dataset_name must be a non-empty string"
    )


def test_duplicate_names_rejected(tmp_path: Path) -> None:
    registry_file = tmp_path / "registry.yml"
    registry_file.write_text(
        dedent("""\
            defaults:
              destination: snowflake
              dataset_name: RAW
              write_disposition: merge
              load_warehouse: DLT_WH
              compute_pool: DLT_POOL

            pipelines:
              - name: duplicate
                source: sql_database
                config:
                  credentials: "sqlite:///dummy.db"
              - name: duplicate
                source: sql_database
                config:
                  credentials: "sqlite:///dummy.db"
        """)
    )
    with pytest.raises(RegistryError, match="duplicate"):
        load_registry(registry_file)


# ---------------------------------------------------------------------------
# End-to-end smoke: sqlite -> dlt sql_database source -> duckdb destination
# ---------------------------------------------------------------------------


def test_sql_database_smoke_to_duckdb(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    # Redirect all dlt pipeline state + duckdb output into tmp_path so tests
    # are fully isolated even when run in parallel.
    monkeypatch.chdir(tmp_path)
    monkeypatch.setenv("DLT_DATA_DIR", str(tmp_path))
    # Ensure run_pipeline() (and any dlt-internal collector) targets duckdb, not Snowflake.
    monkeypatch.setenv("DLT_DESTINATION", "duckdb")

    # ── Build a minimal SQLite database with 3 rows ──────────────────────────
    db_path = tmp_path / "smoke.db"
    con = sqlite3.connect(str(db_path))
    con.execute(
        "CREATE TABLE customers "
        "(id INTEGER PRIMARY KEY, name TEXT, updated_at TEXT)"
    )
    con.executemany(
        "INSERT INTO customers VALUES (?, ?, ?)",
        [
            (1, "Alice", "2024-01-01T00:00:00Z"),
            (2, "Bob", "2024-01-02T00:00:00Z"),
            (3, "Carol", "2024-01-03T00:00:00Z"),
        ],
    )
    con.commit()
    con.close()

    # ── Build the spec directly (bypasses registry.yml for isolation) ─────────
    spec = PipelineSpec(
        name="smoke_customers",
        source="sql_database",
        config={
            "credentials": f"sqlite:///{db_path}",
            "table_names": ["customers"],
            "backend": "sqlalchemy",
        },
        dataset_name="raw_smoke",
        write_disposition="append",
    )

    # ── Run the pipeline ──────────────────────────────────────────────────────
    from pipelines.run import run_pipeline  # noqa: PLC0415

    run_pipeline(spec)

    # ── Assert 3 rows landed in duckdb ───────────────────────────────────────
    # Re-attach to the same pipeline; DLT_DATA_DIR is still set to tmp_path so
    # dlt restores state from disk and opens the same .duckdb file.
    pipeline = dlt.pipeline(
        pipeline_name=spec.name,
        destination="duckdb",
        dataset_name=spec.dataset_name,
    )
    with pipeline.sql_client() as c:
        rows = c.execute_sql("SELECT COUNT(*) FROM customers")
    assert rows[0][0] == 3, f"expected 3 rows, got {rows[0][0]}"
