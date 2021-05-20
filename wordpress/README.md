# Our World in Data - Headless Wordpress

_Note for external contributors: this is meant for internal use only at this stage. Without the proper credentials, the installation procedure described below will fail at the `lando refresh` step (which tries to generate and retrieve a database dump from our servers)._

## Stack

-   [Bedrock](https://roots.io/bedrock/): Wordpress stack
-   [Lando](https://lando.dev/): local development environment + DevOps
-   Custom theme
-   Custom plugin

## Requirements

A reasonably powerful machine with 20GB+ of available disk space.

See https://docs.lando.dev/basics/installation.html#hardware-requirements

## Custom plugin

-   Extra REST API fields
-   Custom Gutenberg blocks

## Overview

This setup uses [Lando](https://lando.dev/) which internally uses docker-compose to run mysql (with one DB for wordpress and one for the grapher data) and wordpress inside containers. It comes with scripts that will fill the database for you from the (production?) server.

When you want to work with the grapher you would still run the grapher admin node server, grapher typescript server and webpack locally on your dev machine and set them up so that they talk to the mysql db and where required wordpress when necessary.

Basically this setup allows you to just follow the [top level readme](../) instruction from the section "Development server". Ask another dev for an .env variable file preconfigured with the correct settings for the top level .env config file.

## Installation

_Note: the following commands need to run in the current folder, not the root of the project._

0. Install [Lando](https://lando.dev/) (Docker comes packaged with the installer, which is the recommended way to install both).

1. Configure (no updates necessary at this point)

    ```sh
    $ cp .env.example .env
    ```

2. Start & build

    ```sh
    $ lando start && lando build
    ```

3. Populate databases and retrieve Wordpress uploads

    ```sh
    $ lando refresh -c -u
    ```

## File sharing

[File sharing](https://docs.docker.com/docker-for-mac/#file-sharing) between host and containers is required for your HOME folder, for SSH keys to work properly.

File sharing can be adjusted in your Docker preferences.

## Development

`yarn` and `composer` dependencies are not shared with the Docker host for performance reasons. They are installed during the build step (`lando build`) directly into their respective containers. For instance, composer dependencies can be accessed through `lando ssh` in `/app/vendor`.
As a result `yarn`and `composer` need to be run from within the containers only (otherwise dependencies won't be found as they are not synced back to the host).

### OWID Wordpress plugin

1. (Once) Follow installation steps above
2. Start development environment

```sh
lando start && lando dev
```

## Upgrade

### Bedrock

Bedrock's upgrade process is manual, and requires selective copy / paste operations from the [latest release](https://github.com/roots/bedrock/releases) files.

Below is the (current) list of Bedrock files grouped by the type of action to be carried out on those files.

#### Override

-   /config
-   /web/app/mu-plugins
-   /web/index.php
-   /web/wp-config.php
-   /phpcs.xml
-   /wp-cli.yml

#### Ignore

-   /CHANGELOG.md
-   /README.md
-   /web/app/plugins (should be empty)
-   /web/app/themes (should be empty)
-   /web/app/uploads (should be empty)
-   /composer.lock

#### Selectively update

-   /composer.json (keep versions pinned)
-   /LICENSE.md (change unlikely)

### Wordpress, Wordpress plugins

1. `lando composer outdated --direct` to find the latest versions of
   direct dependencies
2. Update composer.json with the new pinned version
3. `lando composer update`
