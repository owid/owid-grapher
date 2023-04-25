# Country and Region Data Importer

This script retrieves the ETL's [country & region data](https://github.com/owid/etl/tree/master/etl/steps/data/garden/regions) and regenerates the [JSON file](../../packages/@ourworldindata/utils/src/regions.json) used by grapher for dealing with country, continent, and aggregate entities.

The data file is used primarily for:

-   associating country names and codes (see EntityCodes.ts)
-   determining whether a given country is mappable (see EntitiesOnTheMap.ts)
-   determining whether entities are states and which of those have country pages (see regions.ts)
-   establishing region -> country mappings (see WorldRegionsToProjection.ts)


## Updating Region Data

The `regions.json` file can be updated manually by running `yarn importRegions` which triggers the `update.ts` script in `devTools/regionsImporter` and prints out a diff if anything has changed. If, after looking over the changes, everything looks good-to-go you can commit the updated `regions.json` and merge back into `master`.

> Note: pay particular attention to changes in `slug` values for countries since this determines the URL of their country page. If a slug changes, be sure to add a redirect from the old value to the new one in WordPress.

