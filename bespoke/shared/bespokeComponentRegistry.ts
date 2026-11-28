import type { BespokeComponentDefinition } from "./bespokeComponentTypes.ts"

export const BESPOKE_COMPONENT_REGISTRY: Record<
    string,
    BespokeComponentDefinition
> = {
    "ai-training-compute": {
        scriptUrl: "/ai-training-compute/index.js",
        // The OWID indicators behind the "Notable AI models" multidim. The
        // bundle reads the current indicator ids from the multidim's config;
        // the metadata file is the training-compute indicator's, for the
        // methods box on featured viz pages, and needs updating if that
        // indicator is replaced.
        dataUrl: "https://api.ourworldindata.org/v1/indicators",
        metadataFilename: "1366440.metadata.json",
    },
    "causes-of-death": {
        scriptUrl: "/causes-of-death/index.js",
        dataUrl: "ihme_gbd/latest/gbd_treemap_json",
        metadataFilename: "causes-of-death.metadata.json",
    },
    "deforestation-trade": {
        scriptUrl: "/deforestation-trade/index.js",
        dataUrl: "forests/latest/deforestation_trade",
        metadataFilename: "deforestation-trade.metadata.json",
    },
    demography: {
        scriptUrl: "/demography/index.js",
        dataUrl: "un_wpp/latest/demography",
        metadataFilename: "demography.metadata.json",
    },
    "food-supply-chain": {
        scriptUrl: "/food-supply-chain/index.js",
        dataUrl: "faostat/latest/food_supply_chain_scl",
        metadataFilename: "food-supply-chain.metadata.json",
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
