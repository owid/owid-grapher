import * as React from "react"
import * as settings from "settings"
import { Head } from "./Head"
import { SiteHeader } from "./SiteHeader"
import { SiteFooter } from "./SiteFooter"
import { LoadingIndicator } from "site/client/LoadingIndicator"
import { EmbedDetector } from "./EmbedDetector"

export interface ExplorerPageSettings {
    title: string
    slug: string
    imagePath: string
    preloads: string[]
    inlineJs: string
    hideAlertBanner: boolean
    subNav?: JSX.Element
}

export const ExplorerPage = (props: ExplorerPageSettings) => {
    return (
        <html>
            <Head
                canonicalUrl={`${settings.BAKED_BASE_URL}/${props.slug}`}
                pageTitle={props.title}
                imageUrl={`${settings.BAKED_BASE_URL}/${props.imagePath}`}
            >
                <EmbedDetector />
                {props.preloads.map((url: string, index: number) => (
                    <link
                        key={`preload${index}`}
                        rel="preload"
                        href={url}
                        as="fetch"
                        crossOrigin="anonymous"
                    />
                ))}
            </Head>
            <body className="ChartPage">
                <SiteHeader hideAlertBanner={props.hideAlertBanner} />
                {props.subNav}
                <main id="dataExplorerContainer">
                    <LoadingIndicator color="#333" />
                </main>
                <SiteFooter />
                <script dangerouslySetInnerHTML={{ __html: props.inlineJs }} />
            </body>
        </html>
    )
}
