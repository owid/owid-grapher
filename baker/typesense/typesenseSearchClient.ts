import Typesense from "typesense"
import {
    TYPESENSE_API_KEY,
    TYPESENSE_HOST,
    TYPESENSE_PORT,
    TYPESENSE_PROTOCOL,
} from "../../settings/serverSettings.js"

export const getTypeSenseClient = () => {
    const client = new Typesense.Client({
        apiKey: TYPESENSE_API_KEY,
        nodes: [
            {
                host: TYPESENSE_HOST,
                port: TYPESENSE_PORT,
                protocol: TYPESENSE_PROTOCOL,
            },
        ],
    })

    return client
}
