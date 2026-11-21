/** The ETL writes the JSON-LD for the dataset's page on the catalog, so it gets the address of the page it is in */
export function makeDatasetPageJsonLd(
    jsonLd: Record<string, unknown>,
    canonicalUrl: string
): Record<string, unknown> {
    return { ...jsonLd, "@id": `${canonicalUrl}#dataset`, url: canonicalUrl }
}
