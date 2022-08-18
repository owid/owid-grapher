#
#  Makefile
#

# this is horrible magic, we use it to open a nice welcome message for
# the user in tmux in the shell that they normally use (e.g. bash, zsh)
# https://unix.stackexchange.com/questions/352316/finding-out-the-default-shell-of-a-user-within-a-shell-script
LOGIN_SHELL = $(shell finger $(USER) | grep 'Shell:*' | cut -f3 -d ":")

# setting .env variables as Make variables for validate.env targets
# https://lithic.tech/blog/2020-05/makefile-dot-env/
ifneq (,$(wildcard ./.env))
    include .env
    export
endif

help:
	@echo 'Available commands:'
	@echo
	@echo '  GRAPHER ONLY'
	@echo '  make up            start dev environment via docker-compose and tmux'
	@echo '  make down          stop any services still running'
	@echo '  make refresh       download a new grapher snapshot and update MySQL'
	@echo
	@echo '  GRAPHER + WORDPRESS (staff-only)'
	@echo '  make up.full       start dev environment via docker-compose and tmux'
	@echo '  make down.full     stop any services still running'
	@echo '  make refresh.wp    download a new wordpress snapshot and update MySQL'
	@echo '  make refresh.full  do a full MySQL update of both wordpress and grapher'
	@echo

up: export DEBUG = 'knex:query'

up: require create-if-missing.env tmp-downloads/owid_chartdata.sql.gz
	@make validate.env
	@make check-port-3306
	@echo '==> Building grapher'
	yarn install
	yarn run tsc -b

	@echo '==> Starting dev environment'
	tmux new-session -s grapher \
		-n docker 'docker-compose -f docker-compose.grapher.yml up' \; \
			set remain-on-exit on \; \
		new-window -n admin \
			'devTools/docker/wait-for-mysql.sh && yarn run tsc-watch -b --onSuccess "yarn startAdminServer"' \; \
			set remain-on-exit on \; \
		new-window -n webpack 'yarn run startSiteFront' \; \
			set remain-on-exit on \; \
		new-window -n welcome 'devTools/docker/banner.sh; exec $(LOGIN_SHELL)' \; \
		bind R respawn-pane -k \; \
		bind X kill-pane \; \
		bind Q kill-server \; \
		set -g mouse on \
		|| make down

up.devcontainer: create-if-missing.env.devcontainer tmp-downloads/owid_chartdata.sql.gz
	@make validate.env
	@make check-port-3306
	@echo '==> Building grapher'
	yarn install
	yarn run tsc -b

	@echo '==> Starting dev environment'
	tmux new-session -s grapher \
		-n admin \
			'devTools/docker/wait-for-mysql.sh && yarn run tsc-watch -b --onSuccess "yarn startAdminServer"' \; \
			set remain-on-exit on \; \
		new-window -n webpack 'yarn run startSiteFront' \; \
			set remain-on-exit on \; \
		new-window -n welcome 'devTools/docker/banner.sh; exec $(LOGIN_SHELL)' \; \
		bind R respawn-pane -k \; \
		bind X kill-pane \; \
		bind Q kill-server

up.full: export DEBUG = 'knex:query'

up.full: require create-if-missing.env.full wordpress/.env tmp-downloads/owid_chartdata.sql.gz tmp-downloads/live_wordpress.sql.gz wordpress/web/app/uploads/2022
	@make validate.env.full
	@make check-port-3306

	@echo '==> Building grapher'
	yarn install
	yarn run tsc -b
	yarn buildWordpressPlugin

	@echo '==> Starting dev environment'
	tmux new-session -s grapher \
		-n docker 'docker-compose -f docker-compose.full.yml up' \; \
			set remain-on-exit on \; \
		new-window -n admin \
			'devTools/docker/wait-for-mysql.sh && yarn run tsc-watch -b --onSuccess "yarn startAdminServer"' \; \
			set remain-on-exit on \; \
		new-window -n webpack 'yarn run startSiteFront' \; \
			set remain-on-exit on \; \
		new-window -n welcome 'devTools/docker/banner.sh; exec $(LOGIN_SHELL)' \; \
		bind R respawn-pane -k \; \
		bind X kill-pane \; \
		bind Q kill-server \; \
		set -g mouse on \
		|| make down.full

refresh:
	@echo '==> Downloading chart data'
	./devTools/docker/download-grapher-mysql.sh

	@echo '==> Updating grapher database'
	@. ./.env && DATA_FOLDER=tmp-downloads ./devTools/docker/refresh-grapher-data.sh

refresh.wp:
	@echo '==> Downloading wordpress data'
	./devTools/docker/download-wordpress-mysql.sh

	@echo '==> Updating wordpress data'
	@. ./.env && DATA_FOLDER=tmp-downloads ./devTools/docker/refresh-wordpress-data.sh

refresh.full: refresh refresh.wp

down:
	@echo '==> Stopping services'
	docker-compose -f docker-compose.grapher.yml down

down.full:
	@echo '==> Stopping services'
	docker-compose -f docker-compose.full.yml down

require:
	@echo '==> Checking your local environment has the necessary commands...'
	@which docker-compose >/dev/null 2>&1 || (echo "ERROR: docker-compose is required."; exit 1)
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
	@grep '=' .env.example-grapher | sed 's/=.*//' | while read variable; \
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
	@grep '=' .env.example-full | sed 's/=.*//' | while read variable; \
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

tmp-downloads/owid_chartdata.sql.gz:
	@echo '==> Downloading chart data'
	./devTools/docker/download-grapher-mysql.sh

tmp-downloads/live_wordpress.sql.gz:
	@echo '==> Downloading wordpress data'
	./devTools/docker/download-wordpress-mysql.sh

wordpress/.env:
	@echo 'Copying wordpress/.env.example --> wordpress/.env'
	@cp -f wordpress/.env.example wordpress/.env

wordpress/web/app/uploads/2022:
	@echo '==> Downloading wordpress uploads'
	./devTools/docker/download-wordpress-uploads.sh
