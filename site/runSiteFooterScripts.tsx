import { StrictMode } from "react"
import { hydrate, render } from "react-dom"
import {
    DataPageV2ContentFields,
    getOwidGdocFromJSON,
    getWindowQueryStr,
    isNil,
    OwidGdocType,
    parseIntOrUndefined,
    SiteFooterContext,
    TagGraphRoot,
} from "@ourworldindata/utils"
import { BAKED_BASE_URL } from "../settings/clientSettings.js"
import { hydrateProminentLink } from "./blocks/ProminentLink.js"
import {
    DataPageV2Content,
    OWID_DATAPAGE_CONTENT_ROOT_ID,
} from "./DataPageV2Content.js"
import { Footnote } from "./Footnote.js"
import { OwidGdoc } from "./gdocs/OwidGdoc.js"
import { runLightbox } from "./lightboxUtils.js"
import { MultiEmbedderSingleton } from "./multiembedder/MultiEmbedder.js"
import { SiteNavigation } from "./SiteNavigation.js"
import SiteTools, { SITE_TOOLS_CLASS } from "./SiteTools.js"
import { runDetailsOnDemand } from "./detailsOnDemand.js"
import { runDataTokens } from "./runDataTokens.js"
import SearchCountry from "./SearchCountry.js"
import {
    AdditionalInformation,
    ADDITIONAL_INFORMATION_CLASS_NAME,
} from "./blocks/AdditionalInformation.js"
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
import { DataCatalogInstantSearchWrapper } from "./DataCatalog/DataCatalog.js"
import { DebugProvider } from "./gdocs/DebugProvider.js"
import { countryProfileSpecs } from "./countryProfileProjects.js"
import { NewsletterSubscriptionForm } from "./NewsletterSubscription.js"
import { NewsletterSubscriptionContext } from "./newsletter.js"
import {
    MultiDimDataPageContent,
    MultiDimDataPageContentProps,
} from "./multiDim/MultiDimDataPageContent.js"

function hydrateDataCatalogPage() {
    const root = document.getElementById("data-catalog-page-root")
    const tagGraph = window._OWID_TAG_GRAPH as TagGraphRoot
    if (root) {
        hydrate(<DataCatalogInstantSearchWrapper tagGraph={tagGraph} />, root)
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

function hydrateDataPageV2Content(isPreviewing?: boolean) {
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
        if (isNil(footnoteContent)) return

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

function runSearchCountry() {
    const searchElements = document.querySelectorAll(
        ".wp-block-search-country-profile"
    )
    searchElements.forEach((element) => {
        const project = element.getAttribute("data-project")
        if (project) {
            const profileSpec = countryProfileSpecs.find(
                (spec) => spec.project === project
            )
            if (profileSpec) {
                render(
                    <SearchCountry
                        countryProfileRootPath={profileSpec.rootPath}
                    />,
                    element
                )
            }
        }
    })
}

function runSiteNavigation(baseUrl: string, hideDonationFlag?: boolean) {
    let isOnHomepage = false
    if (window._OWID_GDOC_PROPS) {
        const props = getOwidGdocFromJSON(window._OWID_GDOC_PROPS)
        isOnHomepage = props?.content?.type === OwidGdocType.Homepage
    }
    render(
        <SiteNavigation
            baseUrl={baseUrl}
            hideDonationFlag={hideDonationFlag}
            isOnHomepage={isOnHomepage}
        />,
        document.querySelector(".site-navigation-root")
    )
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

const hydrateAdditionalInformation = () => {
    document
        .querySelectorAll<HTMLElement>(`.${ADDITIONAL_INFORMATION_CLASS_NAME}`)
        .forEach((block) => {
            const blockWrapper = block.parentElement
            const titleEl = block.querySelector("h3")
            const title = titleEl ? titleEl.textContent : null
            const variation = block.getAttribute("data-variation") || ""
            const defaultOpen =
                block.getAttribute("data-default-open") === "true"
            const figureEl = block.querySelector(".content-wrapper > figure")
            const image = figureEl ? figureEl.innerHTML : null
            const contentEl = block.querySelector(".content")
            const content = contentEl ? contentEl.innerHTML : null
            hydrate(
                <AdditionalInformation
                    content={content}
                    title={title}
                    image={image}
                    variation={variation}
                    defaultOpen={defaultOpen}
                />,
                blockWrapper
            )
        })
}

const hydrateOwidGdoc = (debug?: boolean, isPreviewing?: boolean) => {
    const wrapper = document.querySelector("#owid-document-root")
    const props = getOwidGdocFromJSON(window._OWID_GDOC_PROPS)
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
    const props: MultiDimDataPageContentProps = window._OWID_MULTI_DIM_PROPS!
    const initialQueryStr = getWindowQueryStr()

    hydrate(
        <DebugProvider debug={isPreviewing}>
            <MultiDimDataPageContent
                {...props}
                isPreviewing={isPreviewing}
                initialQueryStr={initialQueryStr}
            />
        </DebugProvider>,
        wrapper
    )
}

export const runSiteFooterScripts = (
    args:
        | {
              debug?: boolean
              isPreviewing?: boolean
              context?: SiteFooterContext
              container?: HTMLElement
              hideDonationFlag?: boolean
          }
        | undefined
) => {
    // We used to destructure this in the function signature, but that caused
    // a weird issue reported by bugsnag: https://app.bugsnag.com/our-world-in-data/our-world-in-data-website/errors/63ca39b631e8660009464eb4?event_id=63d384c500acc25fc0810000&i=sk&m=ef
    // So now we define the object as potentially undefined and then destructure it here.
    const { debug, context, isPreviewing, hideDonationFlag } = args || {}

    switch (context) {
        case SiteFooterContext.dataPageV2:
            hydrateDataPageV2Content(isPreviewing)
            runAllGraphersLoadedListener()
            runLightbox()
            runSiteNavigation(BAKED_BASE_URL, hideDonationFlag)
            runSiteTools()
            runCookiePreferencesManager()
            void runDetailsOnDemand()
            break
        case SiteFooterContext.multiDimDataPage:
            hydrateMultiDimDataPageContent(isPreviewing)
            runAllGraphersLoadedListener()
            runLightbox()
            runSiteNavigation(BAKED_BASE_URL, hideDonationFlag)
            runSiteTools()
            runCookiePreferencesManager()
            void runDetailsOnDemand()
            break
        case SiteFooterContext.grapherPage:
        case SiteFooterContext.explorerPage:
            runSiteNavigation(BAKED_BASE_URL, hideDonationFlag)
            runAllGraphersLoadedListener()
            runSiteTools()
            runCookiePreferencesManager()
            void runDetailsOnDemand()
            break
        case SiteFooterContext.explorerIndexPage:
            hydrateExplorerIndex()
            runSiteNavigation(BAKED_BASE_URL)
            runCookiePreferencesManager()
            runSiteTools()
            break
        case SiteFooterContext.gdocsDocument:
            hydrateOwidGdoc(debug, isPreviewing)
            runAllGraphersLoadedListener()
            runSiteNavigation(BAKED_BASE_URL, hideDonationFlag)
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
        case SiteFooterContext.dataCatalogPage:
            hydrateDataCatalogPage()
        // falls through
        default:
            // Features that were not ported over to gdocs, are only being run on WP pages:
            // - global entity selector
            // - data tokens
            // - country-aware prominent links
            // - search country widget leading to topic country profiles
            // - embedding charts through MultiEmbedderSingleton.embedAll()
            runSiteNavigation(BAKED_BASE_URL, hideDonationFlag)
            runDataTokens()
            runSearchCountry()
            hydrateAdditionalInformation()
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
