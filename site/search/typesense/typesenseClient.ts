import { Client } from "typesense"
import {
    TYPESENSE_HOST,
    TYPESENSE_PORT,
    TYPESENSE_SEARCH_KEY,
} from "../../../settings/clientSettings.js"

let typesenseClient: Client | null = null

export const getTypesenseClient = (): Client => {
    if (!typesenseClient) {
        typesenseClient = new Client({
            apiKey: TYPESENSE_SEARCH_KEY,
            nodes: [
                {
                    host: TYPESENSE_HOST,
                    port: TYPESENSE_PORT,
                    protocol: "http",
                },
            ],
        })
    }
    return typesenseClient
}
