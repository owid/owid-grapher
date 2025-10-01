import type { Dataset, WithContext, SearchAction } from "schema-dts"
import { GrapherInterface } from "@ourworldindata/utils"

export function JsonLdDataset({
    grapher,
    canonicalUrl,
    pageDesc,
}: {
    grapher: GrapherInterface | undefined
    canonicalUrl: string
    pageDesc: string
}) {
    if (!grapher) return null

    const data: WithContext<Dataset> = {
        "@context": "https://schema.org",
        "@type": "Dataset",
        name: grapher.title ?? "Our World in Data Chart",
        description: pageDesc,
        url: canonicalUrl,
        image: `${canonicalUrl}.png`,
        license: "https://creativecommons.org/licenses/by/4.0/",
        creator: {
            "@type": "Organization",
            name: "Our World in Data",
            url: "https://ourworldindata.org/",
        },
        distribution: [
            {
                "@type": "DataDownload",
                encodingFormat: "text/csv",
                contentUrl: `${canonicalUrl}.csv`,
            },
            {
                "@type": "DataDownload",
                encodingFormat: "application/json",
                contentUrl: `${canonicalUrl}.metadata.json`,
            },
        ],
        potentialAction: {
            "@type": "SearchAction",
            target: `${canonicalUrl}?tab={tab}&country={country}`,
            description:
                "Customize the chart view using query parameters. 'tab' can be 'chart', 'map', 'table', or 'line'. 'country' accepts ISO 3166-1 alpha-3 codes separated by ~ (e.g., POL~MAC~FRA).",
        } as SearchAction,
    }

    return (
        <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
                __html: JSON.stringify(data),
            }}
        />
    )
}
