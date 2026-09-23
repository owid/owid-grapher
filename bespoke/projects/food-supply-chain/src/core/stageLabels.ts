import { StageKey } from "./types.js"

/** Reader-facing names for the manifest's stages, by key */
export const STAGE_LABELS: Record<StageKey, string> = {
    crop_production: "Crops grown",
    imports: "Imports",
    exports: "Exports",
    stock_variation: "Into or out of storage",
    seed: "Kept as seed",
    losses: "Lost after harvest",
    other_uses: "Biofuels and industry",
    processing_net: "Processing",
    feed: "Fed to animals",
    animal_products: "Meat, dairy, eggs, fish",
    tourist_consumption: "Eaten by visitors",
    residuals: "Data adjustment",
    food: "Available to eat",
}
