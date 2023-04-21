# Country and Region Data Importer

This script retrieves the ETL's [country & region data](https://github.com/owid/etl/tree/master/etl/steps/data/garden/regions) and regenerates the [JSON file](../../packages/@ourworldindata/utils/src/regions.json) used by grapher for dealing with country, continent, and aggregate entities.

The data file is used primarily for:
- associating country names and codes (see EntityCodes.ts)
- determining whether a given country is mappable (see EntitiesOnTheMap.ts)
- determining whether entities are states and which of those have country pages (see countries.ts)
- establishing region -> country mappings (see WorldRegionsToProjection.ts)

