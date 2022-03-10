# Our World in Data - Headless Wordpress

_Note for external contributors: this is meant for internal use only at this stage._

## Overview

This package contains:

-   [Bedrock](https://roots.io/bedrock/) configuration (Wordpress)
-   Custom plugin
    -   Extra REST API fields
    -   Custom Gutenberg blocks
-   Minimal custom theme

The Wordpress serveur environment (MySQL, NGINX, PHP-FPM) is created and run by the main Docker Compose setup described in the [top level README](../README.md).

## Upgrade

Both Wordpress and Wordpress plugins are upgraded through Composer.

### Upgrade Wordpress

The Wordpress installation has been scaffolded from the [Bedrock](https://roots.io/bedrock/) boilerplate.

Bedrock's upgrade process is [manual](https://github.com/roots/bedrock/issues/533#issuecomment-665548464), and requires selective copy / paste operations from the [latest release](https://github.com/roots/bedrock/releases) files.

Below is the (current) list of Bedrock files grouped by the type of action to be carried out on those files.

1. Override

    - /config/environments
    - /web/app/mu-plugins
    - /web/index.php
    - /web/wp-config.php
    - /phpcs.xml
    - /wp-cli.yml

2. Ignore

    - /CHANGELOG.md
    - /README.md
    - /web/app/plugins (should be empty)
    - /web/app/themes (should be empty)
    - /web/app/uploads (should be empty)
    - /composer.lock

3. Selectively update

    - /composer.json (keep versions pinned)
    - /config/application.php
    - /LICENSE.md (change unlikely)

4. Commit to composer.lock (run from root)

```sh
$ docker compose exec fpm composer update
```

### Upgrade Wordpress plugins

1. Run `docker compose exec fpm composer outdated --direct` to find the latest versions of
   direct dependencies
2. Update composer.json with the new pinned version
3. Run `docker compose exec fpm composer update`
