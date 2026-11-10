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
        // Creating a collection downloads its embedding model, and an import
        // embeds every record: both take far longer than the default 5 s,
        // after which the client retries a request that is still running
        connectionTimeoutSeconds: 15 * 60,
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
