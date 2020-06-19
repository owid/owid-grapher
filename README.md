# Our World in Data - Headless Wordpress

## Stack

- [Bedrock](https://roots.io/bedrock/): Wordpress stack
- [Lando](https://lando.dev/): local development environment + DevOps
- Custom theme
- Custom plugin

## Requirements

- [Lando](https://lando.dev/) (Docker comes packaged with the installer, which is the recommended way to install both)

## Custom plugin

- Extra REST API fields consumed by https://github.com/owid/owid-grapher.
- Custom Gutenberg blocks

## Installation

1. Clone

   ```sh
   $ git clone git@github.com:owid/owid-wordpress.git
   ```

2. Configure (no updates necessary at this point)

   ```sh
   $ cp .env.example .env
   ```

3. Start & build

   ```sh
   $ lando start && lando build
   ```

4. Populate databases and retrieve Wordpress uploads

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
lando start && lando yarn start
```

## Upgrade

### Bedrock

Bedrock's upgrade process is manual, and requires selective copy / paste operations from the [latest release](https://github.com/roots/bedrock/releases) files.

Below is the (current) list of Bedrock files grouped by the type of action to be carried out on those files.

#### Override

- /config
- /web/app/mu-plugins
- /web/index.php
- /web/wp-config.php
- /phpcs.xml
- /wp-cli.yml

#### Ignore

- /CHANGELOG.md
- /README.md
- /web/app/plugins (should be empty)
- /web/app/themes (should be empty)
- /web/app/uploads (should be empty)
- composer.lock

#### Selectively update

- /composer.json (keep versions pinned)
- /LICENSE.md (change unlikely)

### Wordpress, Wordpress plugins

1. Update composer.json with the new pinned version
2. `lando composer update`
