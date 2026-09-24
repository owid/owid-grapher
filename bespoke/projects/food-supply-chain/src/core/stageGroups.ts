import { StageKey } from "./types.js"

export interface StageGroup {
    key: string
    label: string
    stageKeys: StageKey[]
}

export const STAGE_GROUPS: StageGroup[] = [
    {
        key: "trade_and_storage",
        label: "Trade and storage",
        stageKeys: ["imports", "exports", "stock_variation"],
    },
    {
        key: "set_aside_or_lost",
        label: "Set aside or lost",
        stageKeys: ["seed", "losses"],
    },
    {
        key: "turned_into_other_products",
        label: "Turned into other products",
        stageKeys: ["other_uses", "processing_net", "feed", "animal_products"],
    },
    {
        key: "adjustments",
        label: "Adjustments",
        stageKeys: ["tourist_consumption", "residuals"],
    },
]
