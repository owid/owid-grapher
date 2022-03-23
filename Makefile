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
	@echo '  make up           start dev environment via docker-compose and tmux'
	@echo '  make down         stop any services still running'
	@echo
	@echo '  GRAPHER + WORDPRESS (staff-only)'
	@echo '  make up.full      start dev environment via docker-compose and tmux'
	@echo '  make down.full    stop any services still running'
	@echo

up: require validate.env tmp-downloads/owid_chartdata.sql.gz
	@echo '==> Setting up .env if need be'
	@test -f .env || cp -f .env.example-grapher .env
	
	@echo '==> Building grapher'
	yarn install
	yarn run tsc -b
	
	@echo '==> Starting dev environment'
	tmux new-session -s grapher \
		-n docker 'docker-compose -f docker-compose.grapher.yml up' \; \
			set remain-on-exit on \; \
		new-window -n admin -e DEBUG='knex:query' \
			'DB_HOST=127.0.0.1 devTools/docker/wait-for-mysql.sh && yarn run tsc-watch -b --onSuccess "yarn startAdminServer"' \; \
			set remain-on-exit on \; \
		new-window -n webpack 'yarn run startSiteFront' \; \
			set remain-on-exit on \; \
		new-window -n welcome 'devTools/docker/banner.sh; exec $(LOGIN_SHELL)' \; \
		bind R respawn-pane -k \; \
		bind X kill-pane \; \
		bind Q kill-server \
		|| make down

up.full: require validate.env.full tmp-downloads/owid_chartdata.sql.gz tmp-downloads/live_wordpress.sql.gz wordpress/web/app/uploads/2022
	@echo '==> Setting up .env if need be'
	@test -f .env || cp -f .env.example-full .env
	@grep -q WORDPRESS .env || (echo 'ERROR: your .env is missing some wordpress variables'; exit 1)
	
	@echo '==> Building grapher'
	yarn install
	yarn run tsc -b
	yarn buildWordpressPlugin
	
	@echo '==> Starting dev environment'
	tmux new-session -s grapher \
		-n docker 'docker-compose -f docker-compose.full.yml up' \; \
			set remain-on-exit on \; \
		new-window -n admin -e DEBUG='knex:query' \
			'DB_HOST=127.0.0.1 devTools/docker/wait-for-mysql.sh && yarn run tsc-watch -b --onSuccess "yarn startAdminServer"' \; \
			set remain-on-exit on \; \
		new-window -n webpack 'yarn run startSiteFront' \; \
			set remain-on-exit on \; \
		new-window -n welcome 'devTools/docker/banner.sh; exec $(LOGIN_SHELL)' \; \
		bind R respawn-pane -k \; \
		bind X kill-pane \; \
		bind Q kill-server \
		|| make down.full

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

validate.env:
	@echo '==> Validating your .env file for make up'
	@grep '=' .env.example-grapher | sed 's/=.*//' | while read variable; \
		do make guard-$$variable; \
	done
	@echo '.env valid for make up'

validate.env.full: validate.env
	@echo '==> Validating your .env file for make up.full'
	@grep '=' .env.example-full | sed 's/=.*//' | while read variable; \
		do make guard-$$variable; \
	done
	@echo '.env valid for make up.full'
	

tmp-downloads/owid_chartdata.sql.gz:
	@echo '==> Downloading chart data'
	./devTools/docker/download-grapher-mysql.sh

tmp-downloads/live_wordpress.sql.gz:
	@echo '==> Downloading wordpress data'
	./devtools/docker/download-wordpress-mysql.sh

wordpress/web/app/uploads/2022:
	@echo '==> Downloading wordpress uploads'
	./devtools/docker/download-wordpress-uploads.sh
