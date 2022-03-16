#
#  Makefile
#

help:
	@echo 'Available commands:'
	@echo
	@echo '  make up      start tmux session for grapher via docker-compose'
	@echo '  make down    stop any services started by docker-compose'
	@echo

up: .env
	yarn run tsc -b
	tmux new-session -s grapher \
		-n docker 'docker-compose -f docker-compose.grapher.yml up' \; \
			set remain-on-exit on \; \
		new-window -n admin -e DEBUG='knex:query' \
			'yarn run tsc-watch -b --onSuccess "sh -c \"say Recompiled && yarn startAdminServer\""' \; \
			set remain-on-exit on \; \
		new-window -n webpack 'yarn run startSiteFront' \; \
			set remain-on-exit on \; \
		select-window -t 0

down:
	docker-compose -f docker-compose.grapher.yml down

.env: .env.example-grapher
	cp .env.example-grapher .env
