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
    demography: {
        scriptUrl: "/demography/index.js",
        dataUrl: "un_wpp/latest/demography",
        metadataFilename: "demography.metadata.json",
    },
    // owid/owid-issues#2526: no ETL bespoke feed step exists yet, so this
    // points at the raw data bucket. Swap dataUrl to the ETL path once it does.
    "food-supply-chain": {
        scriptUrl: "/food-supply-chain/index.js",
        dataUrl: "https://owid-public.owid.io/data/food-supply-chain",
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
