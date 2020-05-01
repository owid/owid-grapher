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

## Performance optimization

[File sharing](https://docs.docker.com/docker-for-mac/#file-sharing) between host and containers is only needed for:

- ~/.lando
- /path/to/this/repository

This can be adjusted in your Docker preferences.

## Development

`yarn` and `composer` dependencies are not shared with the Docker host for performance reasons. They are installed during the build step (`lando build`) directly into their respective containers. For instance, composer dependencies can be accessed through `lando ssh` in `/app/vendor`.
As a result `yarn`and `composer` need to be run from within the containers only (otherwise dependencies won't be found as they are not synced back to the host).

### OWID Wordpress plugin

1. (Once) Follow installation steps above
2. Start development environment

```sh
lando start && lando yarn start
```

