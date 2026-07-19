# Makefile for dlt-snowflake-template
#
# Quickstart for a new machine:
#   make setup                 # doctor + install (uv) + secrets bootstrap
#   make list                  # show pipelines declared in registry.yml
#   make run NAME=pg_public    # load a pipeline locally to DuckDB
#
# Dependency management uses `uv`. `make install` runs `uv sync` (creates .venv
# and uv.lock); every other Python target runs through `uv run`, which keeps the
# environment in sync automatically.

UV          ?= uv
EXTRAS      ?= dev                                   # space-separated: EXTRAS="dev postgres"
EXTRA_FLAGS := $(foreach e,$(EXTRAS),--extra $(e))
UV_RUN      := $(UV) run $(EXTRA_FLAGS)

DEST        ?= duckdb                                # default destination for `make run`
NAME        ?=                                       # pipeline name for `make run`
GROUP       ?=                                       # or a pipeline group for `make run`

SNOW_CONN   ?=                                       # optional named snow connection
SNOW        := snow sql $(if $(SNOW_CONN),--connection $(SNOW_CONN),)

# Develop-in-Snowflake knobs (see the "Develop in Snowflake" targets)
DEV_ROLE    ?= DLT_DEV_ROLE                          # role dev jobs run under
DEV_WH      ?= DLT_DEV_WH                             # warehouse the dev role can use
SNOW_DEV    := snow sql --role $(DEV_ROLE) $(if $(SNOW_CONN),--connection $(SNOW_CONN),)
DATASET     ?=                                       # dev schema; empty => DEV_<snowflake_user> from your snow connection
SECRET      ?=                                       # e.g. DLT_DB.OPS.PG_PUBLIC_CRED
ENVVAR      ?=                                       # e.g. SOURCES__PG_PUBLIC__CREDENTIALS
EAI         ?=                                       # optional External Access Integration
SPECS_STAGE := @DLT_DB.DEPLOY.SPECS

# Laptop -> Snowflake auth reused from a `snow` CLI connection (no secrets.toml)
CONN        ?=                                       # snow connection name (blank = default_connection_name)
SF_DATABASE ?= DLT_DEV_DB                            # destination DB for run-sf

# SPCS image build/push. Docker refs must be lowercase; keep these values free of
# trailing spaces (Make keeps whitespace before an inline '#', which corrupts the tag).
IMAGE       ?= dlt-pipeline:latest
IMAGE_REPO  := /dlt_db/deploy/images
SNOW_CLI    := snow $(if $(SNOW_CONN),--connection $(SNOW_CONN),)

DOCS_DIR    := docs/development-gameplan

# Terminal banner helper: `@$(call hdr,message)` prints a bold cyan section header.
# (Keep messages comma-free -- commas split $(call) arguments.)
define hdr
printf '\n\033[1;36m== %s ==\033[0m\n' "$(1)"
endef

.DEFAULT_GOAL := help

.PHONY: help doctor install secrets setup \
        test test-config lint fmt list run \
        docs-install docs-dev docs-build \
        sync-sql tasks-sql emit \
        setup-base setup-dev setup-prod \
        image-build image-login image-push \
        dev-spec-upload dev-run dev-pool-status snow-env run-sf \
        sync-apply tasks-apply deploy \
        clean clean-docs

help: ## Show this help
	@awk 'BEGIN {FS = ":.*##"; printf "\nUsage: make \033[36m<target>\033[0m\n"} \
		/^[a-zA-Z0-9_.-]+:.*?##/ { printf "  \033[36m%-16s\033[0m %s\n", $$1, $$2 } \
		/^##@/ { printf "\n\033[1m%s\033[0m\n", substr($$0, 5) }' $(MAKEFILE_LIST)
	@echo ""

##@ Environment setup

doctor: ## Check required tooling (uv, docker, snow, node)
	@echo "Checking tooling..."
	@command -v uv     >/dev/null 2>&1 && echo "  uv:     $$(uv --version)"            || echo "  uv:     MISSING  (install: https://docs.astral.sh/uv/)"
	@command -v docker >/dev/null 2>&1 && echo "  docker: $$(docker --version)"        || echo "  docker: missing  (only needed to build/push the image)"
	@command -v snow   >/dev/null 2>&1 && echo "  snow:   $$(snow --version 2>&1 | head -1)" || echo "  snow:   missing  (only needed for live Snowflake apply)"
	@command -v node   >/dev/null 2>&1 && echo "  node:   $$(node --version)"          || echo "  node:   missing  (only needed for the docs site)"
	@echo "uv provisions Python >=3.11 automatically from pyproject.toml."

install: ## Install deps into .venv via uv (EXTRAS="dev postgres")
	$(UV) sync $(EXTRA_FLAGS)

secrets: ## Create .dlt/secrets.toml from the example if it does not exist
	@if [ -f .dlt/secrets.toml ]; then \
		echo ".dlt/secrets.toml already exists - leaving it untouched."; \
	else \
		cp .dlt/secrets.toml.example .dlt/secrets.toml; \
		echo "Created .dlt/secrets.toml. You usually don't need to fill the Snowflake"; \
		echo "destination block: 'make run' loads to DuckDB, and 'make run-sf' reuses"; \
		echo "your snow connection. Fill in only the SOURCE creds you actually load from."; \
	fi

setup: doctor install secrets ## One-command onboarding (doctor + install + secrets)
	@echo ""
	@echo "Setup complete. Next steps:"
	@echo "  make test                 # run the test suite"
	@echo "  make list                 # show pipelines in the registry"
	@echo "  make run NAME=pg_public   # load a pipeline locally to DuckDB"

##@ Local verify

test: ## Run the full test suite
	$(UV_RUN) pytest -q

test-config: ## Run the pure config unit tests only (no dlt/network)
	$(UV_RUN) pytest tests/test_registry_config.py -q

lint: ## Lint with ruff
	$(UV_RUN) ruff check .

fmt: ## Format with ruff
	$(UV_RUN) ruff format .

list: ## List pipelines declared in registry.yml
	DLT_REGISTRY_SOURCE=yaml $(UV_RUN) python -m pipelines.run --list

run: ## Run a pipeline locally (make run NAME=pg_public [DEST=duckdb])
	@if [ -z "$(NAME)$(GROUP)" ]; then \
		echo "Set NAME=<pipeline> or GROUP=<group>. See 'make list'."; \
		exit 2; \
	fi
	DLT_REGISTRY_SOURCE=yaml DLT_DESTINATION=$(DEST) $(UV_RUN) python -m pipelines.run $(if $(GROUP),--group $(GROUP),$(NAME))

##@ Docs site

docs-install: ## Install docs site dependencies (npm)
	cd $(DOCS_DIR) && npm install

docs-dev: ## Run the docs site locally
	cd $(DOCS_DIR) && npm run dev

docs-build: ## Build the docs site
	cd $(DOCS_DIR) && npm run build

##@ Snowflake artifacts (offline, no connection)

build:
	@mkdir -p build

sync-sql: build ## Emit registry sync SQL -> build/sync.sql
	$(UV_RUN) python -m pipelines.registry_sync --emit-sql --prune > build/sync.sql
	@echo "Wrote build/sync.sql"

tasks-sql: build ## Emit per-pipeline Task DDL -> build/tasks.sql
	$(UV_RUN) python -m deploy.tasks.generate_tasks > build/tasks.sql
	@echo "Wrote build/tasks.sql"

emit: sync-sql tasks-sql ## Emit both sync.sql and tasks.sql

##@ Snowflake setup (live; requires a snow connection)
# Dev is the primary path for developers. Run setup-base once, then setup-dev.
# setup-prod is a separate, customer-tailored flow you run when ready to schedule
# production loads.

setup-base: ## Apply shared control-plane DDL sql/base/* (guard: CONFIRM=1)
	@if [ "$(CONFIRM)" != "1" ]; then \
		echo "Creates roles (DLT_LOADER_ROLE, DLT_DEV_ROLE) + DLT_DB control plane"; \
		echo "(registry table, image repo, spec stage). Re-run with CONFIRM=1"; \
		echo "(optionally SNOW_CONN=<connection>)."; \
		exit 2; \
	fi
	@for f in sql/base/*.sql; do echo "== applying $$f =="; $(SNOW) -f $$f || exit 1; done
	@echo "Base control plane ready. Next (primary): make setup-dev. For scheduled prod later: make setup-prod."

setup-dev: ## Apply development DDL sql/dev/* -- the primary developer path (guard: CONFIRM=1)
	@if [ "$(CONFIRM)" != "1" ]; then \
		echo "Creates DLT_DEV_DB (per-developer schemas), DLT_DEV_POOL, DLT_DEV_WH."; \
		echo "This is where developers work. Re-run with CONFIRM=1  (optionally SNOW_CONN=<connection>)."; \
		exit 2; \
	fi
	@for f in sql/dev/*.sql; do echo "== applying $$f =="; $(SNOW) -f $$f || exit 1; done
	@echo "Dev ready. Grant DLT_DEV_ROLE to developers, then: make dev-spec-upload and make dev-run."

setup-prod: ## Apply production DDL sql/prod/* -- tailor to the customer's needs first (guard: CONFIRM=1)
	@if [ "$(CONFIRM)" != "1" ]; then \
		echo "Production is a separate, customer-specific flow. Review warehouse sizing,"; \
		echo "multi-cluster, and scheduling in sql/prod/* before applying."; \
		echo "Creates DLT_PROD_DB, DLT_POOL, DLT_WH, and the DLT_LOADER service user."; \
		echo "Re-run with CONFIRM=1. (03b OIDC has placeholders - edit and apply it manually.)"; \
		exit 2; \
	fi
	@for f in sql/prod/01_prod_db.sql sql/prod/02_compute.sql sql/prod/03_service_user.sql; do \
		echo "== applying $$f =="; $(SNOW) -f $$f || exit 1; \
	done
	@echo "Prod ready. Optional: sql/prod/03b_service_user_oidc.sql (set SUBJECT for keyless CI/CD)."

##@ Develop in Snowflake

dev-spec-upload: ## Upload the dev job spec templates (with- and no-secret) to @DLT_DB.DEPLOY.SPECS
	@$(call hdr,Upload dev spec templates -> @DLT_DB.DEPLOY.SPECS)
	@mkdir -p build
	@$(SNOW) -q "PUT file://deploy/spcs/dlt_dev_job.tmpl.yaml $(SPECS_STAGE) AUTO_COMPRESS=FALSE OVERWRITE=TRUE;" > build/spec.out 2>&1 \
	  && $(SNOW) -q "PUT file://deploy/spcs/dlt_dev_job_nosecret.tmpl.yaml $(SPECS_STAGE) AUTO_COMPRESS=FALSE OVERWRITE=TRUE;" >> build/spec.out 2>&1 \
	  && printf '\033[0;32m✓ uploaded dlt_dev_job.tmpl.yaml + dlt_dev_job_nosecret.tmpl.yaml\033[0m\n' \
	  || { printf '\033[0;31m✗ upload failed\033[0m\n'; cat build/spec.out; exit 1; }

dev-run: ## Run a pipeline in Snowflake into an isolated dev schema (NAME= [SECRET= ENVVAR=] [DATASET=] [EAI=])
	@if [ -z "$(NAME)" ]; then echo "Set NAME=<pipeline>. See 'make list'."; exit 2; fi
	@if [ -n "$(SECRET)" ] && [ -z "$(ENVVAR)" ]; then \
		echo "SECRET set but ENVVAR missing. Provide both, e.g.:"; \
		echo "  make dev-run NAME=github_issues SECRET=DLT_DB.OPS.GITHUB_ISSUES_TOKEN ENVVAR=SOURCES__GITHUB_ISSUES__TOKEN"; \
		exit 2; \
	fi
	@$(call hdr,Dev run '$(NAME)' in SPCS -> DLT_DEV_DB)
	@eval "$$($(UV_RUN) python -m deploy.snow_env $(CONN) 2>/dev/null)"; \
	  ds="$(DATASET)"; ds="$${ds:-$$DLT_DEV_DATASET}"; \
	  if [ -n "$(SECRET)" ]; then \
	    tmpl='dlt_dev_job.tmpl.yaml'; \
	    using="USING (pipeline => '\"$(NAME)\"', dataset => '\"$$ds\"', secret => '\"$(SECRET)\"', env_var => '\"$(ENVVAR)\"')"; \
	  else \
	    tmpl='dlt_dev_job_nosecret.tmpl.yaml'; \
	    using="USING (pipeline => '\"$(NAME)\"', dataset => '\"$$ds\"')"; \
	  fi; \
	  printf '  \033[2mpipeline=%s dataset=%s template=%s\033[0m\n' "$(NAME)" "$$ds" "$$tmpl"; \
	  $(SNOW_DEV) -q "DROP SERVICE IF EXISTS DLT_DB.DEPLOY.dlt_dev_$(NAME);" >/dev/null 2>&1 || true; \
	  $(SNOW_DEV) -q "EXECUTE JOB SERVICE IN COMPUTE POOL DLT_DEV_POOL NAME = DLT_DB.DEPLOY.dlt_dev_$(NAME) FROM $(SPECS_STAGE) SPECIFICATION_TEMPLATE_FILE='$$tmpl' $(if $(EAI),EXTERNAL_ACCESS_INTEGRATIONS = ($(EAI)) ,)$$using;" \
	    && printf '\033[0;32m✓ dev run complete -> DLT_DEV_DB.%s\033[0m\n' "$$ds" \
	    || { printf '\033[0;31m✗ dev run failed\033[0m\n'; exit 1; }

snow-env: ## Print export lines for a snow connection, e.g. eval "$(make snow-env CONN=innovation-igloo)"
	@$(UV_RUN) python -m deploy.snow_env $(CONN)

dev-pool-status: ## Show DLT_DEV_POOL state (must be ACTIVE/IDLE before dev-run)
	@$(call hdr,DLT_DEV_POOL status)
	@$(SNOW) --format json -q "DESCRIBE COMPUTE POOL DLT_DEV_POOL" 2>/dev/null \
	  | python3 -c 'import sys,json; d=json.load(sys.stdin); r=d[0] if isinstance(d,list) else d; print("  state:", r.get("state"), " nodes: active="+str(r.get("active_nodes")), "idle="+str(r.get("idle_nodes")), "min="+str(r.get("min_nodes")), "max="+str(r.get("max_nodes")))' \
	  || echo "  (could not read pool state)"

##@ SPCS image

image-build: ## Build the SPCS image (linux/amd64; Docker required)
	@echo "Building linux/amd64 (required by SPCS x86_64 pools)."
	@echo "On Apple Silicon this emulates via QEMU and is slow -- prefer the CI"
	@echo "image build (.github/workflows/deploy.yml) on an amd64 runner."
	docker build --platform linux/amd64 --load -f deploy/spcs/Dockerfile -t $(IMAGE) .

image-login: ## Docker-login to the Snowflake image registry via snow
	$(SNOW_CLI) spcs image-registry login

image-push: image-build image-login ## Build + push the image to DLT_DB.DEPLOY.IMAGES
	@host="$$($(SNOW_CLI) spcs image-registry url)"; \
	  target="$$host$(IMAGE_REPO)/$(IMAGE)"; \
	  echo "Pushing to $$target"; \
	  docker tag $(IMAGE) "$$target" && docker push "$$target"

run-sf: ## Run a pipeline from your laptop to Snowflake via a snow connection (NAME= [CONN=] [DATASET=] [SF_DATABASE=])
	@if [ -z "$(NAME)" ]; then echo "Set NAME=<pipeline>. See 'make list'."; exit 2; fi
	@eval "$$($(UV_RUN) python -m deploy.snow_env $(CONN))" && \
	  ds="$(DATASET)"; ds="$${ds:-$$DLT_DEV_DATASET}"; \
	  DLT_REGISTRY_SOURCE=yaml DLT_DESTINATION=snowflake \
	  DESTINATION__SNOWFLAKE__CREDENTIALS__ROLE=$(DEV_ROLE) SNOWFLAKE_ROLE=$(DEV_ROLE) \
	  DESTINATION__SNOWFLAKE__CREDENTIALS__WAREHOUSE=$(DEV_WH) SNOWFLAKE_WAREHOUSE=$(DEV_WH) \
	  DESTINATION__SNOWFLAKE__CREDENTIALS__DATABASE=$(SF_DATABASE) DLT_DATASET="$$ds" \
	  $(UV_RUN) python -m pipelines.run $(NAME) && \
	  echo "Ran '$(NAME)' -> $(SF_DATABASE).$$ds as $(DEV_ROLE) using snow connection '$(CONN)'."

##@ Snowflake apply (live; requires a snow connection)

sync-apply: sync-sql ## Apply build/sync.sql to the account
	@$(call hdr,Sync registry -> DLT_DB.OPS.PIPELINE_REGISTRY)
	@$(SNOW) -f build/sync.sql > build/sync.out 2>&1 \
	  && printf '\033[0;32m✓ synced %s pipeline(s)\033[0m \033[2m(full log: build/sync.out)\033[0m\n' "$$(grep -c 'MERGE INTO' build/sync.sql)" \
	  || { printf '\033[0;31m✗ sync failed\033[0m\n'; cat build/sync.out; exit 1; }

tasks-apply: tasks-sql ## Apply build/tasks.sql to the account
	@$(call hdr,Apply per-pipeline Tasks)
	@$(SNOW) -f build/tasks.sql > build/tasks.out 2>&1 \
	  && printf '\033[0;32m✓ applied %s task(s)\033[0m \033[2m(full log: build/tasks.out)\033[0m\n' "$$(grep -c 'CREATE OR ALTER TASK' build/tasks.sql)" \
	  || { printf '\033[0;31m✗ tasks apply failed\033[0m\n'; cat build/tasks.out; exit 1; }

deploy: sync-apply tasks-apply ## Sync registry + apply Tasks (Tasks created SUSPENDED)
	@echo "Deployed. Tasks are created SUSPENDED by design - resume when ready, e.g.:"
	@echo "  snow sql -q \"ALTER TASK dlt_task_pg_public RESUME;\""

##@ Cleanup

clean: ## Remove .venv, build artifacts, caches, and local DuckDB files
	rm -rf .venv build .pytest_cache
	find . -type d -name __pycache__ -prune -exec rm -rf {} +
	rm -f *.duckdb

clean-docs: ## Remove the docs site node_modules
	rm -rf $(DOCS_DIR)/node_modules
