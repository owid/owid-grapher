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

export function DatasetPage({
    dataset,
    baseUrl,
}: DatasetPageProps & { baseUrl: string }) {
    const props: DatasetPageProps = { dataset }
    return (
        <Html>
            <Head
                canonicalUrl={`${baseUrl}/datasets/${dataset.slug}`}
                pageTitle={dataset.title}
                pageDesc={dataset.description}
                baseUrl={baseUrl}
            />
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
