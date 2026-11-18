import { SiteFooterContext } from "@ourworldindata/types"
import { serializeJSONForInlineScript } from "@ourworldindata/utils"
import { Head } from "../Head.js"
import { Html } from "../Html.js"
import { SiteHeader } from "../SiteHeader.js"
import { SiteFooter } from "../SiteFooter.js"
import {
    DATASET_PAGE_CONTENT_ROOT_ID,
    DATASET_PAGE_PROPS_KEY,
    DatasetPageContent,
    DatasetPageProps,
} from "./DatasetPageContent.js"
import { makeDatasetPageJsonLd } from "./datasetPageJsonLd.js"

export function DatasetPage({
    dataset,
    baseUrl,
    jsonLd,
}: DatasetPageProps & {
    baseUrl: string
    /** The dataset's Schema.org JSON-LD, so that search engines can list it */
    jsonLd?: Record<string, unknown>
}) {
    const props: DatasetPageProps = { dataset }
    const canonicalUrl = `${baseUrl}/datasets/${dataset.slug}`
    return (
        <Html>
            <Head
                canonicalUrl={canonicalUrl}
                pageTitle={dataset.title}
                pageDesc={dataset.description}
                baseUrl={baseUrl}
            >
                {jsonLd && (
                    <script
                        type="application/ld+json"
                        dangerouslySetInnerHTML={{
                            __html: serializeJSONForInlineScript(
                                makeDatasetPageJsonLd(jsonLd, canonicalUrl)
                            ),
                        }}
                    />
                )}
            </Head>
            <body>
                <SiteHeader />
                <main>
                    <script
                        dangerouslySetInnerHTML={{
                            __html: `window.${DATASET_PAGE_PROPS_KEY} = ${serializeJSONForInlineScript(props)}`,
                        }}
                    />
                    <div id={DATASET_PAGE_CONTENT_ROOT_ID}>
                        <DatasetPageContent {...props} />
                    </div>
                </main>
                <SiteFooter context={SiteFooterContext.datasetPage} />
            </body>
        </Html>
    )
}
