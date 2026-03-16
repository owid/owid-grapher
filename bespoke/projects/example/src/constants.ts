import {
    faAppleWhole,
    faLemon,
    faCarrot,
    faPepperHot,
} from "@fortawesome/free-solid-svg-icons"
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core"

export const COLOR_KEYS = [
    "#3182bd",
    "#e6550d",
    "#31a354",
    "#756bb1",
    "#636363",
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
