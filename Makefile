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
	export
endif

.PHONY: help up up.full down down.full refresh refresh.wp refresh.full migrate svgtest itsJustJavascript

help:
	@echo 'Available commands:'
	@echo
	@echo '  GRAPHER ONLY'
	@echo '  make up                     start dev environment via docker-compose and tmux'
	@echo '  make down                   stop any services still running'
	@echo '  make refresh                (while up) download a new grapher snapshot and update MySQL'
	@echo '  make refresh.pageviews      (while up) download and load pageviews from the private datasette instance'
	@echo '  make migrate                (while up) run any outstanding db migrations'
	@echo '  make test                   run full suite (except db tests) of CI checks including unit tests'
	@echo '  make dbtest                 run db test suite that needs a running mysql db'
	@echo '  make svgtest                compare current rendering against reference SVGs'
	@echo
	@echo '  GRAPHER + WORDPRESS (staff-only)'
	@echo '  make up.full                start dev environment via docker-compose and tmux'
	@echo '  make down.full              stop any services still running'
	@echo '  make refresh.wp             download a new wordpress snapshot and update MySQL'
	@echo '  make refresh.full           do a full MySQL update of both wordpress and grapher'
	@echo '  make sync-images            sync all images from the remote master'
	@echo '  make update.chart-entities  update the charts_x_entities join table'
	@echo '  make reindex                reindex (or initialise) search in Algolia'
	@echo
	@echo '  OPS (staff-only)'
	@echo '  make deploy                 Deploy your local site to production'
	@echo '  make stage                  Deploy your local site to staging'
	@echo

up: export DEBUG = 'knex:query'

up: require create-if-missing.env ../owid-content tmp-downloads/owid_metadata.sql.gz
	@make validate.env
	@make check-port-3306
	@echo '==> Building grapher'
	yarn install
	yarn lerna run build
	yarn run tsc -b

	@echo '==> Starting dev environment'
	@mkdir -p logs
	tmux new-session -s grapher \
		-n docker 'docker compose -f docker-compose.grapher.yml up' \; \
			set remain-on-exit on \; \
		set-option -g default-shell $(SCRIPT_SHELL) \; \
		new-window -n admin \
			'devTools/docker/wait-for-mysql.sh && yarn run tsc-watch -b --onSuccess "yarn startAdminServer"' \; \
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

up.devcontainer: create-if-missing.env.devcontainer tmp-downloads/owid_metadata.sql.gz
	@make validate.env
	@make check-port-3306
	@echo '==> Building grapher'
	yarn install
	yarn lerna run build
	yarn run tsc -b

	@echo '==> Starting dev environment'
	@mkdir -p logs
	tmux new-session -s grapher \
		-n admin \
			'devTools/docker/wait-for-mysql.sh && yarn run tsc-watch -b --onSuccess "yarn startAdminServer"' \; \
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

up.full: require create-if-missing.env.full ../owid-content wordpress/.env tmp-downloads/owid_metadata.sql.gz tmp-downloads/live_wordpress.sql.gz wordpress/web/app/uploads/2022
	@make validate.env.full
	@make check-port-3306

	@echo '==> Building grapher'
	yarn install
	yarn lerna run build
	yarn run tsc -b
	yarn buildWordpressPlugin

	@echo '==> Starting dev environment'
	tmux new-session -s grapher \
		-n docker 'docker compose -f docker-compose.full.yml up' \; \
			set remain-on-exit on \; \
		set-option -g default-shell $(SCRIPT_SHELL) \; \
		new-window -n admin \
			'devTools/docker/wait-for-mysql.sh && yarn run tsc-watch -b --onSuccess "yarn startAdminServer"' \; \
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
		|| make down.full

migrate:
	@echo '==> Running DB migrations'
	rm -rf itsJustJavascript && yarn && yarn buildLerna && yarn buildTsc && yarn runDbMigrations

refresh.full: refresh refresh.wp sync-images

refresh:
	@echo '==> Downloading chart data'
	./devTools/docker/download-grapher-metadata-mysql.sh

	@echo '==> Updating grapher database'
	@. ./.env && DATA_FOLDER=tmp-downloads ./devTools/docker/refresh-grapher-data.sh

	@echo '!!! If you use ETL, wipe indicators from your R2 staging with `rclone delete r2:owid-api-staging/[yourname]/ ' \
	'--fast-list --transfers 32 --checkers 32  --verbose`'

refresh.pageviews:
	@echo '==> Refreshing pageviews'
	yarn && yarn buildTsc && yarn refreshPageviews

refresh.wp:
	@echo '==> Downloading wordpress data'
	./devTools/docker/download-wordpress-mysql.sh

	@echo '==> Updating wordpress data'
	@. ./.env && DATA_FOLDER=tmp-downloads ./devTools/docker/refresh-wordpress-data.sh

	@echo '!!! WARNING !!!'
	@echo 'If you run this for staging WP, you have to set !Account password! for'
	@echo 'tech@ourworldindata.org user to the value from `.env:WORDPRESS_API_PASS`'
	@echo 'at https://staging.owid.cloud/wp/wp-admin/user-edit.php?user_id=35'

sync-images: sync-images.preflight-check
	@echo '==> Syncing images to R2'
	@. ./.env && ./devTools/docker/sync-s3-images.sh

sync-images.preflight-check:
	@echo '==> Checking for rclone'
	@which rclone >/dev/null 2>&1 || (echo "ERROR: please install rclone -- e.g. brew install rclone"; exit 1)
	@echo '==> Checking if rclone is configured'
	@test -f ~/.config/rclone/rclone.conf || (echo "ERROR: please configure rclone -- e.g. rclone configure"; exit 1)


down:
	@echo '==> Stopping services'
	docker compose -f docker-compose.grapher.yml down

down.full:
	@echo '==> Stopping services'
	docker compose -f docker-compose.full.yml down

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
		sed "s/IMAGE_HOSTING_R2_BUCKET_PATH=.*/IMAGE_HOSTING_R2_BUCKET_PATH=owid-image-upload-staging\/dev-$(USER)/g" <.env.example-full >.env; \
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

tmp-downloads/live_wordpress.sql.gz:
	@echo '==> Downloading wordpress data'
	./devTools/docker/download-wordpress-mysql.sh

wordpress/.env:
	@echo 'Copying wordpress/.env.example --> wordpress/.env'
	@cp -f wordpress/.env.example wordpress/.env

wordpress/web/app/uploads/2022:
	@echo '==> Downloading wordpress uploads'
	./devTools/docker/download-wordpress-uploads.sh

deploy:
	@echo '==> Starting from a clean slate...'
	rm -rf itsJustJavascript

	@echo '==> Building...'
	yarn
	yarn lerna run build --skip-nx-cache
	yarn run tsc -b

	@echo '==> Deploying...'
	yarn buildAndDeploySite live

stage:
	@if [[ ! "$(STAGING)" ]]; then \
		echo 'ERROR: must set the staging environment'; \
		echo '       e.g. STAGING=halley make stage'; \
		exit 1; \
	fi
	@echo '==> Preparing to deploy to $(STAGING)'
	@echo '==> Starting from a clean slate...'
	rm -rf itsJustJavascript

	@echo '==> Building...'
	yarn
	yarn lerna run build
	yarn run tsc -b

	@echo '==> Deploying to $(STAGING)...'
	yarn buildAndDeploySite $(STAGING)

test:
	@echo '==> Linting'
	yarn
	yarn run eslint
	yarn lerna run build
	yarn lerna run buildTests

	@echo '==> Checking formatting'
	yarn testPrettierAll

	@echo '==> Running tests'
	yarn run jest

dbtest:
	@echo '==> Building'
	yarn
	yarn buildTsc

	@echo '==> Running db test script'
	./db/tests/run-db-tests.sh

lint:
	@echo '==> Linting'
	yarn
	yarn run eslint

check-formatting:
	@echo '==> Checking formatting'
	yarn
	yarn testPrettierAll

format:
	@echo '==> Fixing formatting'
	yarn
	yarn fixPrettierAll

unittest:
	@echo '==> Running tests'
	yarn
	yarn run jest --all

../owid-grapher-svgs:
	cd .. && git clone git@github.com:owid/owid-grapher-svgs

svgtest: ../owid-grapher-svgs
	@echo '==> Comparing against reference SVGs'

	@# get ../owid-grapher-svgs reliably to a base state at origin/master
	cd ../owid-grapher-svgs && git fetch && git checkout -f master && git reset --hard origin/master && git clean -fd

	@# generate a full new set of svgs and create an HTML report if there are differences
	node --enable-source-maps itsJustJavascript/devTools/svgTester/verify-graphs.js \
		|| node --enable-source-maps itsJustJavascript/devTools/svgTester/create-compare-view.js

../owid-content:
	@echo '==> Cloning owid-content to ../owid-content'
	cd .. && git clone git@github.com:owid/owid-content

node_modules: package.json yarn.lock yarn.config.cjs
	@echo '==> Installing packages'
	yarn install

itsJustJavascript: node_modules
	@echo '==> Compiling TS'
	yarn lerna run build
	yarn run tsc -b
	touch $@

update.chart-entities: itsJustJavascript
	@echo '==> Updating chart entities table'
	node --enable-source-maps itsJustJavascript/baker/updateChartEntities.js --all

reindex: itsJustJavascript
	@echo '==> Reindexing search in Algolia'
	node --enable-source-maps itsJustJavascript/baker/algolia/configureAlgolia.js
	node --enable-source-maps itsJustJavascript/baker/algolia/indexToAlgolia.js
	node --enable-source-maps itsJustJavascript/baker/algolia/indexChartsToAlgolia.js
	node --enable-source-maps itsJustJavascript/baker/algolia/indexExplorerViewsToAlgolia.js

clean:
	rm -rf node_modules itsJustJavascript
