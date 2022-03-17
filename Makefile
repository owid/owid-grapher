#
#  Makefile
#

# this is horrible magic, we use it to open a nice welcome message for
# the user in tmux in the shell that they normally use (e.g. bash, zsh)
# https://unix.stackexchange.com/questions/352316/finding-out-the-default-shell-of-a-user-within-a-shell-script
LOGIN_SHELL = $(shell finger $(USER) | grep 'Shell:*' | cut -f3 -d ":")

help:
	@echo 'Available commands:'
	@echo
	@echo '  make up      start tmux session for grapher via docker-compose'
	@echo '  make down    stop any services started by docker-compose'
	@echo

up: require .env tmp-downloads/owid_chartdata.sql.gz
	@echo '==> Building grapher'
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
		bind Q kill-server

down:
	@echo '==> Stopping services'
	docker-compose -f docker-compose.grapher.yml down

require:
	@echo '==> Checking your local environment has the necessary commands...'
	@which docker-compose >/dev/null 2>&1 || (echo "ERROR: docker-compose is required."; exit 1)
	@which yarn >/dev/null 2>&1 || (echo "ERROR: yarn is required."; exit 1)
	@which tmux >/dev/null 2>&1 || (echo "ERROR: tmux is required."; exit 1)
	@which finger >/dev/null 2>&1 || (echo "ERROR: finger is required."; exit 1)


tmp-downloads/owid_chartdata.sql.gz:
	@echo '==> Downloading chart data'
	./devTools/docker/download-grapher-mysql.sh

.env: .env.example-grapher
	@echo '==> Setting up default .env file'
	cp .env.example-grapher .env
