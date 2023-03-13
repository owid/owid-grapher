import React from "react"
import { DataPage } from "./DataPage.js"
import { Head } from "./Head.js"
import { SiteFooter } from "./SiteFooter.js"
import { SiteHeader } from "./SiteHeader.js"

export const DataPagePage = ({
    datapage,
    baseUrl,
}: {
    datapage: any
    baseUrl: string
}) => {
    const canonicalUrl = `${baseUrl}/${datapage.slug}`
    return (
        <html>
            <Head
                pageTitle={datapage.title}
                pageDesc={datapage.subtitle}
                canonicalUrl={canonicalUrl}
                baseUrl={baseUrl}
            >
                <link
                    href="https://fonts.googleapis.com/css?family=Lato:300,400,400i,700,700i,900|Playfair+Display:400,700&amp;display=swap"
                    rel="stylesheet"
                />
                <script
                    dangerouslySetInnerHTML={{
                        __html: `window._OWID_DATAPAGE_PROPS = ${JSON.stringify(
                            datapage
                        )}`,
                    }}
                ></script>
            </Head>
            <body>
                <SiteHeader baseUrl={baseUrl} />
                <div id="datapage-root">
                    <DataPage datapage={datapage} />
                </div>
                <SiteFooter baseUrl={baseUrl} />
            </body>
        </html>
    )
}
