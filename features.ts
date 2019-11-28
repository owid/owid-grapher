import { parseBool } from "utils/string"

export const EXPLORER: boolean = process.env.FEATURE_FLAG_EXPLORER
    ? parseBool(process.env.FEATURE_FLAG_EXPLORER)
    : false
