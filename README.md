# owid-grapher

[![Build Status](https://travis-ci.org/owid/owid-grapher.svg?branch=master)](https://travis-ci.org/owid/owid-grapher) [![Netlify Status](https://api.netlify.com/api/v1/badges/4ab2047d-8fa1-4f00-b91d-cb3dcd0df113/deploy-status)](https://app.netlify.com/sites/owid/deploys)

This is the project we use at the University of Oxford to create embeddable visualizations for [Our World in Data](https://ourworldindata.org). It's not currently designed for immediate reuse as a full library, but you are very welcome to adapt any of our code or to send pull requests.

An example of what this can make (click for interactive):

[![Life expectancy at birth](https://ourworldindata.org/grapher/exports/life-expectancy.svg)](https://ourworldindata.org/grapher/exports/life-expectancy)

The owid-grapher visualization frontend code can run isomorphically under node to render data directly to an SVG string, which is how the above image works!

## Initial development setup

You will need: [MySQL](https://www.mysql.com/), [Node 10.9+](https://nodejs.org/en/) and [Yarn](https://yarnpkg.com/en/).

Running `yarn` in the repo root will grab the remaining dependencies.

## Database setup

Daily exports from the live OWID database are published here and can be used for testing:

| File | Description | Size |
| --- | --- | --- |
| [owid_metadata.sql.gz](https://files.ourworldindata.org/owid_metadata.sql.gz) | Table structure and metadata, everything except data_values | ~5 MB |
| [owid_chartdata.sql.gz](https://files.ourworldindata.org/owid_chartdata.sql.gz) | All data values used by published visualizations | >100MB |

This sequence of commands will create a database, then download and import all OWID charts and their data:

```bash
mysql -e "CREATE DATABASE owid;"
curl -Lo /tmp/owid_metadata.sql.gz https://files.ourworldindata.org/owid_metadata.sql.gz
gunzip < /tmp/owid_metadata.sql.gz | mysql -D owid
curl -Lo /tmp/owid_chartdata.sql.gz https://files.ourworldindata.org/owid_chartdata.sql.gz
gunzip < /tmp/owid_chartdata.sql.gz | mysql -D owid
```

Since the full data_values table (including everything we haven't visualized yet) is really big (>10GB uncompressed), we don't currently have an export for it. If you'd like a copy please [contact us](mailto:jaiden@ourworldindata.org).

## Development server

`cp .env.example .env` and populate `.env` with your database details.

Finally, run `yarn dev` and head to `localhost:3030`. If everything is going to plan, you should see a login screen! The default user account is "admin@example.com" with a password of "admin".

## Migrations

If you need to make changes to the MySQL database structure, these are specified by [typeorm](http://typeorm.io/#/) migration files. Use `yarn typeorm migration:create -n MigrationName` and then populate the file with the SQL statements to alter the tables, using past migration files for reference if needed. Then run migrations with `yarn typeorm migration:run`.

## Architecture notes

owid-grapher is based around [reactive programming](https://en.wikipedia.org/wiki/Reactive_programming) using [React](https://reactjs.org/) and [Mobx](http://github.com/mobxjs/mobx), allowing it to do pretty heavy client-side data processing efficiently. New code should be written in [TypeScript](https://www.typescriptlang.org/). [Visual Studio Code](https://code.visualstudio.com/) is recommended for the autocompletion and other awesome editor analysis features enabled by static typing.

The OWID tech stack has evolved over time as we have found really optimal ways of solving particular problems. We're now happy with the combination of React + Mobx + TypeScript + node and expect to be using these core tools for the foreseeable future. The MySQL database and data structure however is much older and we're interested in exploring alternatives that might allow us to work with large amounts of data more quickly and with more flexibility.
