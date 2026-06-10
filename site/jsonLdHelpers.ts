import * as _ from "lodash-es"
import { DataPageDataV2, GrapherInterface } from "@ourworldindata/utils"
import { GRAPHER_IMAGE_WIDTH_2X } from "@ourworldindata/grapher"
import { GRAPHER_DYNAMIC_THUMBNAIL_URL } from "../settings/clientSettings.js"
import type { Organization } from "schema-dts"

export function makeJsonLdCreator(baseUrl: string): Organization {
    return {
        "@type": "Organization",
        name: "Our World in Data",
        url: baseUrl,
    }
}

export function makeJsonLdGrapherCreditText(
    grapher: GrapherInterface | undefined,
    datapageData?: DataPageDataV2
): string {
    const dataSource = grapher?.sourceDesc?.trim()
    if (dataSource) {
        return `Data source: ${dataSource}. Chart: Our World in Data.`
    }

    let fallbackDataSource: string | undefined
    if (datapageData) {
        const producers = _.uniq(
            datapageData.origins.map((origin) => origin.producer)
        )
        const adaptedFrom =
            producers.length > 0
                ? producers.join(", ")
                : datapageData.source?.name
        fallbackDataSource = datapageData.attributionShort ?? adaptedFrom
    }

    if (fallbackDataSource) {
        return `Data source: ${fallbackDataSource}. Chart: Our World in Data.`
    }

    return "Our World in Data."
}

export function makeJsonLdGrapherImageUrl(
    slug: string | undefined
): string | undefined {
    if (!slug || !GRAPHER_DYNAMIC_THUMBNAIL_URL) return undefined
    return `${GRAPHER_DYNAMIC_THUMBNAIL_URL}/${slug}.png?imWidth=${GRAPHER_IMAGE_WIDTH_2X}`
}
