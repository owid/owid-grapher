# owid-grapher

[![Build Status](https://travis-ci.org/OurWorldInData/owid-grapher.png)](https://travis-ci.org/OurWorldInData/owid-grapher)

A web application which helps you quickly make various kinds of interactive d3.js visualizations. Used to create embeddable maps and charts for [Our World In Data](ourworldindata.org).

An example of what this can make (click for interactive):

[![Life Expectancy](https://ourworldindata.org/grapher/life-expectancy.png?tab=map)](https://ourworldindata.org/grapher/life-expectancy?tab=map)

One of the neat things owid-grapher can do is automatically export an interactive JS visualization as a static PNG or SVG using [phantomjs](http://phantomjs.org/), which is how the above image works.

## STACK

The backend is written in PHP using the Laravel Framework. The frontend is written using Backbone.js and [NVD3.js](http://nvd3.org/).

## INITIAL SETUP

You will need: [MySQL](https://www.mysql.com/), [PHP 5.5.9+](http://php.net/downloads.php), [Composer](https://getcomposer.org/), and [NPM](https://nodejs.org/en/download/). The [Laravel Homestead](https://laravel.com/docs/4.2/homestead) vagrant box comes with these installed.

Running `composer install` and `npm install` in the repo root will grab the remaining dependencies. You may wish to install [gulp](https://github.com/gulpjs/gulp/blob/master/docs/getting-started.md) globally using `npm install -g` so that it ends up on your PATH.

Once you have `gulp`, run it in the repo to generate public asset files.

## DATABASE SETUP

The inital database schema can be imported from `_data/db.sql`. For example, if your database is called `forge`:

`mysql -u root -p -D forge  < _data/db.sql`

Copy `.env.example` to `.env` and fill in lines 5-8 with your database details.

Run `php artisan serve` and head to `localhost:8000`. If everything is going to plan, you should see a login screen! If not, error logs can be found in `storage/logs`.

## USER SETUP

The default test user is `test@email.com`. You can reset the password for this user by configuring `.env` to work with [mailtrap.io](https://mailtrap.io/), so that all local emails end up there.

## COMPONENTS
The entire tool can be divided into four main modules and here’s a very brief description what is going on in each one of them.

1. Chart viewer module
Tool uses NVD3 to create charts from data stored in database. For each chart, we store json configuration which determines which datasets are used for different dimensions of chart (e.g. X axis, Y axis) together with other chart settings (labels, selected countries, period etc.).
JSON configuration is loaded by [Backbone model](public/js/app/models/App.Models.ChartModel.js) which calls backend to retrieve data necessary for given chart.
AJAX request from ChartModel is passed to [DataController](app/Http/Controllers/DataController.php) which contains logic for composing response with data for charts. In most cases, DataController calls one the data processing methods of the [Chart model] (app/Chart.php), which correctly formats data for different chart types.
Once response is received, ChartModel passes data to [ChartView](public/js/app/views/App.Views.ChartView.js) which takes care of actually creating NVD3 chart with all the necessary configuration from JSON configuration.

2. Chart builder module
Form for creating new chart is accessible at: public/charts/create
Form dynamically creates charts by assigning properties of [Backbone model](public/js/app/models/App.Models.ChartModel.js)
Most of the logic is contained in [FormView.js](public/js/app/views/App.Views.FormView.js) and Backbone views stored in public/js/app/views/form folder.

3. Import module
Import module is accessible at: public/import
Import pre-formatting and validation can be mainly found at [ImportView.js](public/js/app/views/App.Views.ImportView.js)
Import into db itself is performed by [Importer.js](public/js/app/models/App.Models.Importer.js) which makes ajax calls routed to [ImportController](app/Http/Controllers/ImportController.php).
By default, all data is validated against internal list of valid country names (stored in entity_iso_names table)
<insert sample format of correctly formatted csv>

4. Data management module
All uploaded data and most of the tool settings are editable from within admin, using Laravel views.
When necessary, [Rapyd laravel](https://github.com/zofe/rapyd-laravel) is used for data grids and filters.

## Screenshots of the work flow

Once you have the OurWorldInData-Grapher setup you can make access of the two tools:

1) First you upload data into the central SQL database. The tool recognizes country names and the time information (years, decades etc.). You also have to include the data source information at this stage so that source information and data are stored together and you keep everything in order.
![ourworldindata-grapher_dataupload](http://ourworldindata.org/wp-content/uploads/2015/09/ourworldindata_ourworldindata-grapher_dataupload.png "Optional title")

2) With the visualisation tool – screenshot below – you then have the possibility to pull the data from the central SQL database to visualise it.
![ourworldindata-grapher_visualisationtool](http://ourworldindata.org/wp-content/uploads/2015/09/ourworldindata_ourworldindata-grapher_visualisationtool.png "Optional title")


