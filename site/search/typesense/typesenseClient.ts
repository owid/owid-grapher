import { TypesenseConfig } from "@ourworldindata/utils"
import {
    TYPESENSE_HOST,
    TYPESENSE_PORT,
    TYPESENSE_PROTOCOL,
    TYPESENSE_SEARCH_KEY,
} from "../../../settings/clientSettings.js"

// There's no client object to memoise: the search helpers in
// @ourworldindata/utils are plain `fetch` calls that take this config. See the
// note in that file for why we don't use the `typesense` npm package here.
let typesenseConfig: TypesenseConfig | null = null

export const getTypesenseConfig = (): TypesenseConfig => {
    if (!typesenseConfig) {
        typesenseConfig = {
            host: TYPESENSE_HOST,
            port: TYPESENSE_PORT,
            protocol: TYPESENSE_PROTOCOL,
            apiKey: TYPESENSE_SEARCH_KEY,
        }
    }
    return typesenseConfig
}
