#
#  Makefile
#

# this is horrible magic, we use it to open a nice welcome message for
# the user in tmux in the shell that they normally use (e.g. bash, zsh)
# https://unix.stackexchange.com/questions/352316/finding-out-the-default-shell-of-a-user-within-a-shell-script
LOGIN_SHELL = $(shell finger $(USER) | grep 'Shell:*' | cut -f3 -d ":")

# Check for the environment variable OWID_SCRIPT_SHELL and fall back to LOGIN_SHELL if not set
SCRIPT_SHELL ?= $(or $(shell echo $$OWID_SCRIPT_SHELL),$(LOGIN_SHELL))


# setting .env variables as Make variables for validate.env targets
# https://lithic.tech/blog/2020-05/makefile-dot-env/
ifneq (,$(wildcard ./.env))
	include .env
endif

# .env lines with inline comments (`FOO=bar  # baz`) keep the spaces before the
# `#` in the value when included by make — strip the variables we interpolate
# into container names, session names and URLs. The ifdef guards keep absent
# variables undefined so the `?=` defaults on the targets still apply.
ifdef COMPOSE_PROJECT_NAME
COMPOSE_PROJECT_NAME := $(strip $(COMPOSE_PROJECT_NAME))
endif
ifdef TMUX_SESSION_NAME
TMUX_SESSION_NAME := $(strip $(TMUX_SESSION_NAME))
endif
ifdef VITE_PORT
VITE_PORT := $(strip $(VITE_PORT))
endif
ifdef WRANGLER_PORT
WRANGLER_PORT := $(strip $(WRANGLER_PORT))
endif

.PHONY: help up up.headless up.full down down.headless refresh refresh.wp refresh.private refresh.full migrate svgtest svgtest.reset svgtest.graphers svgtest.grapher-views svgtest.mdims svgtest.explorers svgtest.thumbnails bdd bdd.ui check-not-prod

help:
	@echo 'Available commands:'
	@echo
	@echo '  GRAPHER ONLY'
	@echo '  make up                     start dev environment via docker-compose and tmux'
	@echo '  make up.headless            start dev environment without tmux (AI agents, cloud sandboxes, CI)'
	@echo '  make down                   stop any services still running'
	@echo '  make down.headless          stop services started by make up.headless'
	@echo '  make refresh                (while up) download a new grapher snapshot and update MySQL'
	@echo '  make refresh.private        (while up) download and load the private sidecar dump: admin keys + analytics (needs access)'
	@echo '  make refresh.full           (while up) run refresh and refresh.private'
	@echo '  make migrate                (while up) run any outstanding db migrations'
	@echo '  make test                   run full suite (except db tests) of CI checks including unit tests'
	@echo '  make dbtest                 run db test suite that needs a running mysql db'
	@echo '  make playwright-browsers    install Playwright browsers'
	@echo '  make bdd                    (while up) start BDD test environment'
	@echo '  make bdd.ui                 (while up) start BDD test environment with UI'
	@echo '  make svgtest                generate an SVG test report for graphers'
	@echo '  make svgtest.full           generate a full SVG test report'
	@echo '  make svgtest.explorers      generate an SVG test report for explorers only'
	@echo '  make local-bake             do a full local site bake'
	@echo '  make archive                create an archived version of our charts'
	@echo '  make wikipedia-archive      create a Wikipedia archive (strips GTM, rewrites archive URLs)'
	@echo
	@echo '  GRAPHER + CLOUDFLARE (staff-only)'
	@echo '  make up.full                start dev environment via docker-compose and tmux'
	@echo '  make update.chart-entities  update the charts_x_entities join table'
	@echo '  make reindex                reindex (or initialise) search in Algolia'
	@echo '  make bench.search           run search benchmarks'
	@echo '  make sync-cloudflare-images sync Cloudflare Images with local DB'

up: export DEBUG = 'knex:query'
up: export COMPOSE_PROJECT_NAME ?= owid-grapher
up: export TMUX_SESSION_NAME ?= grapher
up: export ADMIN_SERVER_PORT ?= 3030
up: export VITE_PORT ?= 8090

up: require create-if-missing.env tmp-downloads/owid_metadata.sql.gz node_modules
	@make validate.env
	@make check-port-3306

	@if tmux has-session -t $(TMUX_SESSION_NAME) 2>/dev/null; then \
		echo '==> Killing existing tmux session'; \
		tmux kill-session -t $(TMUX_SESSION_NAME); \
	fi

	@echo '==> Starting dev environment'
	@mkdir -p logs
	tmux new-session -s $(TMUX_SESSION_NAME) \
		-n docker 'COMPOSE_PROJECT_NAME=$(COMPOSE_PROJECT_NAME) docker compose -f docker-compose.grapher.yml up' \; \
			set remain-on-exit on \; \
		set-option -g default-shell $(SCRIPT_SHELL) \; \
		new-window -n admin \
			'ADMIN_SERVER_PORT=$(ADMIN_SERVER_PORT) devTools/docker/wait-for-mysql.sh && ADMIN_SERVER_PORT=$(ADMIN_SERVER_PORT) yarn startAdminDevServer' \; \
			set remain-on-exit on \; \
		new-window -n vite 'VITE_PORT=$(VITE_PORT) yarn run startSiteFront' \; \
			set remain-on-exit on \; \
		new-window -n welcome 'ADMIN_SERVER_PORT=$(ADMIN_SERVER_PORT) VITE_PORT=$(VITE_PORT) devTools/docker/banner.sh; exec $(LOGIN_SHELL)' \; \
		bind R respawn-pane -k \; \
		bind X kill-pane \; \
		bind Q kill-server \; \
		set -g mouse on \
		|| make down

up.devcontainer: export TMUX_SESSION_NAME ?= grapher
up.devcontainer: export ADMIN_SERVER_PORT ?= 3030
up.devcontainer: export VITE_PORT ?= 8090

up.devcontainer: create-if-missing.env.devcontainer tmp-downloads/owid_metadata.sql.gz node_modules
	@make validate.env
	@make check-port-3306

	@echo '==> Starting dev environment'
	@mkdir -p logs
	tmux new-session -s $(TMUX_SESSION_NAME) \
		-n admin \
			'ADMIN_SERVER_PORT=$(ADMIN_SERVER_PORT) devTools/docker/wait-for-mysql.sh && ADMIN_SERVER_PORT=$(ADMIN_SERVER_PORT) yarn startAdminDevServer' \; \
			set remain-on-exit on \; \
		new-window -n vite 'VITE_PORT=$(VITE_PORT) yarn run startSiteFront' \; \
			set remain-on-exit on \; \
		new-window -n welcome 'ADMIN_SERVER_PORT=$(ADMIN_SERVER_PORT) VITE_PORT=$(VITE_PORT) devTools/docker/banner.sh; exec $(LOGIN_SHELL)' \; \
		bind R respawn-pane -k \; \
		bind X kill-pane \; \
		bind Q kill-server

up.headless: export COMPOSE_PROJECT_NAME ?= owid-grapher
up.headless: export ADMIN_SERVER_PORT ?= 3030
up.headless: export VITE_PORT ?= 8090
# never wait on an interactive prompt when corepack fetches yarn
up.headless: export COREPACK_ENABLE_DOWNLOAD_PROMPT ?= 0

# Headless variant of `make up` for environments without a terminal to attach
# tmux to (AI agents, cloud sandboxes, CI). Starts MySQL via docker compose and
# runs the admin server and vite as background processes logging into logs/.
up.headless: require.headless create-if-missing.env tmp-downloads/owid_metadata.sql.gz node_modules
	@make validate.env

	@mkdir -p logs
	@docker info >/dev/null 2>&1 || { \
		echo '==> Docker daemon not running, attempting to start it'; \
		service docker start >/dev/null 2>&1 || sudo service docker start >/dev/null 2>&1 || true; \
		docker info >/dev/null 2>&1 || { \
			echo '==> service start failed, launching dockerd directly'; \
			nohup dockerd > logs/dockerd.log 2>&1 & \
		}; \
		for i in $$(seq 1 15); do docker info >/dev/null 2>&1 && break; sleep 2; done; \
		docker info >/dev/null 2>&1 || { echo 'ERROR: docker daemon is not running and could not be started (on macOS, start Docker Desktop; see logs/dockerd.log otherwise)'; exit 1; }; \
	}

	@echo '==> Starting MySQL via docker compose'
	COMPOSE_PROJECT_NAME=$(COMPOSE_PROJECT_NAME) docker compose -f docker-compose.grapher.yml up -d

	@make wait-for-mysql.headless

	@echo '==> (Re)starting the admin server and vite in the background'
	@pkill -f 'adminSiteServer/app.ts' 2>/dev/null || true
	@pkill -f 'vite dev --config vite.config-site.mts' 2>/dev/null || true
	@ADMIN_SERVER_PORT=$(ADMIN_SERVER_PORT) nohup yarn startAdminDevServer > logs/admin-server.log 2>&1 & echo $$! > logs/admin-server.pid
	@VITE_PORT=$(VITE_PORT) nohup yarn startSiteFront > logs/vite.log 2>&1 & echo $$! > logs/vite.pid

	@echo '==> Waiting for the admin server to come up (can take a few minutes)'
	@for i in $$(seq 1 180); do \
		if curl -sf -o /dev/null http://localhost:$(ADMIN_SERVER_PORT)/; then break; fi; \
		if [ $$i -eq 180 ]; then echo 'ERROR: admin server did not come up, check logs/admin-server.log'; exit 1; fi; \
		printf '.'; sleep 2; \
	done
	@echo
	@echo 'Dev environment is up (logs in logs/, stop with `make down.headless`):'
	@echo
	@echo "    http://localhost:$(ADMIN_SERVER_PORT)/  <-- a basic version of Our World in Data"
	@echo "    http://localhost:$(ADMIN_SERVER_PORT)/grapher/life-expectancy  <-- an example chart"
	@echo "    http://localhost:$(ADMIN_SERVER_PORT)/admin/  <-- an admin interface"
	@echo "    http://localhost:$(VITE_PORT)/  <-- the vite dev server"

wait-for-mysql.headless: export COMPOSE_PROJECT_NAME ?= owid-grapher

# Like devTools/docker/wait-for-mysql.sh, but runs the mysql client inside the
# db container so it works on hosts without a mysql client installed. Waits for
# the db-load-data init container to exit first: the grapher db and user exist
# before the dump import finishes, so a bare `select 1` passes too early.
wait-for-mysql.headless:
	@echo '==> Waiting for the db init container ($(COMPOSE_PROJECT_NAME)-db-load-data-1) to finish (the first run imports the db dump and can take 5-15 minutes)'
	@for i in $$(seq 1 240); do \
		if [ "$$(docker inspect -f '{{.State.Status}}' $(COMPOSE_PROJECT_NAME)-db-load-data-1 2>/dev/null)" = "exited" ]; then break; fi; \
		if [ $$i -eq 240 ]; then echo; echo 'ERROR: db init container did not finish, current containers:'; docker ps -a; exit 1; fi; \
		printf '.'; sleep 5; \
	done
	@test "$$(docker inspect -f '{{.State.ExitCode}}' $(COMPOSE_PROJECT_NAME)-db-load-data-1)" = "0" \
		|| { echo "ERROR: db load failed, check: docker logs $(COMPOSE_PROJECT_NAME)-db-load-data-1"; exit 1; }
	@until COMPOSE_PROJECT_NAME=$(COMPOSE_PROJECT_NAME) docker compose -f docker-compose.grapher.yml exec -T db \
		mysql -u$(GRAPHER_DB_USER) -p$(GRAPHER_DB_PASS) -h 127.0.0.1 -e 'select 1' $(GRAPHER_DB_NAME) >/dev/null 2>&1; \
		do printf '.'; sleep 2; done
	@echo ' ok'

down.headless: export COMPOSE_PROJECT_NAME ?= owid-grapher

down.headless:
	@echo '==> Stopping background dev servers'
	@pkill -f 'adminSiteServer/app.ts' 2>/dev/null || true
	@pkill -f 'vite dev --config vite.config-site.mts' 2>/dev/null || true
	@make down

require.headless:
	@echo '==> Checking your environment has the necessary commands...'
	@which docker >/dev/null 2>&1 || (echo "ERROR: docker compose is required."; exit 1)
	@which yarn >/dev/null 2>&1 || (echo "ERROR: yarn is required."; exit 1)

up.full: export DEBUG = 'knex:query'
up.full: export COMPOSE_PROJECT_NAME ?= owid-grapher
up.full: export TMUX_SESSION_NAME ?= grapher
up.full: export ADMIN_SERVER_PORT ?= 3030
up.full: export VITE_PORT ?= 8090
up.full: export WRANGLER_PORT ?= 8788

up.full: require create-if-missing.env.full tmp-downloads/owid_metadata.sql.gz node_modules
	@make validate.env.full
	@make check-port-3306

	@if tmux has-session -t $(TMUX_SESSION_NAME) 2>/dev/null; then \
		echo '==> Killing existing tmux session'; \
		tmux kill-session -t $(TMUX_SESSION_NAME); \
	fi

	@echo '==> Starting dev environment'
	tmux new-session -s $(TMUX_SESSION_NAME) \
		-n docker 'COMPOSE_PROJECT_NAME=$(COMPOSE_PROJECT_NAME) docker compose -f docker-compose.grapher.yml up' \; \
			set remain-on-exit on \; \
		set-option -g default-shell $(SCRIPT_SHELL) \; \
		new-window -n admin \
			'ADMIN_SERVER_PORT=$(ADMIN_SERVER_PORT) devTools/docker/wait-for-mysql.sh && ADMIN_SERVER_PORT=$(ADMIN_SERVER_PORT) yarn startAdminDevServer' \; \
			set remain-on-exit on \; \
		new-window -n vite 'VITE_PORT=$(VITE_PORT) yarn run startSiteFront' \; \
			set remain-on-exit on \; \
		new-window -n functions 'WRANGLER_PORT=$(WRANGLER_PORT) yarn startLocalCloudflareFunctions' \; \
			set remain-on-exit on \; \
		new-window -n bespoke 'yarn startBespokeDevServer' \; \
			set remain-on-exit on \; \
		new-window -n welcome 'ADMIN_SERVER_PORT=$(ADMIN_SERVER_PORT) VITE_PORT=$(VITE_PORT) WRANGLER_PORT=$(WRANGLER_PORT) devTools/docker/banner.sh --full; exec $(LOGIN_SHELL)' \; \
		bind R respawn-pane -k \; \
		bind X kill-pane \; \
		bind Q kill-server \; \
		set -g mouse on \
		|| make down

migrate: node_modules
	@echo '==> Running DB migrations'
	yarn runDbMigrations

refresh:
	@make check-not-prod

	@echo '==> Downloading chart data'
	./devTools/docker/download-grapher-metadata-mysql.sh

	@echo '==> Updating grapher database'
	DATA_FOLDER=tmp-downloads ./devTools/docker/refresh-grapher-data.sh

	@echo '!!! If you use ETL, wipe indicators from your R2 staging with `rclone delete r2:owid-api-staging/[yourname]/ ' \
	'--fast-list --transfers 32 --checkers 32  --verbose`'

refresh.atomic:
	@make check-not-prod

	@echo '==> Downloading chart data'
	./devTools/docker/download-grapher-metadata-mysql.sh

	@echo '==> Downloading private sidecar dump'
	./devTools/docker/download-grapher-private-mysql.sh

	@echo '==> Updating grapher database (atomic swap)'
	DATA_FOLDER=tmp-downloads ./devTools/docker/atomic-grapher-data.sh

	@echo '!!! If you use ETL, wipe indicators from your R2 staging with `rclone delete r2:owid-api-staging/[yourname]/ ' \
	'--fast-list --transfers 32 --checkers 32  --verbose`'

refresh.private:
	@make check-not-prod

	@echo '==> Downloading private sidecar dump'
	./devTools/docker/download-grapher-private-mysql.sh

	@echo '==> Refreshing private tables'
	DATA_FOLDER=tmp-downloads ./devTools/docker/refresh-private-data.sh

sync-images:
	@echo 'Task has been deprecated.'

bake-images:
	@echo 'Task has been deprecated.'

# Only needed to run once to seed the prod DB with initially
sync-cloudflare-images: node_modules
	@echo '==> Syncing images table with Cloudflare Images'
	@yarn syncCloudflareImages

refresh.full: refresh refresh.private
	@echo '==> Full refresh completed'

down: export COMPOSE_PROJECT_NAME ?= owid-grapher

down:
	@echo '==> Stopping services'
	COMPOSE_PROJECT_NAME=$(COMPOSE_PROJECT_NAME) docker compose -f docker-compose.grapher.yml down

require:
	@echo '==> Checking your local environment has the necessary commands...'
	@which docker >/dev/null 2>&1 || (echo "ERROR: docker compose is required."; exit 1)
	@which yarn >/dev/null 2>&1 || (echo "ERROR: yarn is required."; exit 1)
	@which tmux >/dev/null 2>&1 || (echo "ERROR: tmux is required."; exit 1)
	@which finger >/dev/null 2>&1 || (echo "ERROR: finger is required."; exit 1)

guard-%:
	@if [ -z "${${*}}" ]; then echo 'ERROR: .env variable $* not set' && exit 1; fi

create-if-missing.env:
	@if test ! -f .env; then \
		echo 'Copying .env.example-grapher --> .env'; \
		cp .env.example-grapher .env; \
	fi

create-if-missing.env.devcontainer:
	@if test ! -f .env; then \
		echo 'Copying .env.devcontainer --> .env'; \
		cp .env.devcontainer .env; \
	fi

validate.env:
	@echo '==> Validating your .env file for make up'
	@grep '=' .env.example-grapher | grep -v optional | sed 's/=.*//' | while read variable; \
		do make guard-$$variable 2>/dev/null || exit 1; \
	done
	@echo '.env file valid for make up'

create-if-missing.env.full:
	@if test ! -f .env; then \
		echo 'Copying .env.example-full --> .env'; \
		cp .env.example-full .env; \
	fi

validate.env.full:
	@echo '==> Validating your .env file for make up.full'
	@grep '=' .env.example-full | grep -v optional | sed 's/=.*//' | while read variable; \
		do make guard-$$variable 2>/dev/null || exit 1; \
	done
	@echo '.env file valid for make up.full'

check-port-3306:
	@echo "==> Checking port"
	@if [ "${GRAPHER_DB_PORT}" = "3306" ]; then \
		echo "Your database port is set to 3306.\
		\nThis will likely conflict with any pre-existing MySQL instances you have running.\
		\nWe recommend using a different port (like 3307)";\
	fi

check-not-prod:
	@if grep -q "ENV=production" .env; then \
		echo "ERROR: Cannot run this command in production environment."; \
		exit 1; \
	fi
	@if [ "${GRAPHER_DB_HOST}" = "prod-db.owid.io" ]; then \
		echo "ERROR: GRAPHER_DB_HOST is set to prod-db.owid.io. Refusing to run against the production database."; \
		exit 1; \
	fi

tmp-downloads/owid_metadata.sql.gz:
	@echo '==> Downloading metadata'
	./devTools/docker/download-grapher-metadata-mysql.sh

test: node_modules
	@echo '==> Linting'
	yarn testLint

	@echo '==> Checking formatting'
	yarn testFormatAll

	@echo '==> Checking Raycast snippets'
	yarn checkRaycastSnippets

	@echo '==> Running tests'
	yarn run test

dbtest: node_modules
	@echo '==> Running db test script'
	./db/tests/run-db-tests.sh

playwright-browsers:
	@echo '==> Installing Playwright browsers'
	yarn playwright install --with-deps --no-shell

bdd: export TMUX_SESSION_NAME ?= bdd

bdd: node_modules playwright-browsers
	@if tmux has-session -t $(TMUX_SESSION_NAME) 2>/dev/null; then \
		echo '==> Killing existing tmux session'; \
		tmux kill-session -t $(TMUX_SESSION_NAME); \
	fi

	@echo '==> Starting BDD test environment'
	@yarn bddgen
	tmux new-session -s $(TMUX_SESSION_NAME) \
		-n watcher 'yarn chokidar "features/**" "site/**/*.{ts,tsx}" -c "yarn bddgen"' \; \
			set remain-on-exit on \; \
		set-option -g default-shell $(SCRIPT_SHELL) \; \
		new-window -n playwright 'PWTEST_WATCH=1 yarn playwright test' \; \
			set remain-on-exit on \; \
		new-window -n welcome 'devTools/docker/banner-bdd.sh; exec $(LOGIN_SHELL)' \; \
		bind R respawn-pane -k \; \
		bind X kill-pane \; \
		bind K kill-session \; \
		set -g mouse on

bdd.ui: export TMUX_SESSION_NAME ?= bdd-ui

bdd.ui: node_modules playwright-browsers
	@if tmux has-session -t $(TMUX_SESSION_NAME) 2>/dev/null; then \
		echo '==> Killing existing tmux session'; \
		tmux kill-session -t $(TMUX_SESSION_NAME); \
	fi

	@echo '==> Starting BDD test environment with UI'
	@yarn bddgen
	tmux new-session -s $(TMUX_SESSION_NAME) \
		-n watcher 'yarn chokidar "features/**" "site/**/*.{ts,tsx}" -c "yarn bddgen"' \; \
			set remain-on-exit on \; \
		set-option -g default-shell $(SCRIPT_SHELL) \; \
		new-window -n playwright 'yarn playwright test --ui --ui-host=0.0.0.0' \; \
			set remain-on-exit on \; \
		new-window -n welcome 'devTools/docker/banner-bdd.sh; exec $(LOGIN_SHELL)' \; \
		bind R respawn-pane -k \; \
		bind X kill-pane \; \
		bind K kill-session \; \
		set -g mouse on

lint: node_modules
	@echo '==> Linting'
	yarn testLint

check-formatting: node_modules
	@echo '==> Checking formatting'
	yarn testFormatAll

format: node_modules
	@echo '==> Fixing formatting'
	yarn fixFormatAll

unittest: node_modules
	@echo '==> Running tests'
	yarn run test

../owid-grapher-svgs:
	cd .. && git clone git@github.com:owid/owid-grapher-svgs

svgtest.reset: ../owid-grapher-svgs
	@echo '==> Resetting owid-grapher-svgs repo to a clean state'
	cd ../owid-grapher-svgs && git fetch && git checkout -f master && git reset --hard origin/master && git clean -fd

svgtest: svgtest.reset node_modules
	@echo '==> Generating SVG test report for graphers'

	@# generate a full new set of svgs and create an HTML report if there are differences
	yarn tsx --tsconfig tsconfig.tsx.json devTools/svgTester/verify-graphs.ts \
		|| (yarn tsx --tsconfig tsconfig.tsx.json devTools/svgTester/create-compare-view.ts && open ../owid-grapher-svgs/graphers/differences.html)

svgtest.full: svgtest.reset node_modules
	@echo '==> Generating full SVG test report'

	@# run test suite for stand-alone graphers
	yarn tsx --tsconfig tsconfig.tsx.json devTools/svgTester/verify-graphs.ts \
		|| yarn tsx --tsconfig tsconfig.tsx.json devTools/svgTester/create-compare-view.ts

	@# run test suite for grapher views
	yarn tsx --tsconfig tsconfig.tsx.json devTools/svgTester/verify-graphs.ts grapher-views \
		|| yarn tsx --tsconfig tsconfig.tsx.json devTools/svgTester/create-compare-view.ts grapher-views

	@# run test suite for mdims
	yarn tsx --tsconfig tsconfig.tsx.json devTools/svgTester/verify-graphs.ts mdims \
		|| yarn tsx --tsconfig tsconfig.tsx.json devTools/svgTester/create-compare-view.ts mdims

	@# run test suite for explorers
	yarn tsx --tsconfig tsconfig.tsx.json devTools/svgTester/verify-graphs.ts explorers --manifest top.manifest.json \
		|| yarn tsx --tsconfig tsconfig.tsx.json devTools/svgTester/create-compare-view.ts explorers

	@# run test suite for thumbnails
	yarn tsx --tsconfig tsconfig.tsx.json devTools/svgTester/verify-graphs.ts thumbnails \
		|| yarn tsx --tsconfig tsconfig.tsx.json devTools/svgTester/create-compare-view.ts thumbnails

svgtest.grapher-views: svgtest.reset node_modules
	@echo '==> Generating SVG test report for grapher-views'

	@# run test suite for grapher-views and create an HTML report if there are differences
	yarn tsx --tsconfig tsconfig.tsx.json devTools/svgTester/verify-graphs.ts grapher-views \
		|| (yarn tsx --tsconfig tsconfig.tsx.json devTools/svgTester/create-compare-view.ts grapher-views && open ../owid-grapher-svgs/grapher-views/differences.html)

svgtest.mdims: svgtest.reset node_modules
	@echo '==> Generating SVG test report for mdims'

	@# run test suite for mdims and create an HTML report if there are differences
	yarn tsx --tsconfig tsconfig.tsx.json devTools/svgTester/verify-graphs.ts mdims \
		|| (yarn tsx --tsconfig tsconfig.tsx.json devTools/svgTester/create-compare-view.ts mdims && open ../owid-grapher-svgs/mdims/differences.html)

svgtest.explorers: svgtest.reset node_modules
	@echo '==> Generating SVG test report for explorers'

	@# run test suite for explorers and create an HTML report if there are differences
	yarn tsx --tsconfig tsconfig.tsx.json devTools/svgTester/verify-graphs.ts explorers \
		|| (yarn tsx --tsconfig tsconfig.tsx.json devTools/svgTester/create-compare-view.ts explorers && open ../owid-grapher-svgs/explorers/differences.html)

svgtest.thumbnails: svgtest.reset node_modules
	@echo '==> Generating SVG test report for thumbnails'

	@# run test suite for thumbnails and create an HTML report if there are differences
	yarn tsx --tsconfig tsconfig.tsx.json devTools/svgTester/verify-graphs.ts thumbnails \
		|| (yarn tsx --tsconfig tsconfig.tsx.json devTools/svgTester/create-compare-view.ts thumbnails && open ../owid-grapher-svgs/thumbnails/differences.html)

node_modules: package.json yarn.lock yarn.config.cjs
	@echo '==> Installing packages'
	yarn install
	touch -m $@

update.chart-entities: node_modules
	@echo '==> Updating chart entities table'
	yarn tsx --tsconfig tsconfig.tsx.json baker/updateChartEntities.js --all

reindex: node_modules
	@echo '==> Reindexing search in Algolia'
	@echo '--- Running configureAlgolia...'
	yarn tsx --tsconfig tsconfig.tsx.json baker/algolia/configureAlgolia.js
	@echo '--- Running indexPagesToAlgolia...'
	yarn tsx --tsconfig tsconfig.tsx.json baker/algolia/indexPagesToAlgolia.js
	@echo '--- Running indexPagesChronologicalToAlgolia...'
	yarn tsx --tsconfig tsconfig.tsx.json baker/algolia/indexPagesChronologicalToAlgolia.js
	@echo '--- Running indexExplorerViewsMdimViewsAndChartsToAlgolia...'
	yarn tsx --tsconfig tsconfig.tsx.json baker/algolia/indexExplorerViewsMdimViewsAndChartsToAlgolia.js

index-scheduled: node_modules
	@echo '==> Indexing scheduled (newly-live) gdocs into the pages-chronological Algolia index'
	yarn tsx --tsconfig tsconfig.tsx.json baker/algolia/indexScheduledPagesChronologicalToAlgolia.js

delete-algolia-index: node_modules
	@echo '==> Deleting Algolia index'
	yarn tsx --tsconfig tsconfig.tsx.json baker/algolia/deleteAlgoliaIndex.js

bench.search: node_modules
	@echo '==> Running search benchmarks'
	@yarn tsx --tsconfig tsconfig.tsx.json site/search/evaluateSearch.js

local-bake: node_modules
	@echo '==> Baking site'
	yarn buildVite
	yarn buildLocalBake

archive: node_modules
	@echo '==> Creating archived page versions'
	PRIMARY_ENV_FILE=.env.archive yarn buildViteArchive
	PRIMARY_ENV_FILE=.env.archive yarn tsx --tsconfig tsconfig.tsx.json ./baker/archival/archiveChangedPages.ts --latestDir

wikipedia-archive: archive
	@echo '==> Creating Wikipedia archive (stripping analytics, rewriting archive URLs)'
	PRIMARY_ENV_FILE=.env.archive yarn tsx --tsconfig tsconfig.tsx.json ./baker/archival/createWikipediaArchive.ts

clean:
	rm -rf node_modules
