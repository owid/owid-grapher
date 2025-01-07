import {
    GRAPHER_PAGE_BODY_CLASS,
    LoadingIndicator,
} from "@ourworldindata/grapher"
import {
    serializeJSONForHTML,
    SiteFooterContext,
    GrapherInterface,
} from "@ourworldindata/utils"
import {
    EMBEDDED_EXPLORER_DELIMITER,
    EMBEDDED_EXPLORER_GRAPHER_CONFIGS,
    EMBEDDED_EXPLORER_PARTIAL_GRAPHER_CONFIGS,
    ExplorerContainerId,
    EXPLORERS_ROUTE_FOLDER,
    ExplorerProgram,
    ExplorerPageUrlMigrationSpec,
    EXPLORER_CONSTANTS_DELIMITER,
} from "@ourworldindata/explorer"
import { Head } from "../site/Head.js"
import { IFrameDetector } from "../site/IframeDetector.js"
import { SiteFooter } from "../site/SiteFooter.js"
import { SiteHeader } from "../site/SiteHeader.js"
import { SiteSubnavigation } from "../site/SiteSubnavigation.js"
import { Html } from "./Html.js"
import {
    ADMIN_BASE_URL,
    BAKED_BASE_URL,
    BAKED_GRAPHER_URL,
    DATA_API_URL,
} from "../settings/clientSettings.js"

interface ExplorerPageSettings {
    program: ExplorerProgram
    wpContent?: string
    grapherConfigs: GrapherInterface[]
    partialGrapherConfigs: GrapherInterface[]
    baseUrl: string
    urlMigrationSpec?: ExplorerPageUrlMigrationSpec
    isPreviewing?: boolean
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
                                __html: content,
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
        partialGrapherConfigs,
        baseUrl,
        urlMigrationSpec,
    } = props
    const {
        subNavId,
        subNavCurrentId,
        explorerTitle,
        explorerSubtitle,
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
const partialGrapherConfigs = ${serializeJSONForHTML(
        partialGrapherConfigs,
        EMBEDDED_EXPLORER_PARTIAL_GRAPHER_CONFIGS
    )};
const urlMigrationSpec = ${
        urlMigrationSpec ? JSON.stringify(urlMigrationSpec) : "undefined"
    };
const explorerConstants = ${serializeJSONForHTML(
        {
            adminBaseUrl: ADMIN_BASE_URL,
            bakedBaseUrl: BAKED_BASE_URL,
            bakedGrapherUrl: BAKED_GRAPHER_URL,
            dataApiUrl: DATA_API_URL,
        },
        EXPLORER_CONSTANTS_DELIMITER
    )}
window.Explorer.renderSingleExplorerOnExplorerPage(explorerProgram, grapherConfigs, partialGrapherConfigs, explorerConstants, urlMigrationSpec);`

    return (
        <Html>
            <Head
                canonicalUrl={`${baseUrl}/${EXPLORERS_ROUTE_FOLDER}/${slug}`}
                hideCanonicalUrl // explorers set their canonical url dynamically
                pageTitle={`${explorerTitle} Data Explorer`}
                pageDesc={explorerSubtitle}
                imageUrl={thumbnail}
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
                    <div className="js--show-warning-block-if-js-disabled" />
                    <LoadingIndicator />
                </main>
                {wpContent && <ExplorerContent content={wpContent} />}
                <SiteFooter
                    baseUrl={baseUrl}
                    context={SiteFooterContext.explorerPage}
                />
                <script
                    type="module"
                    dangerouslySetInnerHTML={{ __html: inlineJs }}
                />
            </body>
        </Html>
    )
}
