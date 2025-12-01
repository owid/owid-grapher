---
tags:
  - API
icon: material/api
---
# Chart API

Our chart API is structured around charts on our website, i.e. at https://ourworldindata.org/grapher/* . You can find charts by searching our data catalog at [https://ourworldindata.org/data](https://ourworldindata.org/data).

Once you've found the chart with the data you need, simply append ".csv" to the URL to download the data or ".metadata.json" to retrieve the metadata. You can also add ".zip" to download a ZIP file that includes both files, along with a README in markdown format describing the data.

An example for our life expectancy chart:

- [https://ourworldindata.org/grapher/life-expectancy](https://ourworldindata.org/grapher/life-expectancy) - the page on our website where you can see the chart
- [https://ourworldindata.org/grapher/life-expectancy.csv](https://ourworldindata.org/grapher/life-expectancy.csv) - the data for this chart (see below for options)
- [https://ourworldindata.org/grapher/life-expectancy.metadata.json](https://ourworldindata.org/grapher/life-expectancy.metadata.json) - the metadata for this chart, like the chart title, the units, how to cite the data sources
- [https://ourworldindata.org/grapher/life-expectancy.zip](https://ourworldindata.org/grapher/life-expectancy.zip) - the above two plus a readme as zip file archive

## Options

The following options can be specified for all of these endpoints:

**csvType**

- `full` (default): Get the full data, i.e. all time points and all entities
- `filtered`: Get only the data needed to display the visible chart. Different chart types return different subsets of the full data. For a map this will download data for only a single year but all countries, for a line chart it will be the selected time range and visible entities and so on for other chart types.

Note that if you use `filtered`, the other query parameters in the URL will change what is downloaded. E.g. if you navigate to our life-expectancy chart and then visually select the country "Italy" and change the time range to 1950-2000 you will see that the URL in the browser is modified to include `?time=1980..2000&country=~ITA`. When you make a request to any of the endpoints above you can include any of these modifications to get exactly that data:

```
https://ourworldindata.org/grapher/life-expectancy.csv?csvType=filtered&time=1980..2000&country=~ITA
```

**useColumnShortNames**

- `false` (default): Column names are long, use capitalization and whitespace - e.g. `Period life expectancy at birth - Sex: all - Age: 0`
- `true`: Column names are short and don't use whitespace - e.g. `life_expectancy_0__sex_all__age_0`

```
https://ourworldindata.org/grapher/life-expectancy.csv?useColumnShortNames=true
```

## Example notebooks

Check out this list of public example notebooks that demonstrate the use of our chart API:

- [:octicons-link-external-16: Example python notebook](https://colab.research.google.com/drive/1HDcqCy6ZZ05IznXzaaP9Blvvp3qoPnP8?usp=sharing) on Google Colab using Pandas
- [:octicons-link-external-16: ObservableHQ notebook](https://observablehq.com/@owid/recreating-the-life-expectancy-chart) using Javascript to recreate the life expectancy chart

## CSV structure

Each row in the CSV file corresponds to an observation for an entity (most often a country or region) at a specific time point (generally a year). For example, the first three rows of data from our life expectancy chart appear as follows:

```csv
Entity,Code,Year,Period life expectancy at birth - Sex: all - Age: 0
Afghanistan,AFG,1950,27.7275
Afghanistan,AFG,1951,27.9634
```

The first two columns in the CSV file are "Entity" and "Code." "Entity" is the name of the entity, typically a country, such as "United States." "Code" is the OWID internal entity code used for countries or regions. For standard countries, this matches the [:octicons-link-external-16: ISO alpha-3 code](https://en.wikipedia.org/wiki/ISO_3166-1_alpha-3) (e.g., "USA"); for non-standard or historical countries, we use custom codes. Country and region names are standardized across all Our World in Data datasets, allowing you to join multiple datasets using either of these columns.

The third column is either "Year" or "Day". If the data is annual, this is "Year" and contains only the year as an integer. If the column is "Day", the column contains a date string in the form "YYYY-MM-DD".

The final columns are the data columns, which are the time series that powers the chart. For simple line charts there is only a single data column, whereas more complex charts can have more columns.

## Metadata structure

The `.metadata.json` file contains metadata about the data package. The "charts" key contains information to recreate the chart, like the title, subtitle etc. The "columns" key contains information about each of the columns in the csv, like the unit, timespan covered, citation for the data etc. Here is a (slightly shortened) example of the metadata for the life-expectancy chart:

```json
{
    "chart": {
        "title": "Life expectancy",
        "subtitle": "The [period life expectancy](#dod:period-life-expectancy) at birth, in a given year.",
        "citation": "UN WPP (2022); HMD (2023); Zijdeman et al. (2015); Riley (2005)",
        "originalChartUrl": "https://ourworldindata.org/grapher/life-expectancy",
        "selection": ["World", "Americas", "Europe", "Africa", "Asia", "Oceania"]
    },
    "columns": {
        "Period life expectancy at birth - Sex: all - Age: 0": {
            "titleShort": "Life expectancy at birth",
            "titleLong": "Life expectancy at birth - Various sources – period tables",
            "descriptionShort": "The period life expectancy at birth, in a given year.",
            "descriptionKey": [
                "Period life expectancy is a metric that summarizes death rates across all age groups in one particular year.",
                "..."
            ],
            "shortUnit": "years",
            "unit": "years",
            "timespan": "1543-2021",
            "type": "Numeric",
            "owidVariableId": 815383,
            "shortName": "life_expectancy_0__sex_all__age_0",
            "lastUpdated": "2023-10-10",
            "nextUpdate": "2024-11-30",
            "citationShort": "UN WPP (2022); HMD (2023); Zijdeman et al. (2015); Riley (2005) – with minor processing by Our World in Data",
            "citationLong": "UN WPP (2022); HMD (2023); Zijdeman et al. (2015); Riley (2005) – ...",
            "fullMetadata": "https://api.ourworldindata.org/v1/indicators/815383.metadata.json"
        }
    },
    "dateDownloaded": "2024-10-30"
}
```
