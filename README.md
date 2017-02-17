# owid-grapher

[![Build Status](https://travis-ci.org/OurWorldInData/owid-grapher.png)](https://travis-ci.org/OurWorldInData/owid-grapher)

This is the project we use internally at the University of Oxford to create the embeddable visualizations for [Our World in Data](https://ourworldindata.org). Note that it is not yet a mature OSS project and may be difficult to apply elsewhere as a full package. That said, you are very welcome to read and reuse any of our code!

An example of what this can make (click for interactive):

[![Life Expectancy](https://ourworldindata.org/grapher/life-expectancy.png?tab=map)](https://ourworldindata.org/grapher/life-expectancy?tab=map)

One of the neat things owid-grapher can do is automatically export an interactive JS visualization as a static PNG or SVG using [phantomjs](http://phantomjs.org/), which is how the above image works.

## Initial development setup

You will need: [MySQL](https://www.mysql.com/), [PHP 5.5.9+](http://php.net/downloads.php), [Composer](https://getcomposer.org/), and [NPM](https://nodejs.org/en/download/). The [Laravel Homestead](https://laravel.com/docs/4.2/homestead) vagrant box comes with these installed.

Running `composer install` and `npm install` in the repo root will grab the remaining dependencies. You will also want to build the static assets with `webpack -w`.

## Database setup

The database schema can be imported from `database/schema.sql`. For example, if your database is called `grapher`:

`mysql -u root -p -D grapher < database/schema.sql`	

Now copy `.env.example` to `.env` and fill in lines 5-8 with your database details.

Run `php artisan serve` and head to `localhost:8000`. If everything is going to plan, you should see a login screen! If not, error logs can be found in `storage/logs`.

The default user account is "admin@example.com" with a password of "admin".

## Architecture notes

Since this project is used in production and undergoing active development, the dependencies and code style are still in a state of flux. We eventually aim to fully migrate away from [nvd3](http://nvd3.org/) and [Backbone](http://backbonejs.org/) in favor of the more modern/faster [Preact](https://github.com/developit/preact) and [Mobx](https://github.com/mobxjs/mobx). New code should be written in [ES6](https://github.com/lukehoban/es6features) with [Flow](https://flowtype.org/) type annotation. We would also like to eventually replace the PHP backend with something more minimal (most of the code in this is frontend stuff).

## About

owid-grapher was originally created by [Zdenek Hynek](https://github.com/zdenekhynek) for [Our World in Data](https://ourworldindata.org). It is currently being developed by [Jaiden Mispy](http://github.com/mispy) with design assistance from [Max Roser](http://maxroser.com/).