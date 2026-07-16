"""Typed model and loader for pipelines/registry.yml.

Keeps registry parsing/validation separate from execution so both the runner
(pipelines/run.py) and the task generator (deploy/tasks/generate_tasks.py) can
reuse it without importing any execution dependencies.
"""

from __future__ import annotations

import copy
import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import yaml

# Sources the runner knows how to build. Extend build_source() in run.py to add more.
SUPPORTED_SOURCES: tuple[str, ...] = ("sql_database", "rest_api")

# Resolved relative to this file so the loader works from any working directory.
REGISTRY_PATH: Path = Path(__file__).with_name("registry.yml")


class RegistryError(ValueError):
    """Raised when registry.yml is missing required fields or is malformed."""


@dataclass
class PipelineSpec:
    """Fully-resolved, validated configuration for a single pipeline."""

    name: str
    source: str
    config: dict[str, Any]
    schedule: str | None = None
    dataset_name: str = "RAW"
    write_disposition: str = "merge"
    destination: str = "snowflake"
    load_warehouse: str = "DLT_WH"
    compute_pool: str = "DLT_POOL"
    group: str | None = None

    def validate(self) -> None:
        if not self.name:
            raise RegistryError("a pipeline entry is missing `name`")
        if self.source not in SUPPORTED_SOURCES:
            raise RegistryError(
                f"pipeline '{self.name}': source '{self.source}' is not supported "
                f"(expected one of {', '.join(SUPPORTED_SOURCES)})"
            )
        if not isinstance(self.config, dict) or not self.config:
            raise RegistryError(
                f"pipeline '{self.name}': `config` must be a non-empty mapping"
            )
        if self.write_disposition not in ("append", "replace", "merge"):
            raise RegistryError(
                f"pipeline '{self.name}': write_disposition must be append|replace|merge, "
                f"got '{self.write_disposition}'"
            )


@dataclass
class Registry:
    """In-memory view of the entire pipeline registry."""

    pipelines: list[PipelineSpec] = field(default_factory=list)

    def get(self, name: str) -> PipelineSpec:
        """Return the spec for *name*; raise RegistryError if not found."""
        for p in self.pipelines:
            if p.name == name:
                return p
        raise RegistryError(f"no pipeline named '{name}' in the registry")

    def by_group(self, group: str) -> list[PipelineSpec]:
        """Return all pipelines belonging to *group* (empty list if none)."""
        return [p for p in self.pipelines if p.group == group]


def spec_from_row(row: dict[str, Any]) -> PipelineSpec:
    """Build a validated PipelineSpec from an OPS.PIPELINE_REGISTRY row.

    Kept Snowflake-free on purpose: callers (registry_store) hand in a plain
    dict of column name -> value. `config` may arrive as a dict (parsed VARIANT)
    or a JSON string; both are accepted. The table column `pipeline_group` maps
    to the dataclass field `group`.
    """
    config: Any = row.get("config")
    if isinstance(config, str):
        config = json.loads(config) if config.strip() else {}

    defaults = PipelineSpec.__dataclass_fields__

    def pick(col: str, field_name: str) -> Any:
        # Use the row value when present and non-null, else the dataclass default.
        val = row.get(col)
        return val if val is not None else defaults[field_name].default

    spec = PipelineSpec(
        name=row.get("name") or "",
        source=row.get("source") or "",
        config=config or {},
        schedule=row.get("schedule"),
        dataset_name=pick("dataset_name", "dataset_name"),
        write_disposition=pick("write_disposition", "write_disposition"),
        destination=pick("destination", "destination"),
        load_warehouse=pick("load_warehouse", "load_warehouse"),
        compute_pool=pick("compute_pool", "compute_pool"),
        group=row.get("pipeline_group"),
    )
    spec.validate()
    return spec


def load_registry(path: Path | str = REGISTRY_PATH) -> Registry:
    """Parse registry.yml, merge `defaults` into each pipeline, and validate.

    Raises RegistryError on any structural or validation problem so callers
    get a clear message rather than a raw KeyError / AttributeError.
    """
    path = Path(path)
    if not path.exists():
        raise RegistryError(f"registry file not found: {path}")

    raw: dict[str, Any] = yaml.safe_load(path.read_text()) or {}
    defaults: dict[str, Any] = raw.get("defaults") or {}
    entries: list[dict[str, Any]] = raw.get("pipelines") or []

    if not entries:
        raise RegistryError("registry.yml has no `pipelines` entries")

    # Field names the dataclass accepts (excluding `config` which is handled separately)
    known: set[str] = {f for f in PipelineSpec.__dataclass_fields__ if f != "config"}

    specs: list[PipelineSpec] = []
    seen: set[str] = set()

    for entry in entries:
        merged: dict[str, Any] = copy.deepcopy(defaults)
        merged.update(entry)

        # Only pass known scalar fields to the constructor; keep `config` aside.
        kwargs: dict[str, Any] = {k: v for k, v in merged.items() if k in known}
        spec = PipelineSpec(config=merged.get("config") or {}, **kwargs)
        spec.validate()

        if spec.name in seen:
            raise RegistryError(f"duplicate pipeline name '{spec.name}'")
        seen.add(spec.name)
        specs.append(spec)

    return Registry(pipelines=specs)
