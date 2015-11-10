[Short explanatory video](https://www.youtube.com/watch?v=Fods4ygADLg)

## INTRO
The *OurWorldInData-Grapher* is the chart building tool which is used on our web-publication [OurWorldInData.org](http://OurWorldInData.org).

We have decided that it doesn't make sense to develop it within private repo, so here it is. Feel free to fork it and play around. Please be aware this is work in progress and that things will change, move and break. The [disclaimer from OurWorldInData](http://ourworldindata.org/about/#disclaimer-of-warranties-and-limitation-of-liability) applies also for the OurWorldInData-Grapher.

With the *OurWorldInData-Grapher* you can create the following visualisations:

– *Line charts* like the first one in [this data entry on life expectancy](http://ourworldindata.org/data/population-growth-vital-statistics/life-expectancy/)

– *Stacked area charts* like the first one in [this data entry on the rise of the Internet](http://ourworldindata.org/data/media-communication/internet/)

– And *scatter plots* like [this one on the relation between education and economic prosperity](http://ourworldindata.org/data/education-knowledge/global-rise-of-education/#the-relationship-between-gdp-and-education)

We are currently working on making bar charts and maps possible.



The *OurWorldInData-Grapher* enables you to upload csv data to a central SQL database and then to pull this data from the SQL database to create interactive charts in a drag&drop interface.

## STACK
The backend is written in PHP using the Laravel Framework. The frontend is written using Backbone.js and [NVD3.js](http://nvd3.org/).
	
## SETUP
1. make sure you have Apache and MySQL database setup in your machine 	
2. use database dump from _data/ to create your database  
3. open .env file and fill in lines 5-8 with your database info

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


