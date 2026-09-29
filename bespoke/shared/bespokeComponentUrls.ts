import type {
    BespokeComponentDataUrls,
    BespokeComponentDefinition,
} from "./bespokeComponentTypes.ts"

export const PRODUCTION_DATA_BASE_URL =
    "https://api.ourworldindata.org/v1/bespoke"

export interface BespokeComponentUrls extends BespokeComponentDataUrls {
    scriptUrl: string
}

export function resolveBespokeComponentUrls(
    definition: BespokeComponentDefinition,
    {
        scriptBaseUrl,
        dataBaseUrl,
    }: { scriptBaseUrl?: string; dataBaseUrl?: string }
): BespokeComponentUrls {
    const dataBase = dataBaseUrl?.trim() || PRODUCTION_DATA_BASE_URL

    const scriptUrl = resolveUrl(definition.scriptUrl, scriptBaseUrl)
    const dataUrl = resolveUrl(definition.dataUrl, dataBase)
    const metadataUrl = resolveUrl(definition.metadataFilename, dataUrl)

    return { scriptUrl, dataUrl, metadataUrl }
}

function resolveUrl(url: string, baseUrl: string | undefined): string {
    const base = baseUrl?.trim().replace(/\/$/, "")
    if (!base) return url

    if (url.startsWith("http://") || url.startsWith("https://")) return url

    return `${base}/${url.replace(/^\//, "")}`
}
