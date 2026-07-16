"""Unit tests for the config-as-data layer: spec_from_row + registry_sync SQL.

Pure Python — no Snowflake, no dlt, no network. Only pyyaml is required (pulled
in transitively via pipelines.models).
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import pytest

_ROOT = Path(__file__).parent.parent.resolve()
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

# models imports yaml at module load; skip cleanly if pyyaml is absent.
pytest.importorskip("yaml")

from pipelines.models import RegistryError, spec_from_row  # noqa: E402


# ---------------------------------------------------------------------------
# spec_from_row — table row -> validated PipelineSpec
# ---------------------------------------------------------------------------


def _base_row(**overrides) -> dict:
    row = {
        "name": "pg_public",
        "source": "sql_database",
        "schedule": "0 * * * *",
        "dataset_name": "RAW",
        "write_disposition": "merge",
        "pipeline_group": "batch_hourly",
        "config": {"credentials": "secret:x", "schema": "public"},
        "enabled": True,
    }
    row.update(overrides)
    return row


def test_spec_from_row_config_as_dict() -> None:
    spec = spec_from_row(_base_row())
    assert spec.name == "pg_public"
    assert spec.source == "sql_database"
    assert spec.config["schema"] == "public"
    # pipeline_group column maps onto the `group` field.
    assert spec.group == "batch_hourly"


def test_spec_from_row_config_as_json_string() -> None:
    row = _base_row(config=json.dumps({"credentials": "secret:x", "schema": "s"}))
    spec = spec_from_row(row)
    assert spec.config == {"credentials": "secret:x", "schema": "s"}


def test_spec_from_row_empty_config_string_becomes_error() -> None:
    # An empty VARIANT string parses to {} which fails validate() (config required).
    row = _base_row(config="")
    with pytest.raises(RegistryError, match="non-empty mapping"):
        spec_from_row(row)


def test_spec_from_row_missing_columns_fall_back_to_defaults() -> None:
    # Table has no destination/load_warehouse/compute_pool columns; defaults apply.
    row = {
        "name": "minimal",
        "source": "rest_api",
        "config": {"client": {"base_url": "https://api.example.com"}},
    }
    spec = spec_from_row(row)
    assert spec.destination == "snowflake"
    assert spec.load_warehouse == "DLT_WH"
    assert spec.compute_pool == "DLT_POOL"
    assert spec.dataset_name == "RAW"
    assert spec.write_disposition == "merge"
    assert spec.schedule is None
    assert spec.group is None


def test_spec_from_row_null_column_uses_default() -> None:
    # A NULL in the table (None) must fall back to the default, not become None.
    row = _base_row(dataset_name=None, write_disposition=None)
    spec = spec_from_row(row)
    assert spec.dataset_name == "RAW"
    assert spec.write_disposition == "merge"


def test_spec_from_row_invalid_source_rejected() -> None:
    with pytest.raises(RegistryError, match="not supported"):
        spec_from_row(_base_row(source="mongodb"))


# ---------------------------------------------------------------------------
# registry_sync — MERGE / prune SQL builders
# ---------------------------------------------------------------------------


def test_merge_sql_and_row_params_align() -> None:
    from pipelines.models import PipelineSpec  # noqa: PLC0415
    from pipelines.registry_sync import MERGE_SQL, _row_params  # noqa: PLC0415

    spec = PipelineSpec(
        name="pg_public",
        source="sql_database",
        config={"credentials": "secret:x"},
        schedule="0 * * * *",
        group="batch_hourly",
    )
    params = _row_params(spec)

    # One %s per bind value, in the documented order.
    assert MERGE_SQL.count("%s") == len(params) == 7
    assert params[0] == "pg_public"
    assert params[5] == "batch_hourly"          # pipeline_group
    assert json.loads(params[6]) == {"credentials": "secret:x"}  # config JSON
    # config bind is wrapped in PARSE_JSON so VARIANT typing is correct.
    assert "PARSE_JSON(%s)" in MERGE_SQL
    assert "MERGE INTO DLT_DB.OPS.PIPELINE_REGISTRY" in MERGE_SQL
    # enabled is only set on INSERT, never on UPDATE (preserves manual disables).
    assert "enabled" not in MERGE_SQL.split("WHEN MATCHED")[1].split("WHEN NOT MATCHED")[0]


def test_prune_sql_placeholder_count() -> None:
    from pipelines.registry_sync import _prune_sql  # noqa: PLC0415

    sql, params = _prune_sql(["a", "b", "c"])
    assert sql.count("%s") == 3
    assert params == ("a", "b", "c")
    assert "DELETE FROM DLT_DB.OPS.PIPELINE_REGISTRY" in sql
    assert "NOT IN" in sql


def test_emit_sql_is_self_contained() -> None:
    from pipelines.models import PipelineSpec  # noqa: PLC0415
    from pipelines.registry_sync import emit_sql  # noqa: PLC0415

    specs = [
        PipelineSpec(
            name="pg_public",
            source="sql_database",
            config={"credentials": "secret:x"},
            schedule="0 * * * *",
            group="batch_hourly",
        ),
        PipelineSpec(
            name="gh_issues",
            source="rest_api",
            config={"client": {"base_url": "https://api.example.com"}},
        ),
    ]
    out = emit_sql(specs, prune=True)

    # No bind placeholders leak into the emitted script.
    assert "%s" not in out
    # Both pipelines produce a MERGE with inlined literals + dollar-quoted config.
    assert out.count("MERGE INTO DLT_DB.OPS.PIPELINE_REGISTRY") == 2
    assert "'pg_public' AS name" in out
    assert "PARSE_JSON($$" in out
    # Missing group renders as NULL, not the string 'None'.
    assert "NULL AS pipeline_group" in out
    assert "'None'" not in out
    # Statements are terminated; prune DELETE is included and scoped to YAML names.
    assert out.count(";") == 3  # 2 MERGE + 1 DELETE
    assert "DELETE FROM DLT_DB.OPS.PIPELINE_REGISTRY WHERE name NOT IN (" in out
    assert "'pg_public'" in out and "'gh_issues'" in out

