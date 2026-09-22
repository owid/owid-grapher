import { StageKey } from "./types.js"

export interface StageGroup {
    key: string
    label: string
    stageKeys: StageKey[]
}

export const STAGE_GROUPS: StageGroup[] = [
    {
        key: "supply",
        label: "Grown and imported",
        stageKeys: ["crop_production", "imports"],
    },
    {
        key: "outbound",
        label: "Exported or stored",
        stageKeys: ["exports", "stock_variation"],
    },
    {
        key: "non_food",
        label: "Lost or used elsewhere",
        stageKeys: ["seed", "losses", "other_uses", "processing_net"],
    },
    {
        key: "animals",
        label: "Through animals",
        stageKeys: ["feed", "animal_products"],
    },
    {
        key: "adjustments",
        label: "Adjustments",
        stageKeys: ["tourist_consumption", "residuals"],
    },
]
