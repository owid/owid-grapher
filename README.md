# owid-grapher

[![Build Status](https://travis-ci.org/owid/owid-grapher.svg?branch=master)](https://travis-ci.org/owid/owid-grapher)

This is the project we use internally at the University of Oxford to create embeddable visualizations for [Our World in Data](https://ourworldindata.org). Note that it is not yet a mature OSS project and may be difficult to apply elsewhere as a full package. That said, you are very welcome to read and reuse any of our code!

Currently the server-side and client-side code are all rolled into this repo. Eventually, it would be good to break out the chart rendering code as a separate library.

An example of what this can make (click for interactive):

[![Life Expectancy](https://ourworldindata.org/grapher/life-expectancy.png?tab=map)](https://ourworldindata.org/grapher/life-expectancy?tab=map)

One of the neat things owid-grapher can do is automatically export an interactive JS visualization as a static PNG or SVG using [headless chrome](https://developers.google.com/web/updates/2017/04/headless-chrome), which is how the above image works.

## Initial development setup

The grapher is a Python + JavaScript hybrid project, using [Django](https://www.djangoproject.com/) and [webpack](https://webpack.github.io/). You will need: [MySQL 5.7+](https://www.mysql.com/), [Python 3.6+](https://www.python.org/downloads/), and [Yarn](https://yarnpkg.com/en/).

Running `pip install -r requirements.txt` and `yarn install` in the repo root will grab the remaining dependencies.

For static image exports, you will also need a recent version of [node](https://nodejs.org/en/) and [Chrome 59+](https://developers.google.com/web/updates/2017/04/headless-chrome). These are not required for the rest of the codebase to work.

## Database setup

Copy `grapher_admin/secret_settings.py.template` to `grapher_admin/secret_settings.py` and fill in your database details. Then run `python manage.py migrate`.

Some initial test data and charts can then be imported from `grapher_admin/fixtures/owid_data.sql`. For example, if your database is called `grapher`:

`mysql -D grapher < grapher_admin/fixtures/owid_data.sql`	

Run `yarn dev` and head to `localhost:8000`. If everything is going to plan, you should see a login screen! The default user account is "admin@example.com" with a password of "admin".

## Architecture notes

owid-grapher is heavily based around [reactive programming](https://en.wikipedia.org/wiki/Reactive_programming) using the libraries [Preact](http://github.com/developit/preact) and [Mobx](http://github.com/mobxjs/mobx), allowing it to do pretty heavy client-side data processing efficiently. New code should be written in [TypeScript](https://www.typescriptlang.org/) when possible. [Visual Studio Code](https://code.visualstudio.com/) is recommended for the autocompletion and other awesome editor analysis features enabled by static typing.

## About

owid-grapher was originally created by [Zdenek Hynek](https://github.com/zdenekhynek) for [Our World in Data](https://ourworldindata.org). It is currently being developed by [Jaiden Mispy](http://github.com/mispy) and [Aibek Aldabergenov](https://github.com/aaldaber) with design assistance from [Max Roser](http://maxroser.com/) and the OWID research team.
