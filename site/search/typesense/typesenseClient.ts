import { Client } from "typesense"

let typesenseClient: Client | undefined

export const initTypesenseClient = (key: string) => {
    typesenseClient = new Client({
        apiKey: key,
        nodes: [{ url: "http://localhost:8108" }],
    })
}

export const getTypesenseClient = (): Client => {
    if (!typesenseClient) {
        throw new Error(
            "Typesense client not initialized. Call initTypesenseClient() first."
        )
    }
    return typesenseClient
}
