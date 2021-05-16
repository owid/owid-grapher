#
#  Makefile
#
#  Setup scripts that work even if nothing is installed.
#

.DUMMY: help start stop check-node build-complete

NODE_VERSION = v12.13.1

help:
	@echo 'Available commands:'
	@echo
	@echo '  make start      Start the development environment'
	@echo '  make stop       Stop the development environment'
	@echo '  make destroy    Destroy images and docker resources'
	@echo

start: check-node-version ../owid-content build-complete
	@echo '==> Bringing up dev environment'
	cd wordpress && lando start

	@make .db-snapshot-imported

	@echo '==> Starting services in tmux'
	@yarn startTmuxServer

stop:
	@echo '==> Stopping dev environment'
	cd wordpress && lando stop

destroy:
	@echo '==> Tearing down dev environment'
	cd wordpress && lando destroy
	rm -f .db-snapshot-imported

check-node-version:
	@echo '==> Checking node version'
	@test "$(shell node --version)" = "$(NODE_VERSION)" || ( \
		echo 'Expected node $(NODE_VERSION) -- did you use nvm to install it?' && false \
	)

mysql:
	mysql -h 127.0.0.1 -u root

../owid-content:
	@echo '==> Checking out content in sibling directory'
	git clone git@github.com:owid/owid-content $@

build-complete:
	@echo '==> Installing dev packages'
	yarn

# avoid re-importing the db if we've done it once
.db-snapshot-imported:
	@make import-db
	touch $@

import-db:
	@echo '==> Importing a db snapshot'
	./db/downloadAndCreateDatabase.sh
