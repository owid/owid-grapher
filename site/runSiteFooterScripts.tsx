import * as _ from "lodash-es"
import { createRoot, hydrateRoot } from "react-dom/client"
import {
    ArchiveMetaInformation,
    DATA_INSIGHTS_INDEX_PAGE_SIZE,
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
import { AriaAnnouncerProvider } from "./AriaAnnouncerContext.js"
import { AriaAnnouncer } from "./AriaAnnouncer.js"
import {
    MultiDimDataPageContent,
    MultiDimDataPageData,
} from "./multiDim/MultiDimDataPageContent.js"
import { BrowserRouter } from "react-router-dom-v5-compat"
import { REDUCED_TRACKING } from "../settings/clientSettings.js"
import { SiteHeaderNavigation } from "./SiteHeader.js"
import { DataInsightsIndexPageProps } from "./DataInsightsIndexPage.js"

function hydrateSearchPage() {
    const elem = document.getElementById("search-page-root")
    const tagGraph = window._OWID_TAG_GRAPH as TagGraphRoot
    if (elem) {
        hydrateRoot(elem, <SearchInstantSearchWrapper tagGraph={tagGraph} />)
    }
}

async function hydrateDataInsightsIndexPage() {
    const props: DataInsightsIndexPageProps = (window as any)[
        _OWID_DATA_INSIGHTS_INDEX_PAGE_DATA
    ]
    const container = document.querySelector(
        `#data-insights-index-page-container`
    )

    if (container && props) {
        const urlParams = new URLSearchParams(window.location.search)
        const topicName = urlParams.get("topic")
        if (topicName) {
            // filter data insights to {topic}
            const response = await fetch(`/dataInsights.json`)
            if (!response.ok) {
                throw new Error("Failed to fetch data insights for topic")
            }
            let dataInsights = await response.json()
            dataInsights = dataInsights.filter(
                (di: { tags: { name: string }[] }) =>
                    di.tags &&
                    di.tags.some(
                        (tag: { name: string }) => tag.name === topicName
                    )
            )

            if (dataInsights.length) {
                const tag = dataInsights[0].tags.find(
                    (tag: { name: string }) => tag.name === topicName
                )
                props.totalPageCount = Math.ceil(
                    dataInsights.length / DATA_INSIGHTS_INDEX_PAGE_SIZE
                )
                props.topicTag = { name: tag.name, slug: tag.slug }
                props.dataInsights = dataInsights.slice(
                    props.pageNumber * DATA_INSIGHTS_INDEX_PAGE_SIZE,
                    (props.pageNumber + 1) * DATA_INSIGHTS_INDEX_PAGE_SIZE
                )
            }
        }
        hydrateRoot(
            container,
            <DebugProvider>
                <DataInsightsIndexPageContent {...props} />
            </DebugProvider>
        )
    }
}

function hydrateDataPageV2Content({
    isPreviewing,
}: { isPreviewing?: boolean } = {}) {
    const wrapper = document.querySelector(`#${OWID_DATAPAGE_CONTENT_ROOT_ID}`)
    const props: DataPageV2ContentFields = window._OWID_DATAPAGEV2_PROPS
    const grapherConfig = window._OWID_GRAPHER_CONFIG

    if (!wrapper) return
    hydrateRoot(
        wrapper,
        <DebugProvider debug={isPreviewing}>
            <DataPageV2Content
                {...props}
                grapherConfig={grapherConfig}
                isPreviewing={isPreviewing}
            />
        </DebugProvider>
    )
}

function hydrateExplorerIndex() {
    const explorerIndexPageProps = (window as any)[
        __OWID_EXPLORER_INDEX_PAGE_PROPS
    ]

    if (!explorerIndexPageProps) return
    const container = document.querySelector(".explorer-index-page")
    if (!container) return
    hydrateRoot(container, <ExplorerIndex {...explorerIndexPageProps} />)
}

function runCookiePreferencesManager() {
    if (REDUCED_TRACKING) return

    const div = document.createElement("div")
    document.body.appendChild(div)

    const root = createRoot(div)
    root.render(<CookiePreferencesManager initialState={getInitialState()} />)
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

        hydrateRoot(
            f,
            <Footnote
                index={footnoteContent.index}
                htmlContent={footnoteContent.htmlContent}
                triggerTarget={f}
            />
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

        const root = createRoot(siteNavigationElem)
        root.render(
            <SiteHeaderNavigation
                hideDonationFlag={hideDonationFlag}
                isOnHomepage={isOnHomepage}
                archiveInfo={
                    archiveInfo?.type === "archive-page"
                        ? archiveInfo
                        : undefined
                }
            />
        )
    }
}

function runSiteTools() {
    const siteToolsElem = document.querySelector(`.${SITE_TOOLS_CLASS}`)
    if (siteToolsElem) {
        const root = createRoot(siteToolsElem)
        root.render(<SiteTools />)
    }

    const newsletterSubscriptionFormRootHomepage = document.querySelector(
        ".homepage-social-ribbon #newsletter-subscription-root"
    )
    if (newsletterSubscriptionFormRootHomepage) {
        hydrateRoot(
            newsletterSubscriptionFormRootHomepage,
            <NewsletterSubscriptionForm
                context={NewsletterSubscriptionContext.Homepage}
            />
        )
    }
}

const hydrateOwidGdoc = (debug?: boolean, isPreviewing?: boolean) => {
    const wrapper = document.querySelector("#owid-document-root")
    const props = deserializeOwidGdocPageData(window._OWID_GDOC_PROPS)
    if (!wrapper) return
    hydrateRoot(
        wrapper,
        <AriaAnnouncerProvider>
            <DebugProvider debug={debug}>
                <OwidGdoc {...props} isPreviewing={isPreviewing} />
            </DebugProvider>
            <AriaAnnouncer />
        </AriaAnnouncerProvider>
    )
}

const hydrateMultiDimDataPageContent = (isPreviewing?: boolean) => {
    const wrapper = document.querySelector(`#${OWID_DATAPAGE_CONTENT_ROOT_ID}`)
    const { configObj, ...props }: MultiDimDataPageData =
        window._OWID_MULTI_DIM_PROPS!

    if (!wrapper) return
    hydrateRoot(
        wrapper,
        <DebugProvider debug={isPreviewing}>
            <BrowserRouter>
                <MultiDimDataPageContent
                    config={MultiDimDataPageConfig.fromObject(configObj)}
                    {...props}
                    isPreviewing={isPreviewing}
                />
            </BrowserRouter>
        </DebugProvider>
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
            runSiteNavigation()
            // runSiteTools()
            // runCookiePreferencesManager()
            void runDetailsOnDemand()
            break
        case SiteFooterContext.multiDimDataPage:
            hydrateMultiDimDataPageContent(isPreviewing)
            // runAllGraphersLoadedListener()
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

export const runSiteFooterScripts = async (
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
            runSiteNavigation(hideDonationFlag)
            runSiteTools()
            runCookiePreferencesManager()
            void runDetailsOnDemand()
            break
        case SiteFooterContext.multiDimDataPage:
            hydrateMultiDimDataPageContent(isPreviewing)
            runAllGraphersLoadedListener()
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
            runSiteTools()
            runCookiePreferencesManager()
            break
        case SiteFooterContext.dynamicCollectionPage:
            // Don't break, run default case too
            hydrateDynamicCollectionPage()
        // falls through
        case SiteFooterContext.dataInsightsIndexPage:
            // Don't break, run default case too
            await hydrateDataInsightsIndexPage()
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
            MultiEmbedderSingleton.embedAll(isPreviewing)
            runAllGraphersLoadedListener()
            hydrateProminentLink(MultiEmbedderSingleton.selection)
            runFootnotes()
            runSiteTools()
            runCookiePreferencesManager()
            void runDetailsOnDemand()
            break
    }
}
