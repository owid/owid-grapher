import React from "react"
import * as settings from "settings"
import { Head } from "site/server/views/Head"
import { SiteHeader } from "site/server/views/SiteHeader"
import { SiteFooter } from "site/server/views/SiteFooter"
import { LoadingIndicator } from "grapher/loadingIndicator/LoadingIndicator"
import { EmbedDetector } from "site/server/views/EmbedDetector"
import {
    SiteSubnavigation,
    SubNavId,
} from "site/server/views/SiteSubnavigation"
import ExplorerContent from "./ExplorerContent"

interface ExplorerPageSettings {
    title: string
    slug: string
    imagePath: string
    preloads: string[]
    inlineJs: string
    hideAlertBanner?: boolean
    subnavId?: SubNavId
    subnavCurrentId?: string
    wpContent?: string
}

export const ExplorerPage = (props: ExplorerPageSettings) => {
    const { subnavId, subnavCurrentId, wpContent } = props
    const subNav = subnavId ? (
        <SiteSubnavigation
            subnavId={subnavId}
            subnavCurrentId={subnavCurrentId}
        />
    ) : undefined

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
                <SiteHeader hideAlertBanner={props.hideAlertBanner || false} />
                {subNav}
                <main id="explorerContainer">
                    <LoadingIndicator />
                </main>
                {wpContent && <ExplorerContent content={wpContent} />}
                <SiteFooter />
                <script dangerouslySetInnerHTML={{ __html: props.inlineJs }} />
            </body>
        </html>
    )
}
