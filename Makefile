#
#  Makefile
#

LOGIN_SHELL = $(shell finger $(USER) | grep 'Shell:*' | cut -f3 -d ":")

help:
	@echo 'Available commands:'
	@echo
	@echo '  make up      start tmux session for grapher via docker-compose'
	@echo '  make down    stop any services started by docker-compose'
	@echo

up: .env tmp-downloads/owid_chartdata.sql.gz
	@echo '==> Building grapher'
	yarn run tsc -b
	@echo '==> Starting dev environment'
	tmux new-session -s grapher \
		-n docker 'docker-compose -f docker-compose.grapher.yml up' \; \
			set remain-on-exit on \; \
		new-window -n admin -e DEBUG='knex:query' \
			'yarn run tsc-watch -b --onSuccess "yarn startAdminServer"' \; \
			set remain-on-exit on \; \
		new-window -n webpack 'yarn run startSiteFront' \; \
			set remain-on-exit on \; \
		new-window -n welcome 'devTools/docker/banner.sh; exec $(LOGIN_SHELL)' \; \

down:
	@echo '==> Stopping services'
	docker-compose -f docker-compose.grapher.yml down

tmp-downloads/owid_chartdata.sql.gz:
	@echo '==> Downloading chart data'
	./devTools/docker/download-grapher-mysql.sh

.env: .env.example-grapher
	@echo '==> Setting up default .env file'
	cp .env.example-grapher .env
