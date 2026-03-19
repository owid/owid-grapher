import { atom } from "jotai"

import { ColorKey, FoodKey } from "./constants.js"

export const selectedColorAtom = atom<ColorKey>("#3182bd")
export const selectedFoodAtom = atom<FoodKey>("Apple")
