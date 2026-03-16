import Typesense from "typesense"
import { TYPESENSE_API_KEY } from "../../settings/serverSettings.js"

export const getTypeSenseClient = () => {
    const client = new Typesense.Client({
        apiKey: TYPESENSE_API_KEY,
        nodes: [
            {
                url: "http://localhost:8108",
            },
        ],
    })

    return client
}
