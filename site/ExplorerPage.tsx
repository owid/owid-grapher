import React from "react"
import { Head } from "../site/Head"
import { SiteHeader } from "../site/SiteHeader"
import { SiteFooter } from "../site/SiteFooter"
import { LoadingIndicator } from "../grapher/loadingIndicator/LoadingIndicator"
import { IFrameDetector } from "../site/IframeDetector"
import { SiteSubnavigation } from "../site/SiteSubnavigation"
import { formatReusableBlock } from "../site/formatting"
import {
    EMBEDDED_EXPLORER_GRAPHER_CONFIGS,
    EMBEDDED_EXPLORER_DELIMITER,
    ExplorerContainerId,
} from "../explorer/ExplorerConstants"
import { ExplorerProgram } from "../explorer/ExplorerProgram"
import { GrapherInterface } from "../grapher/core/GrapherInterface"
import { serializeJSONForHTML } from "../clientUtils/serializers"
import { GRAPHER_PAGE_BODY_CLASS } from "../grapher/core/GrapherConstants"
import { ExplorerPageUrlMigrationSpec } from "../explorer/urlMigrations/ExplorerPageUrlMigrationSpec"

interface ExplorerPageSettings {
    program: ExplorerProgram
    wpContent?: string
    grapherConfigs: GrapherInterface[]
    baseUrl: string
    urlMigrationSpec?: ExplorerPageUrlMigrationSpec
}

const ExplorerContent = ({ content }: { content: string }) => {
    return (
        <div className="explorerContentContainer">
            <div className="sidebar"></div>
            <div className="article-content">
                <section>
                    <div className="wp-block-columns is-style-sticky-right">
                        <div
                            className="wp-block-column"
                            dangerouslySetInnerHTML={{
                                __html: formatReusableBlock(content),
                            }}
                        ></div>
                        <div className="wp-block-column"></div>
                    </div>
                </section>
            </div>
        </div>
    )
}

export const ExplorerPage = (props: ExplorerPageSettings) => {
    const {
        wpContent,
        program,
        grapherConfigs,
        baseUrl,
        urlMigrationSpec,
    } = props
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
    )};
const grapherConfigs = ${serializeJSONForHTML(
        grapherConfigs,
        EMBEDDED_EXPLORER_GRAPHER_CONFIGS
    )};
const urlMigrationSpec = ${
        urlMigrationSpec ? JSON.stringify(urlMigrationSpec) : "undefined"
    };
window.Explorer.renderSingleExplorerOnExplorerPage(explorerProgram, grapherConfigs, urlMigrationSpec);`

    return (
        <html>
            <Head
                canonicalUrl={`${baseUrl}/${slug}`}
                pageTitle={explorerTitle}
                imageUrl={`${baseUrl}/${thumbnail} `}
                baseUrl={baseUrl}
            >
                <IFrameDetector />
            </Head>
            <body className={GRAPHER_PAGE_BODY_CLASS}>
                <SiteHeader
                    baseUrl={baseUrl}
                    hideAlertBanner={hideAlertBanner || false}
                />
                {subNav}
                <main id={ExplorerContainerId}>
                    <LoadingIndicator />
                </main>
                {wpContent && <ExplorerContent content={wpContent} />}
                <SiteFooter baseUrl={baseUrl} />
                <script dangerouslySetInnerHTML={{ __html: inlineJs }} />
            </body>
        </html>
    )
}
