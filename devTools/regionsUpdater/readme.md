# Country and Region Data Importer

This script retrieves the ETL's [country & region data](https://github.com/owid/etl/tree/master/etl/steps/data/garden/regions) and regenerates the [JSON file](../../packages/@ourworldindata/utils/src/regions.json) used by grapher for dealing with country, continent, and aggregate entities.

The data file is used primarily for:

- associating country names and codes (see `EntityCodes.ts`)
- determining whether a given country is mappable (see `EntitiesOnTheMap.ts`)
- determining whether entities are states and which of those have country pages (see `regions.ts`)
- establishing region → country mappings (see `WorldRegionsToProjection.ts`)

In addition, the script regenerates [TopoJSON file](../../packages/@ourworldindata/grapher/src/mapCharts/MapTopology.ts) containing country outlines for the world map. It fetches the current, low-res version of the data from [worldmap-sensitive](https://github.com/alexabruck/worldmap-sensitive) and applies the following transformations to it:

- Greenland’s outline is separated out from Denmark’s
- The placeholder code for Kosovo gets replaced with `OWID_KOS`
- French Southern Territories isn’t present in the source map and is added manually
- Palestine’s outline is just the West Bank, so an additional polygon is added for Gaza

## Updating Region Data & Geography

The `regions.json` and `MapTopography.ts` files can be updated manually by running `yarn runRegionsUpdater` which triggers the `update.ts` script in `devTools/regionsImporter` and prints out a diff if anything has changed. If, after looking over the changes, everything looks good-to-go you can commit the updated files and merge back into `master`.

> Note: pay particular attention to changes in `slug` values for countries since this determines the URL of their country page. If a slug changes, be sure to add a redirect from the old value to the new one in WordPress.
