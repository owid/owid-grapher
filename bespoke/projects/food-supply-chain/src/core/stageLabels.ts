import { StageKey } from "./types.js"

/**
 * Reader-facing names for the manifest's accounting terms.
 *
 * A stage whose direction is fixed reads as a participle, and one that can go
 * either way reads as a noun. Storage, processing and the statistical gap all
 * swing both ways, so "Stored" or "Lost in processing" would be wrong as often
 * as it was right.
 */
export const STAGE_LABELS: Record<StageKey, string> = {
    crop_production: "Crops grown",
    imports: "Imported",
    exports: "Exported",
    stock_variation: "Change in storage",
    seed: "Kept for seed",
    losses: "Lost on the way",
    other_uses: "Non-food uses",
    processing_net: "Processing",
    feed: "Fed to animals",
    animal_products: "Animal products",
    tourist_consumption: "Eaten by tourists",
    residuals: "Statistical gap",
    food: "Food available to eat",
}

/** The reader-facing name for a stage, falling back to the manifest's own */
export function stageLabel(key: StageKey, manifestName: string): string {
    return STAGE_LABELS[key] ?? manifestName
}
