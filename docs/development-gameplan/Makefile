# dlt -> Snowflake gameplan docs site
# Uses a random high port each run to avoid conflicts with other local apps.
# Override with: make dev PORT=30000

.PHONY: install dev build preview clean

PORT ?= $(shell awk 'BEGIN{srand();print int(20000+rand()*40000)}')

install:
	npm install

dev:
	@echo "Dev server -> http://localhost:$(PORT)  (also on your LAN IP)"
	PORT=$(PORT) npm run dev -- --port $(PORT)

build:
	npm run build

preview: build
	@echo "Preview -> http://localhost:$(PORT)"
	PORT=$(PORT) npm run preview -- --port $(PORT)

clean:
	rm -rf node_modules dist
