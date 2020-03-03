# Our World in Data - Headless Wordpress

## Stack

- [Bedrock](https://roots.io/bedrock/): Wordpress stack
- [Lando](https://lando.dev/): local development environment + DevOps
- Custom theme
- Custom plugin

## Requirements

- [Docker](https://www.docker.com/)
- [Lando](https://lando.dev/)

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
