import type { BespokeComponentDefinition } from "./bespokeComponentTypes.ts"

export const BESPOKE_COMPONENT_REGISTRY: Record<
    string,
    BespokeComponentDefinition
> = {
    "causes-of-death": {
        scriptUrl: "/causes-of-death/index.js",
        dataUrl: "ihme_gbd/latest/gbd_treemap_json",
        metadataFilename: "causes-of-death.metadata.json",
    },
    "democracy-development": {
        scriptUrl: "/democracy-development/index.js",
        // Reads indicators straight from the public data API rather than an
        // ETL feed, so the data URL is absolute and the same everywhere
        dataUrl: "https://api.ourworldindata.org/v1/indicators",
        metadataFilename: "1209797.metadata.json",
    },
    demography: {
        scriptUrl: "/demography/index.js",
        dataUrl: "un_wpp/latest/demography",
        metadataFilename: "demography.metadata.json",
    },
    "food-trade": {
        scriptUrl: "/food-trade/index.js",
        dataUrl: "faostat/latest/food_trade",
        metadataFilename: "food-trade.metadata.json",
    },
    migration: {
        scriptUrl: "/migration/index.js",
        dataUrl: "un_migration/latest/migration_stock_flows_json",
        metadataFilename: "migration-stock-flows.metadata.json",
    },
    "migrant-demographics": {
        scriptUrl: "/migrant-demographics/index.js",
        dataUrl: "un_migration/latest/migrant_demographics",
        metadataFilename: "migrant-demographics.metadata.json",
    },
}
