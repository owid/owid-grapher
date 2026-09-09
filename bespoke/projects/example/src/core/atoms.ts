import { atom } from "jotai"

import { ColorKey, FoodKey } from "./constants.js"
import { OwidDistinctColors } from "@ourworldindata/grapher/src/color/CustomSchemes.js"

export const selectedColorAtom = atom<ColorKey>(OwidDistinctColors.Denim)
export const selectedFoodAtom = atom<FoodKey>("Apple")
