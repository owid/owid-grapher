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
	@echo '  make start              Start the development environment'
	@echo '  make stop               Stop the development environment'
	@echo '  make import-grapher     Re-import the grapher database'
	@echo '  make import-full        Re-import the full database (OWID staff only)'
	@echo '  make mysql              Connect to dev MySQL database'
	@echo '  make deploy             Build and deploy the live site'
	@echo '  make destroy            Destroy images and docker resources'
	@echo

start: check-node-version ../owid-content build-complete .env
	@echo '==> Bringing up dev environment'
	cd wordpress && lando start

	# one-time setup of necessary databases
	@make .full-snapshot-imported

	@echo '==> Starting services in tmux'
	@yarn startTmuxServer

stop:
	@echo '==> Stopping dev environment'
	cd wordpress && lando stop

destroy:
	@echo '==> Tearing down dev environment'
	cd wordpress && lando destroy

	@make clean

clean:
	rm -f .grapher-snapshot-imported .wordpress-snapshot-imported

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

build-complete: .env
	@echo '==> Installing dev packages'
	yarn

.full-snapshot-imported:
	@make import-full
	# mark that we completed the import
	touch $@

import-grapher:
	@echo '==> Importing a grapher db snapshot'
	./db/downloadAndCreateDatabase.sh

import-full:
	@echo '==> Importing full db snapshot'
	cd wordpress && lando refresh --with-chartdata

.env:
	@echo '==> Using .env.example to configure environment'
	cp .env.example .env

deploy:
	@echo '==> Beginning deploy to production'
	yarn buildAndDeploySite
