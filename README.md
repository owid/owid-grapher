# owid-grapher

[![Build Status](https://travis-ci.org/owid/owid-grapher.svg?branch=master)](https://travis-ci.org/owid/owid-grapher)

This is the project we use internally at the University of Oxford to create embeddable visualizations for [Our World in Data](https://ourworldindata.org). Note that it is not yet a mature OSS project and may be difficult to apply elsewhere as a full package. That said, you are very welcome to read and reuse any of our code!

An example of what this can make (click for interactive):

[![Internet users by world region](https://ourworldindata.org/grapher/exports/internet-users-by-world-region.svg)](https://ourworldindata.org/grapher/internet-users-by-world-region)

The owid-grapher visualization frontend code can run isomorphically under node to render data directly to an SVG string, which is how the above image works!

## Initial development setup

The grapher is currently a Python + JavaScript hybrid project, using [Django](https://www.djangoproject.com/) and [webpack](https://webpack.github.io/). You will need: [MySQL](https://www.mysql.com/), [Python 3.6+](https://www.python.org/downloads/), [Node 9.3+](https://nodejs.org/en/) and [Yarn](https://yarnpkg.com/en/).

Running `pip install -r requirements.txt` and `yarn install` in the repo root will grab the remaining dependencies.

## Database setup

Exports from the live OWID database are published here and can be used for testing:

| File | Description | Size |
| --- | --- | --- |
| [owid_metadata.sql.gz](https://files.ourworldindata.org/owid_metadata.sql.gz) | Table structure and metadata, everything except data_values | ![](http://img.badgesize.io/http://files.ourworldindata.org/owid_metadata.sql.gz) |
| [owid_chartdata.sql.gz](https://files.ourworldindata.org/owid_chartdata.sql.gz) | All data values used by a published visualization | ![](http://img.badgesize.io/http://files.ourworldindata.org/owid_chartdata.sql.gz?v=1) |

This sequence of commands will create a database, then download and import all OWID charts and their data:

```
mysql -e "CREATE DATABASE owid;"
curl -Lo /tmp/owid_metadata.sql.gz https://files.ourworldindata.org/owid_metadata.sql.gz
gunzip < /tmp/owid_metadata.sql.gz | mysql -D owid
curl -Lo /tmp/owid_chartdata.sql.gz https://files.ourworldindata.org/owid_chartdata.sql.gz
gunzip < /tmp/owid_chartdata.sql.gz | mysql -D owid
```

Since the full data_values table (including everything we haven't visualized yet) is really big (>10GB), we don't currently have an export for it. If you'd like a copy please [contact us](mailto:jaiden@ourworldindata.org).

Once you have your database ready, run `yarn dev` and head to `localhost:8000`. If everything is going to plan, you should see a login screen! The default user account is "admin@example.com" with a password of "admin".

You may also want to run a static build for the initial charts: `node dist/src/bakeCharts.js`. `bakeCharts.js` will be compiled from the TypeScript by `yarn dev`, which may take a few moments. You only need to run this static build manually after a database import, otherwise it happens automatically when a chart is updated.

## Architecture notes

owid-grapher is heavily based around [reactive programming](https://en.wikipedia.org/wiki/Reactive_programming) using the libraries [Preact](http://github.com/developit/preact) and [Mobx](http://github.com/mobxjs/mobx), allowing it to do pretty heavy client-side data processing efficiently. New code should be written in [TypeScript](https://www.typescriptlang.org/). [Visual Studio Code](https://code.visualstudio.com/) is recommended for the autocompletion and other awesome editor analysis features enabled by static typing.

## About

owid-grapher was originally created by [Zdenek Hynek](https://github.com/zdenekhynek) for [Our World in Data](https://ourworldindata.org). It is currently being developed by [Jaiden Mispy](http://github.com/mispy) and [Aibek Aldabergenov](https://github.com/aaldaber) with design assistance from [Max Roser](http://maxroser.com/) and the OWID research team.
