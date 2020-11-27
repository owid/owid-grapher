import React from "react"
import * as settings from "settings"
import { Head } from "site/server/views/Head"
import { SiteHeader } from "site/server/views/SiteHeader"
import { SiteFooter } from "site/server/views/SiteFooter"
import { LoadingIndicator } from "grapher/loadingIndicator/LoadingIndicator"
import { IFrameDetector } from "site/server/views/IframeDetector"
import { SiteSubnavigation } from "site/server/views/SiteSubnavigation"
import ExplorerContent from "./ExplorerContent"
import {
    EMBEDDED_EXPLORER_GRAPHER_CONFIGS,
    EMBEDDED_EXPLORER_DELIMITER,
    ExplorerContainerId,
} from "explorer/client/ExplorerConstants"
import { ExplorerProgram } from "explorer/client/ExplorerProgram"
import { GrapherInterface } from "grapher/core/GrapherInterface"
import { serializeJSONForHTML } from "clientUtils/serializers"
import { GRAPHER_PAGE_BODY_CLASS } from "grapher/core/GrapherConstants"

interface ExplorerPageSettings {
    program: ExplorerProgram
    wpContent?: string
    grapherConfigs: GrapherInterface[]
}

export const ExplorerPage = (props: ExplorerPageSettings) => {
    const { wpContent, program, grapherConfigs } = props
    const {
        subNavId,
        subNavCurrentId,
        explorerTitle,
        slug,
        thumbnail,
        hideAlertBanner,
    } = program
    const subNav = subNavId ? (
        <SiteSubnavigation
            subnavId={subNavId}
            subnavCurrentId={subNavCurrentId}
        />
    ) : undefined

    const inlineJs = `const explorerProgram = ${serializeJSONForHTML(
        program.toJson(),
        EMBEDDED_EXPLORER_DELIMITER
    )}
const grapherConfigs = ${serializeJSONForHTML(
        grapherConfigs,
        EMBEDDED_EXPLORER_GRAPHER_CONFIGS
    )}
window.Explorer.renderSingleExplorerOnExplorerPage(explorerProgram, grapherConfigs)`

    return (
        <html>
            <Head
                canonicalUrl={`${settings.BAKED_BASE_URL}/${slug}`}
                pageTitle={explorerTitle}
                imageUrl={`${settings.BAKED_BASE_URL}/${thumbnail} `}
            >
                <IFrameDetector />
            </Head>
            <body className={GRAPHER_PAGE_BODY_CLASS}>
                <SiteHeader hideAlertBanner={hideAlertBanner || false} />
                {subNav}
                <main id={ExplorerContainerId}>
                    <LoadingIndicator />
                </main>
                {wpContent && <ExplorerContent content={wpContent} />}
                <SiteFooter />
                <script dangerouslySetInnerHTML={{ __html: inlineJs }} />
            </body>
        </html>
    )
}
