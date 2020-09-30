# owid-grapher

[![Build Status](https://travis-ci.org/owid/owid-grapher.svg?branch=master)](https://travis-ci.org/owid/owid-grapher)
[![Netlify Status](https://api.netlify.com/api/v1/badges/4ab2047d-8fa1-4f00-b91d-cb3dcd0df113/deploy-status)](https://app.netlify.com/sites/owid/deploys)
[![Test coverage](https://owid.github.io/badges/coverage.svg)](https://owid.github.io/coverage/)
[![Storybook](https://raw.githubusercontent.com/storybookjs/brand/master/badge/badge-storybook.svg)](https://owid.github.io/stories/)

This is the project we use at the University of Oxford to create embeddable visualizations for [Our World in Data](https://ourworldindata.org). It's not currently designed for immediate reuse as a full library, but you are very welcome to adapt any of our code or to send pull requests.

An example of what this can make (click for interactive):

[![Life expectancy at birth](https://ourworldindata.org/grapher/exports/life-expectancy.svg)](https://ourworldindata.org/grapher/life-expectancy)

The owid-grapher visualization frontend code can run isomorphically under node to render data directly to an SVG string, which is how the above image works!

## Initial development setup

### macOS

1. Install Homebrew first, follow the instructions here: <https://brew.sh/>

2. Install Homebrew services:

    ```sh
    brew tap homebrew/services
    ```

3. Install MySQL 5.7 and Node 12.13.1+:

    ```sh
    brew install mysql@5.7 node
    ```

4. Start the MySQL service:

    ```sh
    brew services start mysql@5.7
    ```

5. Install yarn:

    ```sh
    npm install -g yarn
    ```

6. Inside the repo folder, install all dependencies by running:

    ```sh
    yarn
    ```

### Other platforms

You will need: [MySQL 5.7](https://www.mysql.com/), [Node 12.13.1+](https://nodejs.org/en/) and [Yarn](https://yarnpkg.com/en/). Running `yarn` in the repo root will grab the remaining dependencies.

## Database setup

### Remove the password

Remove the password for root by opening the MySQL shell with `mysql` and running:

```sql
ALTER USER 'root'@'localhost' IDENTIFIED WITH mysql_native_password BY ''
```

We do this for convenience so we can run `mysql` commands without providing a password each time. You can also set a password, just make sure you include it in the `.env` file later.

### Import the latest data extract

Daily exports from the live OWID database are published here and can be used for testing:

| File                                                                            | Description                                                   | Size (compressed) |
| ------------------------------------------------------------------------------- | ------------------------------------------------------------- | ----------------- |
| [owid_metadata.sql.gz](https://files.ourworldindata.org/owid_metadata.sql.gz)   | Table structure and metadata, everything except `data_values` | ~15 MB            |
| [owid_chartdata.sql.gz](https://files.ourworldindata.org/owid_chartdata.sql.gz) | All data values used by published visualizations              | >200MB            |

This script will create a database, then download and import all OWID charts and their data (might take a while!):

```bash
./db/downloadAndCreateDatabase.sh
```

Since the full `data_values` table (including everything we haven't visualized yet) is really big (>10GB uncompressed), we don't currently have an export for it. If you'd like a copy please [contact us](mailto:tech@ourworldindata.org).

### Inspecting the database

On macOS, we recommend using [Sequel Pro](http://www.sequelpro.com/) (it's free).

We also have [**a rough sketch of the schema**](https://user-images.githubusercontent.com/1308115/64631358-d920e680-d3ee-11e9-90a7-b45d942a7259.png) as it was on November 2019 (there may be slight changes).

## Development server

`cp .env.example .env` and populate `.env` with your database details.

Finally, run `yarn dev` and head to `localhost:3030/admin`. If everything is going to plan, you should see a login screen! The default user account is "admin@example.com" with a password of "admin".

This development server will rebuild and live-reload the site upon changes, so you can just make changes to the code, save the file and see the result in the browser right away.

## Migrations

If you need to make changes to the MySQL database structure, these are specified by [typeorm](http://typeorm.io/#/) migration files. Use `yarn typeorm migration:create -n MigrationName` and then populate the file with the SQL statements to alter the tables, using past migration files for reference if needed. Then run migrations with `yarn migrate`.

## Architecture notes

owid-grapher is based around [reactive programming](https://en.wikipedia.org/wiki/Reactive_programming) using [React](https://reactjs.org/) and [Mobx](http://github.com/mobxjs/mobx), allowing it to do client-side data processing efficiently. New code should be written in [TypeScript](https://www.typescriptlang.org/). [Visual Studio Code](https://code.visualstudio.com/) is recommended for the autocompletion and other awesome editor analysis features enabled by static typing.

The OWID tech stack has evolved over time as we've found different ways to solve our problems. We're happy with the combination of React + Mobx + TypeScript + node and expect to be using these core tools for the foreseeable future. The MySQL database and data structure however is much older and we're interested in exploring alternatives that might allow us to work with large amounts of data more quickly and with more flexibility.

---

Cross-browser testing provided by <a href="https://www.browserstack.com"><img src="https://3fxtqy18kygf3on3bu39kh93-wpengine.netdna-ssl.com/wp-content/themes/browserstack/img/bs-logo.svg" /> BrowserStack</a>
