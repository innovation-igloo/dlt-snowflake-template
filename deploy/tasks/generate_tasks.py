"""Generate one Snowflake Task per pipeline from pipelines/registry.yml.

Each Task fires on the pipeline's cron schedule and launches a run-to-completion
SPCS job (EXECUTE JOB SERVICE) on the shared compute pool. The job spec is NOT
inlined here: it is read from the staged template @DLT_DB.DEPLOY.SPECS and
parameterised with USING (pipeline => '<name>'). The image and container env live
in that one template, so adding a pipeline needs no image rebuild and no new
spec file -- just an INSERT (registry_sync) plus the Task this script emits.

Usage:
    python -m deploy.tasks.generate_tasks            # print CREATE TASK SQL to stdout
    python -m deploy.tasks.generate_tasks > tasks.sql

Before the Tasks work, upload the template once:
    PUT file://deploy/spcs/dlt_job.tmpl.yaml @DLT_DB.DEPLOY.SPECS
        AUTO_COMPRESS = FALSE OVERWRITE = TRUE;

Run the emitted SQL as a role that can create tasks and use the pool + warehouse.
Tasks are created SUSPENDED; uncomment the RESUME lines (and grant EXECUTE TASK)
to activate them.
"""

from __future__ import annotations

import sys
from pathlib import Path

# Make the repo root importable so `pipelines` resolves when run as a module or script.
sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from pipelines.models import PipelineSpec, load_registry  # noqa: E402

# Stage holding the SPCS job spec template (see sql/06_pipeline_registry.sql).
# The image path lives inside the template, not here.
SPECS_STAGE = "@DLT_DB.DEPLOY.SPECS"
SPEC_TEMPLATE_FILE = "dlt_job.tmpl.yaml"


def task_sql(spec: PipelineSpec) -> str:
    if not spec.schedule:
        return f"-- skipped '{spec.name}': no schedule in registry\n"

    job_name = f"dlt_job_{spec.name}"
    task_name = f"dlt_task_{spec.name}"
    return f"""\
CREATE OR ALTER TASK {task_name}
  WAREHOUSE = {spec.load_warehouse}
  SCHEDULE = 'USING CRON {spec.schedule} UTC'
AS
  EXECUTE JOB SERVICE
    IN COMPUTE POOL {spec.compute_pool}
    NAME = {job_name}
    FROM {SPECS_STAGE}
    SPECIFICATION_TEMPLATE_FILE = '{SPEC_TEMPLATE_FILE}'
    USING (pipeline => '{spec.name}');

-- ALTER TASK {task_name} RESUME;   -- uncomment to start scheduling
"""


def main() -> int:
    registry = load_registry()
    print("-- Generated from pipelines/registry.yml. One Task per scheduled pipeline.\n")
    for spec in registry.pipelines:
        print(task_sql(spec))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
