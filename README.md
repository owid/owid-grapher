# owid-grapher

[![Build Status](https://travis-ci.org/OurWorldInData/owid-grapher.svg?branch=master)](https://travis-ci.org/OurWorldInData/owid-grapher)

This is the project we use internally at the University of Oxford to create embeddable visualizations for [Our World In Data](https://ourworldindata.org). Note that it is not yet a mature OSS project and may be difficult to apply elsewhere as a full package. That said, you are very welcome to read and reuse any of our code!

An example of what this can make (click for interactive):

[![Life Expectancy](https://ourworldindata.org/grapher/life-expectancy.png?tab=map)](https://ourworldindata.org/grapher/life-expectancy?tab=map)

One of the neat things owid-grapher can do is automatically export an interactive JS visualization as a static PNG or SVG using [headless chrome](https://developers.google.com/web/updates/2017/04/headless-chrome), which is how the above image works.

## Initial development setup

The grapher is a Python + JavaScript hybrid project, using [Django](https://www.djangoproject.com/) and [webpack](https://webpack.github.io/). You will need: [MySQL](https://www.mysql.com/), [Python 3.6+](https://www.python.org/downloads/), and [Yarn](https://yarnpkg.com/en/).

Running `pip install -r requirements.txt` and `yarn install` in the repo root will grab the remaining dependencies.

For static image exports, you will also need a recent version of [node](https://nodejs.org/en/) and [Chrome 59+](https://developers.google.com/web/updates/2017/04/headless-chrome). These are not required for the rest of the codebase to work.

## Database setup

An initial test database can be imported from `owid_grapher/fixtures/owid_data.sql`. For example, if your database is called `grapher`:

`mysql -u root -p -D grapher < owid_grapher/fixtures/owid_data.sql`	

Now copy `owid_grapher/secret_settings.py.template` to `owid_grapher/secret_settings.py` and fill in your database details.

Run `yarn dev` and head to `localhost:8000`. If everything is going to plan, you should see a login screen! The default user account is "admin@example.com" with a password of "admin".

## Architecture notes

Since this project is used in production and undergoing active development, the dependencies and code style are still in a state of flux. We eventually aim to fully migrate away from [nvd3](http://nvd3.org/) and [Backbone](http://backbonejs.org/) in favor of the more modern/faster [Preact](https://github.com/developit/preact) and [Mobx](https://github.com/mobxjs/mobx). New code should be written using [PEP 484 type hints](https://www.python.org/dev/peps/pep-0484/) and [TypeScript](https://www.typescriptlang.org/).

## About

owid-grapher was originally created by [Zdenek Hynek](https://github.com/zdenekhynek) for [Our World In Data](https://ourworldindata.org). It is currently being developed by [Jaiden Mispy](http://github.com/mispy) and [Aibek Aldabergenov](https://github.com/aaldaber) with design assistance from [Max Roser](http://maxroser.com/) and the OWID research team.