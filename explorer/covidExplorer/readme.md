# Coronavirus Pandemic Data Explorer

This subproject contains code to power the Explorer on https://ourworldindata.org/coronavirus-data-explorer. The Explorer is also embedded as iFrames on other sites, and embedded as both iframes on our site and hoisted into pages on our site during the baking process. We also have old Covid charts that are redirecting to the Explorer.

## Implementation notes

The Explorer is powered mainly by the data in our Covid-19 repo (https://github.com/owid/covid-19-data/tree/master/public/data). The CSV is fetched and then we transform it on demand (for perf) to generate the columns to power the charts for the user.

User customizations are saved to the query string. Changes to params should not break existing views, unless absolute necessary.

Much of the metadata and map color schemes are set in the author site. This arose as over time every nearly view had custom tweaks made by the authors, so hard coding all of them in the repo was impractical.

## Concepts

### Metric

A Metric is just a term we give to the 6 columns in our table that are basically our "primary columns". They are: Cases, Deaths, Tests, CFR, Tests Per Case, and Share of Positive tests. There is nothing special about these columns, they are just the ones that users want to see most, and most of the other columns we show are derived from these.

### Column Def Templates

We have this half-baked notion of "Templates", where a user can make some selections and we generate a column definition on the fly, including merging that with some column definition info from the baked version from the Grapher backend. This is a pattern we can simplify and improve and may be useful in other places.

### Chart Templates

Similar to the Column Def Templates, we have some charts that are a combination of what the user picked, what authors have specified in specific published charts, and hard coded info in this repo. Could be improved.

### CovidExplorerTable

This just wraps OwidTable. We have some transforms only really needed for this Explorer so it made sense to extend it. Ideally we could add more general purpose transforms upstream and get rid of this class.

### MegaCSV

That is just what we call the CSV from the Covid-19 repo. That may have been an internal name that stuck around in the code. We parse MegaCSV into a CovidExplorerTable.

### CovidParams

These hold the settings a user can customize. The user may specify combinations we don't support, so the "CovidConstrainedParams" class derives from that and ensures a valid state. This class shares a lot of patterns with our Grapher params and Switcher Explorer params, so there's likely a class we could create to do a better job with this situation through the site.

## Wish list

-   Ideally we'd move this Explorer to share more code with the general purpose Explorer and allow authors control over it without having to commit to this repo.
-   The CSV file has gotten quite large at this point and there are performance improvements we could make
-   Allow for multi-country, multi-metric charts
-   Annotations should be pulled automatically from the GitHub
