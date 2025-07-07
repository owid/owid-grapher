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

.PHONY: help lerna up up.full down refresh refresh.wp refresh.full migrate svgtest

help:
	@echo 'Available commands:'
	@echo
	@echo '  GRAPHER ONLY'
	@echo '  make up                     start dev environment via docker-compose and tmux'
	@echo '  make down                   stop any services still running'
	@echo '  make refresh                (while up) download a new grapher snapshot and update MySQL'
	@echo '  make refresh.pageviews      (while up) download and load pageviews from the private datasette instance'
	@echo '  make refresh.full           (while up) run refresh and refresh.pageviews'
	@echo '  make migrate                (while up) run any outstanding db migrations'
	@echo '  make test                   run full suite (except db tests) of CI checks including unit tests'
	@echo '  make dbtest                 run db test suite that needs a running mysql db'
	@echo '  make svgtest                compare current rendering against reference SVGs'
	@echo '  make local-bake             do a full local site bake'
	@echo '  make archive                create an archived version of our charts'
	@echo
	@echo '  GRAPHER + CLOUDFLARE (staff-only)'
	@echo '  make up.full                start dev environment via docker-compose and tmux'
	@echo '  make update.chart-entities  update the charts_x_entities join table'
	@echo '  make reindex                reindex (or initialise) search in Algolia'
	@echo '  make bench.search           run search benchmarks'
	@echo '  make sync-cloudflare-images sync Cloudflare Images with local DB'

up: export DEBUG = 'knex:query'

up: require create-if-missing.env tmp-downloads/owid_metadata.sql.gz lerna
	@make validate.env
	@make check-port-3306

	@if tmux has-session -t grapher 2>/dev/null; then \
		echo '==> Killing existing tmux session'; \
		tmux kill-session -t grapher; \
	fi

	@echo '==> Starting dev environment'
	@mkdir -p logs
	tmux new-session -s grapher \
		-n docker 'docker compose -f docker-compose.grapher.yml up' \; \
			set remain-on-exit on \; \
		set-option -g default-shell $(SCRIPT_SHELL) \; \
		new-window -n admin \
			'devTools/docker/wait-for-mysql.sh && yarn startAdminDevServer' \; \
			set remain-on-exit on \; \
		new-window -n vite 'yarn run startSiteFront' \; \
			set remain-on-exit on \; \
		new-window -n lerna 'yarn startLernaWatcher' \; \
			set remain-on-exit on \; \
		new-window -n welcome 'devTools/docker/banner.sh; exec $(LOGIN_SHELL)' \; \
		bind R respawn-pane -k \; \
		bind X kill-pane \; \
		bind Q kill-server \; \
		set -g mouse on \
		|| make down

up.devcontainer: create-if-missing.env.devcontainer tmp-downloads/owid_metadata.sql.gz lerna
	@make validate.env
	@make check-port-3306

	@echo '==> Starting dev environment'
	@mkdir -p logs
	tmux new-session -s grapher \
		-n admin \
			'devTools/docker/wait-for-mysql.sh && yarn startAdminDevServer' \; \
			set remain-on-exit on \; \
		new-window -n vite 'yarn run startSiteFront' \; \
			set remain-on-exit on \; \
		new-window -n lerna 'yarn startLernaWatcher' \; \
			set remain-on-exit on \; \
		new-window -n welcome 'devTools/docker/banner.sh; exec $(LOGIN_SHELL)' \; \
		bind R respawn-pane -k \; \
		bind X kill-pane \; \
		bind Q kill-server

up.full: export DEBUG = 'knex:query'

up.full: require create-if-missing.env.full tmp-downloads/owid_metadata.sql.gz lerna
	@make validate.env.full
	@make check-port-3306

	@if tmux has-session -t grapher 2>/dev/null; then \
		echo '==> Killing existing tmux session'; \
		tmux kill-session -t grapher; \
	fi

	@echo '==> Starting dev environment'
	tmux new-session -s grapher \
		-n docker 'docker compose -f docker-compose.grapher.yml up' \; \
			set remain-on-exit on \; \
		set-option -g default-shell $(SCRIPT_SHELL) \; \
		new-window -n admin \
			'devTools/docker/wait-for-mysql.sh && yarn startAdminDevServer' \; \
			set remain-on-exit on \; \
		new-window -n vite 'yarn run startSiteFront' \; \
			set remain-on-exit on \; \
		new-window -n lerna 'yarn startLernaWatcher' \; \
			set remain-on-exit on \; \
		new-window -n functions 'yarn startLocalCloudflareFunctions' \; \
			set remain-on-exit on \; \
		new-window -n welcome 'devTools/docker/banner.sh; exec $(LOGIN_SHELL)' \; \
		bind R respawn-pane -k \; \
		bind X kill-pane \; \
		bind Q kill-server \; \
		set -g mouse on \
		|| make down

migrate: lerna
	@echo '==> Running DB migrations'
	yarn runDbMigrations

refresh:
	@if grep -q "ENV=production" .env; then \
		echo "ERROR: Cannot run refresh in production environment."; \
		exit 1; \
	fi

	@echo '==> Downloading chart data'
	./devTools/docker/download-grapher-metadata-mysql.sh

	@echo '==> Updating grapher database'
	DATA_FOLDER=tmp-downloads ./devTools/docker/refresh-grapher-data.sh

	@echo '!!! If you use ETL, wipe indicators from your R2 staging with `rclone delete r2:owid-api-staging/[yourname]/ ' \
	'--fast-list --transfers 32 --checkers 32  --verbose`'

refresh.pageviews: node_modules
	@echo '==> Refreshing pageviews'
	yarn refreshPageviews

sync-images:
	@echo 'Task has been deprecated.'

bake-images:
	@echo 'Task has been deprecated.'

# Only needed to run once to seed the prod DB with initially
sync-cloudflare-images: node_modules
	@echo '==> Syncing images table with Cloudflare Images'
	@yarn syncCloudflareImages

refresh.full: refresh refresh.pageviews
	@echo '==> Full refresh completed'

down:
	@echo '==> Stopping services'
	docker compose -f docker-compose.grapher.yml down

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

tmp-downloads/owid_metadata.sql.gz:
	@echo '==> Downloading metadata'
	./devTools/docker/download-grapher-metadata-mysql.sh

test: node_modules
	@echo '==> Linting'
	yarn run eslint

	@echo '==> Checking formatting'
	yarn testPrettierAll

	@echo '==> Running tests'
	yarn run test

dbtest: node_modules
	@echo '==> Running db test script'
	./db/tests/run-db-tests.sh

lint: node_modules
	@echo '==> Linting'
	yarn run eslint

check-formatting: node_modules
	@echo '==> Checking formatting'
	yarn testPrettierAll

format: node_modules
	@echo '==> Fixing formatting'
	yarn fixPrettierAll

unittest: node_modules
	@echo '==> Running tests'
	yarn run test

../owid-grapher-svgs:
	cd .. && git clone git@github.com:owid/owid-grapher-svgs

svgtest: ../owid-grapher-svgs lerna
	@echo '==> Comparing against reference SVGs'

	@# get ../owid-grapher-svgs reliably to a base state at origin/master
	cd ../owid-grapher-svgs && git fetch && git checkout -f master && git reset --hard origin/master && git clean -fd

	@# generate a full new set of svgs and create an HTML report if there are differences
	yarn tsx --tsconfig tsconfig.tsx.json devTools/svgTester/verify-graphs.ts \
		|| yarn tsx --tsconfig tsconfig.tsx.json devTools/svgTester/create-compare-view.ts

node_modules: package.json yarn.lock yarn.config.cjs
	@echo '==> Installing packages'
	yarn install
	touch -m $@

lerna: node_modules
	@echo '==> Running Lerna'
	yarn lerna run build

update.chart-entities: lerna
	@echo '==> Updating chart entities table'
	yarn tsx --tsconfig tsconfig.tsx.json baker/updateChartEntities.js --all

reindex: lerna
	@echo '==> Reindexing search in Algolia'
	@echo '--- Running configureAlgolia...'
	yarn tsx --tsconfig tsconfig.tsx.json baker/algolia/configureAlgolia.js
	@echo '--- Running indexPagesToAlgolia...'
	yarn tsx --tsconfig tsconfig.tsx.json baker/algolia/indexPagesToAlgolia.js
	@echo '--- Running indexChartsToAlgolia...'
	yarn tsx --tsconfig tsconfig.tsx.json baker/algolia/indexChartsToAlgolia.js
	@echo '--- Running indexExplorerViewsMdimViewsAndChartsToAlgolia...'
	yarn tsx --tsconfig tsconfig.tsx.json baker/algolia/indexExplorerViewsMdimViewsAndChartsToAlgolia.js

delete-algolia-index: lerna
	@echo '==> Deleting Algolia index'
	yarn tsx --tsconfig tsconfig.tsx.json baker/algolia/deleteAlgoliaIndex.js

bench.search: lerna
	@echo '==> Running search benchmarks'
	@yarn tsx --tsconfig tsconfig.tsx.json site/search/evaluateSearch.js

local-bake: lerna
	@echo '==> Baking site'
	yarn buildVite
	yarn buildLocalBake

archive: lerna
	@echo '==> Creating an archived version of our charts'
	PRIMARY_ENV_FILE=.env.archive yarn buildViteArchive
	PRIMARY_ENV_FILE=.env.archive yarn tsx --tsconfig tsconfig.tsx.json ./baker/archival/archiveChangedPages.ts --latestDir

clean:
	rm -rf node_modules
