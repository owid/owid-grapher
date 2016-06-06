# owid-grapher

[![Build Status](https://travis-ci.org/OurWorldInData/owid-grapher.png)](https://travis-ci.org/OurWorldInData/owid-grapher)

A [Laravel](https://laravel.com/) web tool which helps you quickly make interactive d3.js visualizations. Used to create embeddable maps and charts for [Our World In Data](https://ourworldindata.org).

An example of what this can make (click for interactive):

[![Life Expectancy](https://ourworldindata.org/grapher/life-expectancy.png?tab=map)](https://ourworldindata.org/grapher/life-expectancy?tab=map)

One of the neat things owid-grapher can do is automatically export an interactive JS visualization as a static PNG or SVG using [phantomjs](http://phantomjs.org/), which is how the above image works.

## Initial development setup

You will need: [MySQL](https://www.mysql.com/), [PHP 5.5.9+](http://php.net/downloads.php), [Composer](https://getcomposer.org/), and [NPM](https://nodejs.org/en/download/). The [Laravel Homestead](https://laravel.com/docs/4.2/homestead) vagrant box comes with these installed.

Running `composer install` and `npm install` in the repo root will grab the remaining dependencies. You may wish to install [gulp](https://github.com/gulpjs/gulp/blob/master/docs/getting-started.md) globally using `npm install -g` so that it ends up on your PATH.

Once you have `gulp`, run it in the repo to generate public asset files.

## Database setup

The database schema can be imported from `database/db.sql`. For example, if your database is called `forge`:

`mysql -u root -p -D forge  < database/db.sql`

Now copy `.env.example` to `.env` and fill in lines 5-8 with your database details.

Run `php artisan serve` and head to `localhost:8000`. If everything is going to plan, you should see a login screen! If not, error logs can be found in `storage/logs`.

The default user account is "admin@example.com" with a password of "admin".