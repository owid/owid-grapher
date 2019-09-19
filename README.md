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

Custom dashboard behaviours and widgets for ourworldindata.org wordpress admin panel.

### Reading context

Gutenberg sidebar plugin allowing authors to choose an entry as the reading context of a blog post. By opposition to _in-situ_ blog posts, embedded blog posts don't have their own page, they are only visible within the context of an parent entry.

## Installation

1. Clone

   ```sh
   $ git clone git@github.com:owid/owid-wordpress.git
   ```

2. Configure (no updates necessary at this point)

   ```sh
   $ cp .env.example .env
   ```

3. Start

   ```sh
   $ lando start
   ```

4. Populate databases

   ```sh
   $ lando db-refresh
   ```

5. Optionally, import the **chartdata** database

   ```sh
   $ curl -LO https://files.ourworldindata.org/owid_chartdata.sql.gz
   $ lando db-import -h database-grapher owid_chartdata.sql.gz
   ```
