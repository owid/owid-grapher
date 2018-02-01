# owid-grapher

[![Build Status](https://travis-ci.org/owid/owid-grapher.svg?branch=master)](https://travis-ci.org/owid/owid-grapher)

This is the project we use internally at the University of Oxford to create embeddable visualizations for [Our World in Data](https://ourworldindata.org). Note that it is not yet a mature OSS project and may be difficult to apply elsewhere as a full package. That said, you are very welcome to read and reuse any of our code!

An example of what this can make (click for interactive):

[![Internet users by world region](https://ourworldindata.org/grapher/exports/internet-users-by-world-region.svg)](https://ourworldindata.org/grapher/internet-users-by-world-region)

The owid-grapher visualization frontend code can run isomorphically under node to render data directly to an SVG string, which is how the above image works!

## Initial development setup

The grapher is a Python + JavaScript hybrid project, using [Django](https://www.djangoproject.com/) and [webpack](https://webpack.github.io/). You will need: [MySQL](https://www.mysql.com/), [Python 3.6+](https://www.python.org/downloads/), [Node 9.3+](https://nodejs.org/en/) and [Yarn](https://yarnpkg.com/en/).

Running `pip install -r requirements.txt` and `yarn install` in the repo root will grab the remaining dependencies.

## Database setup

An initial test database can be imported from `owid_grapher/fixtures/owid_data.sql`. For example, if your database is called `grapher`:

`mysql -u root -p -D grapher < owid_grapher/fixtures/owid_data.sql`	

Now copy `owid_grapher/secret_settings.py.template` to `owid_grapher/secret_settings.py` and fill in your database details.

Run `yarn dev` and head to `localhost:8000`. If everything is going to plan, you should see a login screen! The default user account is "admin@example.com" with a password of "admin".

## Architecture notes

owid-grapher is heavily based around [reactive programming](https://en.wikipedia.org/wiki/Reactive_programming) using the libraries [Preact](http://github.com/developit/preact) and [Mobx](http://github.com/mobxjs/mobx), allowing it to do pretty heavy client-side data processing efficiently. New code should be written using [PEP 484 type hints](https://www.python.org/dev/peps/pep-0484/) and [TypeScript](https://www.typescriptlang.org/). [Visual Studio Code](https://code.visualstudio.com/) is recommended for the autocompletion and other awesome editor analysis features enabled by static typing.

## About

owid-grapher was originally created by [Zdenek Hynek](https://github.com/zdenekhynek) for [Our World in Data](https://ourworldindata.org). It is currently being developed by [Jaiden Mispy](http://github.com/mispy) and [Aibek Aldabergenov](https://github.com/aaldaber) with design assistance from [Max Roser](http://maxroser.com/) and the OWID research team.
