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
    "deforestation-trade": {
        scriptUrl: "/deforestation-trade/index.js",
        // Hand-built data files (see the project's scripts/buildData.py), so
        // the URL is absolute and the same file is served everywhere. Move it
        // to "https://owid-public.owid.io/bespoke/deforestation-trade" once
        // they are uploaded.
        dataUrl: "http://localhost:8089/deforestation-trade",
        metadataFilename: "deforestation-trade.metadata.json",
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
