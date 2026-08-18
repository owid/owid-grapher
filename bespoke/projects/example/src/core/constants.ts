import {
    faAppleWhole,
    faLemon,
    faCarrot,
    faPepperHot,
} from "@fortawesome/free-solid-svg-icons"
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core"

import { OwidDistinctColors } from "@ourworldindata/grapher/src/color/CustomSchemes.js"

export type VariantName = "picker" | "display" | "chart"

export const COLOR_KEYS = [
    OwidDistinctColors.Denim,
    OwidDistinctColors.Maroon,
    OwidDistinctColors.OliveGreen,
    OwidDistinctColors.RustyOrange,
    OwidDistinctColors.Copper,
] as const

export const FOOD_KEYS = ["Apple", "Lemon", "Carrot", "Pepper"] as const

export type ColorKey = (typeof COLOR_KEYS)[number]
export type FoodKey = (typeof FOOD_KEYS)[number]

export const foodIconByKey: Record<FoodKey, IconDefinition> = {
    Apple: faAppleWhole,
    Lemon: faLemon,
    Carrot: faCarrot,
    Pepper: faPepperHot,
}
