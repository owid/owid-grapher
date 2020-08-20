# Coronavirus Pandemic Data Explorer

This subproject contains code to power the Explorer on https://ourworldindata.org/coronavirus-data-explorer. The Explorer is also embedded as iFrames on other sites, and embedded as both iframes on our site and hoisted into pages on our site during the baking process. We also have old Covid charts that are redirecting to the Explorer.

## Implementation notes

The Explorer is powered mainly by the data in our Covid-19 repo (https://github.com/owid/covid-19-data/tree/master/public/data). The CSV is fetched and then we transform it on demand (for perf) to generate the columns to power the charts for the user.

User customizations are saved to the query string. Changes to params should not break existing views, unless absolute necessary.

Much of the metadata and map color schemes are set in the author site. This arose as over time every nearly view had custom tweaks made by the authors, so hard coding all of them in the repo was impractical.

## Wish list

-   Ideally we'd move this Explorer to share more code with the general purpose Explorer and allow authors control over it without having to commit to this repo.
-   The CSV file has gotten quite large at this point and there are performance improvements we could make
-   Allow for multi-country, multi-metric charts
