import * as _ from "lodash-es"
import { StrictMode } from "react"
import { hydrate, render } from "react-dom"
import {
    ArchiveMetaInformation,
    DataPageV2ContentFields,
    deserializeOwidGdocPageData,
    MultiDimDataPageConfig,
    OwidGdocType,
    parseIntOrUndefined,
    SiteFooterContext,
    TagGraphRoot,
} from "@ourworldindata/utils"
import { hydrateProminentLink } from "./blocks/ProminentLink.js"
import {
    DataPageV2Content,
    OWID_DATAPAGE_CONTENT_ROOT_ID,
} from "./DataPageV2Content.js"
import { Footnote } from "./Footnote.js"
import { OwidGdoc } from "./gdocs/OwidGdoc.js"
import { runLightbox } from "./lightboxUtils.js"
import { MultiEmbedderSingleton } from "./multiembedder/MultiEmbedder.js"
import SiteTools, { SITE_TOOLS_CLASS } from "./SiteTools.js"
import { runDetailsOnDemand } from "./detailsOnDemand.js"
import { hydrateCodeSnippets } from "@ourworldindata/components"
import { hydrateDynamicCollectionPage } from "./collections/DynamicCollection.js"
import {
    _OWID_DATA_INSIGHTS_INDEX_PAGE_DATA,
    DataInsightsIndexPageContent,
} from "./DataInsightsIndexPageContent.js"
import { runAllGraphersLoadedListener } from "./runAllGraphersLoadedListener.js"
import {
    __OWID_EXPLORER_INDEX_PAGE_PROPS,
    ExplorerIndex,
} from "./ExplorerIndex.js"
import { getInitialState } from "./cookiePreferences.js"
import { CookiePreferencesManager } from "./CookiePreferencesManager.js"
import { SearchInstantSearchWrapper } from "./search/SearchInstantSearchWrapper.js"
import { DebugProvider } from "./gdocs/DebugProvider.js"
import { NewsletterSubscriptionForm } from "./NewsletterSubscription.js"
import { NewsletterSubscriptionContext } from "./newsletter.js"
import {
    MultiDimDataPageContent,
    MultiDimDataPageData,
} from "./multiDim/MultiDimDataPageContent.js"
import { BrowserRouter } from "react-router-dom-v5-compat"
import { REDUCED_TRACKING } from "../settings/clientSettings.js"
import { SiteHeaderNavigation } from "./SiteHeader.js"

function hydrateSearchPage() {
    const root = document.getElementById("search-page-root")
    const tagGraph = window._OWID_TAG_GRAPH as TagGraphRoot
    if (root) {
        hydrate(<SearchInstantSearchWrapper tagGraph={tagGraph} />, root)
    }
}

function hydrateDataInsightsIndexPage() {
    const props = (window as any)[_OWID_DATA_INSIGHTS_INDEX_PAGE_DATA]
    const container = document.querySelector(
        `#data-insights-index-page-container`
    )

    if (container && props) {
        hydrate(
            <DebugProvider>
                <DataInsightsIndexPageContent {...props} />
            </DebugProvider>,
            container
        )
    }
}

function hydrateDataPageV2Content({
    isPreviewing,
}: { isPreviewing?: boolean } = {}) {
    const wrapper = document.querySelector(`#${OWID_DATAPAGE_CONTENT_ROOT_ID}`)
    const props: DataPageV2ContentFields = window._OWID_DATAPAGEV2_PROPS
    const grapherConfig = window._OWID_GRAPHER_CONFIG

    hydrate(
        <DebugProvider debug={isPreviewing}>
            <DataPageV2Content
                {...props}
                grapherConfig={grapherConfig}
                isPreviewing={isPreviewing}
            />
        </DebugProvider>,
        wrapper
    )
}

function hydrateExplorerIndex() {
    const explorerIndexPageProps = (window as any)[
        __OWID_EXPLORER_INDEX_PAGE_PROPS
    ]

    if (!explorerIndexPageProps) return
    hydrate(
        <ExplorerIndex {...explorerIndexPageProps} />,
        document.querySelector(".explorer-index-page")
    )
}

function runCookiePreferencesManager() {
    if (REDUCED_TRACKING) return

    const div = document.createElement("div")
    document.body.appendChild(div)

    render(<CookiePreferencesManager initialState={getInitialState()} />, div)
}

interface FootnoteContent {
    index: number
    href: string
    htmlContent: string
}

function getFootnoteContent(element: Element): FootnoteContent | null {
    const href = element.closest("a.ref")?.getAttribute("href")
    if (!href) return null

    const index = parseIntOrUndefined(href.split("-")[1])
    if (index === undefined) return null

    const referencedEl = document.querySelector(href)
    if (!referencedEl?.innerHTML) return null
    return { index, href, htmlContent: referencedEl.innerHTML }
}

function runFootnotes() {
    const footnotes = document.querySelectorAll("a.ref")

    footnotes.forEach((f) => {
        const footnoteContent = getFootnoteContent(f)
        if (_.isNil(footnoteContent)) return

        hydrate(
            <Footnote
                index={footnoteContent.index}
                htmlContent={footnoteContent.htmlContent}
                triggerTarget={f}
            />,
            f
        )
    })
}

function runSiteNavigation(hideDonationFlag?: boolean) {
    const siteNavigationElem = document.querySelector(".site-navigation-root")
    if (siteNavigationElem) {
        let isOnHomepage = false
        if (window._OWID_GDOC_PROPS) {
            const props = deserializeOwidGdocPageData(window._OWID_GDOC_PROPS)
            isOnHomepage = props?.content?.type === OwidGdocType.Homepage
        }

        let archiveInfo: ArchiveMetaInformation | undefined
        if (window._OWID_ARCHIVE_INFO) {
            archiveInfo = window._OWID_ARCHIVE_INFO
        }

        render(
            <SiteHeaderNavigation
                hideDonationFlag={hideDonationFlag}
                isOnHomepage={isOnHomepage}
                archiveInfo={
                    archiveInfo?.type === "archive-page"
                        ? archiveInfo
                        : undefined
                }
            />,
            siteNavigationElem
        )
    }
}

function runSiteTools() {
    render(<SiteTools />, document.querySelector(`.${SITE_TOOLS_CLASS}`))

    const newsletterSubscriptionFormRootHomepage = document.querySelector(
        ".homepage-social-ribbon #newsletter-subscription-root"
    )
    if (newsletterSubscriptionFormRootHomepage) {
        hydrate(
            <NewsletterSubscriptionForm
                context={NewsletterSubscriptionContext.Homepage}
            />,
            newsletterSubscriptionFormRootHomepage
        )
    }
}

const hydrateOwidGdoc = (debug?: boolean, isPreviewing?: boolean) => {
    const wrapper = document.querySelector("#owid-document-root")
    const props = deserializeOwidGdocPageData(window._OWID_GDOC_PROPS)
    hydrate(
        <StrictMode>
            <DebugProvider debug={debug}>
                <OwidGdoc {...props} isPreviewing={isPreviewing} />
            </DebugProvider>
        </StrictMode>,
        wrapper
    )
}

const hydrateMultiDimDataPageContent = (isPreviewing?: boolean) => {
    const wrapper = document.querySelector(`#${OWID_DATAPAGE_CONTENT_ROOT_ID}`)
    const { configObj, ...props }: MultiDimDataPageData =
        window._OWID_MULTI_DIM_PROPS!

    hydrate(
        <DebugProvider debug={isPreviewing}>
            <BrowserRouter>
                <MultiDimDataPageContent
                    config={MultiDimDataPageConfig.fromObject(configObj)}
                    {...props}
                    isPreviewing={isPreviewing}
                />
            </BrowserRouter>
        </DebugProvider>,
        wrapper
    )
}

interface SiteFooterScriptsArgs {
    debug?: boolean
    isPreviewing?: boolean
    context?: SiteFooterContext
    container?: HTMLElement
    hideDonationFlag?: boolean
}

export const runSiteFooterScriptsForArchive = (args: SiteFooterScriptsArgs) => {
    const { context, isPreviewing } = args || {}

    switch (context) {
        case SiteFooterContext.dataPageV2:
            hydrateDataPageV2Content({ isPreviewing })
            // runAllGraphersLoadedListener()
            runLightbox()
            runSiteNavigation()
            // runSiteTools()
            // runCookiePreferencesManager()
            void runDetailsOnDemand()
            break
        case SiteFooterContext.multiDimDataPage:
            hydrateMultiDimDataPageContent(isPreviewing)
            // runAllGraphersLoadedListener()
            runLightbox()
            runSiteNavigation()
            // runSiteTools()
            // runCookiePreferencesManager()
            void runDetailsOnDemand()
            break
        case SiteFooterContext.grapherPage:
            runSiteNavigation()
            // runAllGraphersLoadedListener()
            // runSiteTools()
            // runCookiePreferencesManager()
            void runDetailsOnDemand()
            break
        default:
            console.error(
                `runSiteFooterScriptsForArchive: context ${context} not supported`
            )
            throw new Error(`Unsupported context: ${context}`)
    }
}

export const runSiteFooterScripts = (
    args: SiteFooterScriptsArgs | undefined
) => {
    // We used to destructure this in the function signature, but that caused
    // a weird issue reported by bugsnag: https://app.bugsnag.com/our-world-in-data/our-world-in-data-website/errors/63ca39b631e8660009464eb4?event_id=63d384c500acc25fc0810000&i=sk&m=ef
    // So now we define the object as potentially undefined and then destructure it here.
    const { debug, context, isPreviewing, hideDonationFlag } = args || {}

    switch (context) {
        case SiteFooterContext.dataPageV2:
            hydrateDataPageV2Content({ isPreviewing })
            runAllGraphersLoadedListener()
            runLightbox()
            runSiteNavigation(hideDonationFlag)
            runSiteTools()
            runCookiePreferencesManager()
            void runDetailsOnDemand()
            break
        case SiteFooterContext.multiDimDataPage:
            hydrateMultiDimDataPageContent(isPreviewing)
            runAllGraphersLoadedListener()
            runLightbox()
            runSiteNavigation(hideDonationFlag)
            runSiteTools()
            runCookiePreferencesManager()
            void runDetailsOnDemand()
            break
        case SiteFooterContext.grapherPage:
        case SiteFooterContext.explorerPage:
            runSiteNavigation(hideDonationFlag)
            runAllGraphersLoadedListener()
            runSiteTools()
            runCookiePreferencesManager()
            void runDetailsOnDemand()
            break
        case SiteFooterContext.explorerIndexPage:
            hydrateExplorerIndex()
            runSiteNavigation()
            runCookiePreferencesManager()
            runSiteTools()
            break
        case SiteFooterContext.gdocsDocument:
            hydrateOwidGdoc(debug, isPreviewing)
            runAllGraphersLoadedListener()
            runSiteNavigation(hideDonationFlag)
            runFootnotes()
            void runDetailsOnDemand()
            runLightbox()
            runSiteTools()
            runCookiePreferencesManager()
            break
        case SiteFooterContext.dynamicCollectionPage:
            // Don't break, run default case too
            hydrateDynamicCollectionPage()
        // falls through
        case SiteFooterContext.dataInsightsIndexPage:
            // Don't break, run default case too
            hydrateDataInsightsIndexPage()
        // falls through
        case SiteFooterContext.searchPage:
            hydrateSearchPage()
        // falls through
        default:
            // Features that were not ported over to gdocs, are only being run on WP pages:
            // - global entity selector
            // - country-aware prominent links
            // - embedding charts through MultiEmbedderSingleton.embedAll()
            runSiteNavigation(hideDonationFlag)
            hydrateCodeSnippets()
            MultiEmbedderSingleton.setUpGlobalEntitySelectorForEmbeds()
            MultiEmbedderSingleton.embedAll()
            runAllGraphersLoadedListener()
            runLightbox()
            hydrateProminentLink(MultiEmbedderSingleton.selection)
            runFootnotes()
            runSiteTools()
            runCookiePreferencesManager()
            void runDetailsOnDemand()
            break
    }
}
