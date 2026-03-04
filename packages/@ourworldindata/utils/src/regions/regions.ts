import { regionsData } from "./regions.data.js"
import type { Region } from "./regionsTypes.js"

export const regions: readonly Region[] =
    regionsData satisfies readonly Region[]
