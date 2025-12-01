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

!!! example "Example notebooks"

    Check out this list of public example notebooks that demonstrate the use of our chart API:

    - [:octicons-link-external-16: Example python notebook](https://colab.research.google.com/drive/1HDcqCy6ZZ05IznXzaaP9Blvvp3qoPnP8?usp=sharing) on Google Colab using Pandas
    - [:octicons-link-external-16: ObservableHQ notebook](https://observablehq.com/@owid/recreating-the-life-expectancy-chart) using Javascript to recreate the life expectancy chart
