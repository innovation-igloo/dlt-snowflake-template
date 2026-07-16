# Container image for dlt pipelines. One image runs any pipeline in the registry;
# the pipeline name is passed as the container argument (see the staged spec
# template deploy/spcs/dlt_job.tmpl.yaml and the generated tasks). Build and push
# to a Snowflake image repository:
#
#   docker build -t dlt-pipeline:latest -f deploy/spcs/Dockerfile .
#   docker tag dlt-pipeline:latest <org>-<acct>.registry.snowflakecomputing.com/DLT_DB/DEPLOY/IMAGES/dlt-pipeline:latest
#   docker push ...
#
# docker run <image> pg_public         <- runs that pipeline
# docker run <image> --group batch_hourly
# docker run <image> --all
#
# Runtime config source: the image ships NO pipeline definitions. At run time the
# container reads its spec from the DLT_DB.OPS.PIPELINE_REGISTRY table (registry.yml
# is only the local-dev fallback). Adding or editing a pipeline is a table change
# (python -m pipelines.registry_sync), so it never requires rebuilding this image.
# Rebuild only for code or dependency changes.

FROM python:3.11-slim

# System deps: build tools + unixODBC headers required by pyodbc (SQL Server/ODBC sources).
RUN apt-get update \
    && apt-get install -y --no-install-recommends build-essential unixodbc-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy the project (pyproject + package) then install — setuptools needs the
# `pipelines` package present to build. registry.yml lives inside pipelines/.
COPY pyproject.toml ./
COPY pipelines/ ./pipelines/
RUN pip install --no-cache-dir ".[postgres,mssql,mysql]"

COPY .dlt/config.toml ./.dlt/config.toml

ENTRYPOINT ["python", "-m", "pipelines.run"]
