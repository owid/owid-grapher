import {
    getSelectedEntityNamesParam,
    GLOBAL_ENTITY_SELECTOR_DEFAULT_COUNTRY,
    GLOBAL_ENTITY_SELECTOR_ELEMENT,
    GrapherProgrammaticInterface,
    GRAPHER_EMBEDDED_FIGURE_ATTR,
    GRAPHER_EMBEDDED_FIGURE_CONFIG_ATTR,
    hydrateGlobalEntitySelectorIfAny,
    migrateSelectedEntityNamesParam,
    SelectionArray,
    migrateGrapherConfigToLatestVersion,
    GRAPHER_NARRATIVE_CHART_CONFIG_FIGURE_ATTR,
    renderGrapherIntoContainer,
} from "@ourworldindata/grapher"
import {
    fetchText,
    getWindowUrl,
    isPresent,
    Url,
    GRAPHER_TAB_CONFIG_OPTIONS,
    merge,
    fetchWithRetry,
    NarrativeChartInfo,
    searchParamsToMultiDimView,
    MultiDimDataPageConfig,
} from "@ourworldindata/utils"
import { action } from "mobx"
import ReactDOM from "react-dom"
import {
    Explorer,
    ExplorerProps,
    EXPLORER_EMBEDDED_FIGURE_SELECTOR,
    buildExplorerProps,
    isEmpty,
} from "@ourworldindata/explorer"
import {
    GRAPHER_PREVIEW_CLASS,
    MultiDimDataPageConfigEnriched,
} from "@ourworldindata/types"
import {
    ADMIN_BASE_URL,
    BAKED_GRAPHER_URL,
    DATA_API_URL,
    GRAPHER_DYNAMIC_CONFIG_URL,
    MULTI_DIM_DYNAMIC_CONFIG_URL,
} from "../../settings/clientSettings.js"
// import { embedDynamicCollectionGrapher } from "../collections/DynamicCollection.js"
import { match } from "ts-pattern"
import MultiDim from "../multiDim/MultiDim.js"

type EmbedType = "grapher" | "explorer" | "multiDim" | "narrativeChart"

const figuresFromDOM = (
    container: HTMLElement | Document = document,
    selector: string
) =>
    Array.from(
        container.querySelectorAll<HTMLElement>(`*[${selector}]`)
    ).filter(isPresent)

// const pageContainsGlobalEntitySelector = () =>
//     globalEntitySelectorElement() !== null

const globalEntitySelectorElement = () =>
    document.querySelector(GLOBAL_ENTITY_SELECTOR_ELEMENT)

class MultiEmbedder {
    private figuresObserver: IntersectionObserver | undefined
    selection: SelectionArray = new SelectionArray()
    graphersAndExplorersToUpdate: Set<SelectionArray> = new Set()

    constructor() {
        if (typeof window !== "undefined" && "IntersectionObserver" in window) {
            this.figuresObserver = new IntersectionObserver(
                this.onIntersecting.bind(this),
                {
                    rootMargin: "200%",
                }
            )
        } else if (
            typeof window === "object" &&
            typeof document === "object" &&
            !navigator.userAgent.includes("jsdom")
        ) {
            // only show the warning when we're in something that roughly resembles a browser
            console.warn(
                "IntersectionObserver not available; interactive embeds won't load on this page"
            )
        }
    }

    /**
     * Finds all <figure data-grapher-src="..."> and <figure
     * data-explorer-src="..."> elements in the document and loads the
     * iframeless interactive charts when the user's viewport approaches them.
     * Uses an IntersectionObserver (see constructor).
     *
     * BEWARE: this method is hardcoded in some scripts, make sure to check
     * thoroughly before making any changes.
     */
    embedAll() {
        this.observeFigures()
    }

    /**
     * Make the embedder aware of new <figure> elements that are injected into the DOM.
     *
     * Use this when you programmatically create/replace charts.
     */
    observeFigures(container: HTMLElement | Document = document) {
        const figures = figuresFromDOM(container, GRAPHER_EMBEDDED_FIGURE_ATTR)
            .concat(
                figuresFromDOM(container, EXPLORER_EMBEDDED_FIGURE_SELECTOR)
            )
            .concat(
                figuresFromDOM(
                    container,
                    GRAPHER_NARRATIVE_CHART_CONFIG_FIGURE_ATTR
                )
            )

        figures.forEach((figure) => {
            this.figuresObserver?.observe(figure)
        })
    }

    async onIntersecting(entries: IntersectionObserverEntry[]) {
        entries.forEach((entry) => {
            if (entry.isIntersecting) {
                void this.renderInteractiveFigure(entry.target)
            }
        })
    }

    async renderExplorerIntoFigure(figure: Element) {
        const explorerUrl = figure.getAttribute(
            EXPLORER_EMBEDDED_FIGURE_SELECTOR
        )

        if (!explorerUrl) return

        const { fullUrl, queryStr } = Url.fromURL(explorerUrl)

        const html = await fetchText(fullUrl)
        const props: ExplorerProps = await buildExplorerProps(
            html,
            queryStr,
            this.selection
        )
        if (props.selection)
            this.graphersAndExplorersToUpdate.add(props.selection)
        ReactDOM.render(<Explorer {...props} />, figure)
    }

    private async _renderGrapherComponentIntoFigure(
        figure: Element,
        {
            configUrl,
            embedUrl,
            additionalConfig,
        }: {
            configUrl: string
            embedUrl?: Url
            additionalConfig?: Partial<GrapherProgrammaticInterface>
        }
    ) {
        const { queryStr, queryParams } = embedUrl ?? {}

        figure.classList.remove(GRAPHER_PREVIEW_CLASS)
        const common: GrapherProgrammaticInterface = {
            isEmbeddedInAnOwidPage: true,
            queryStr,
            adminBaseUrl: ADMIN_BASE_URL,
            bakedGrapherURL: BAKED_GRAPHER_URL,
        }

        const fetchedGrapherPageConfig = await fetchWithRetry(configUrl).then(
            (res) => res.json()
        )
        const grapherPageConfig = migrateGrapherConfigToLatestVersion(
            fetchedGrapherPageConfig
        )

        const figureConfigAttr = figure.getAttribute(
            GRAPHER_EMBEDDED_FIGURE_CONFIG_ATTR
        )
        const localConfig = figureConfigAttr ? JSON.parse(figureConfigAttr) : {}

        // make sure the tab of the active pane is visible
        if (figureConfigAttr && !isEmpty(localConfig)) {
            const activeTab = queryParams?.tab || grapherPageConfig.tab
            if (activeTab === GRAPHER_TAB_CONFIG_OPTIONS.chart)
                localConfig.hideChartTabs = false
            if (activeTab === GRAPHER_TAB_CONFIG_OPTIONS.map)
                localConfig.hasMapTab = true
            if (activeTab === GRAPHER_TAB_CONFIG_OPTIONS.table)
                localConfig.hasTableTab = true
        }

        const config = merge(
            {}, // merge mutates the first argument
            grapherPageConfig,
            common,
            additionalConfig,
            localConfig,
            {
                manager: {
                    selection: new SelectionArray(
                        this.selection.selectedEntityNames
                    ),
                },
            }
        )
        if (config.manager?.selection)
            this.graphersAndExplorersToUpdate.add(config.manager.selection)

        renderGrapherIntoContainer(config, figure, DATA_API_URL)

        // Special handling for shared collections
        // TODO: re-enable this
        // if (window.location.pathname.startsWith("/collection/custom")) {
        //     embedDynamicCollectionGrapher(grapherRef, figure)
        // }
    }

    async renderGrapherIntoFigure(figure: Element) {
        const embedUrlRaw = figure.getAttribute(GRAPHER_EMBEDDED_FIGURE_ATTR)
        if (!embedUrlRaw) return
        const embedUrl = Url.fromURL(embedUrlRaw)

        const configUrl = `${GRAPHER_DYNAMIC_CONFIG_URL}/${embedUrl.slug}.config.json`

        await this._renderGrapherComponentIntoFigure(figure, {
            configUrl,
            embedUrl,
        })
    }

    async _renderMultiDimWithControlsIntoFigure(
        figure: Element,
        multiDimConfig: MultiDimDataPageConfigEnriched,
        slug: string,
        queryStr: string
    ) {
        figure.classList.remove(GRAPHER_PREVIEW_CLASS)
        const figureConfigAttr = figure.getAttribute(
            GRAPHER_EMBEDDED_FIGURE_CONFIG_ATTR
        )
        const localGrapherConfig = figureConfigAttr
            ? JSON.parse(figureConfigAttr)
            : {}
        localGrapherConfig.manager = {
            selection: new SelectionArray(this.selection.selectedEntityNames),
        }
        if (localGrapherConfig.manager?.selection) {
            this.graphersAndExplorersToUpdate.add(
                localGrapherConfig.manager.selection
            )
        }
        ReactDOM.render(
            <MultiDim
                slug={slug}
                config={MultiDimDataPageConfig.fromObject(multiDimConfig)}
                localGrapherConfig={localGrapherConfig}
                queryStr={queryStr}
            />,
            figure
        )
    }

    async renderMultiDimIntoFigure(figure: Element) {
        const embedUrlRaw = figure.getAttribute(GRAPHER_EMBEDDED_FIGURE_ATTR)
        if (!embedUrlRaw) return
        const embedUrl = Url.fromURL(embedUrlRaw)

        const { queryStr, slug } = embedUrl
        if (!slug) return

        const mdimConfigUrl = `${MULTI_DIM_DYNAMIC_CONFIG_URL}/${slug}.json`
        const multiDimConfig = await fetchWithRetry(mdimConfigUrl).then((res) =>
            res.json()
        )

        if (embedUrl.queryParams.hideControls === "true") {
            const view = searchParamsToMultiDimView(
                multiDimConfig,
                new URLSearchParams(queryStr)
            )
            const configUrl = `${GRAPHER_DYNAMIC_CONFIG_URL}/by-uuid/${view.fullConfigId}.config.json`
            await this._renderGrapherComponentIntoFigure(figure, {
                configUrl,
                embedUrl,
            })
        } else {
            await this._renderMultiDimWithControlsIntoFigure(
                figure,
                multiDimConfig,
                slug,
                queryStr
            )
        }
    }

    async renderNarrativeChartIntoFigure(figure: Element) {
        const narrativeChartInfoRaw = figure.getAttribute(
            GRAPHER_NARRATIVE_CHART_CONFIG_FIGURE_ATTR
        )
        if (!narrativeChartInfoRaw) return
        const narrativeChartInfo: NarrativeChartInfo = JSON.parse(
            narrativeChartInfoRaw
        )
        if (!narrativeChartInfo) return

        const configUrl = `${GRAPHER_DYNAMIC_CONFIG_URL}/by-uuid/${narrativeChartInfo.chartConfigId}.config.json`

        await this._renderGrapherComponentIntoFigure(figure, {
            configUrl,
            additionalConfig: {
                hideRelatedQuestion: true,
                hideShareButton: true,
                hideExploreTheDataButton: false,
                narrativeChartInfo,
            },
        })
    }

    @action.bound
    async renderInteractiveFigure(figure: Element) {
        const isExplorer = figure.hasAttribute(
            EXPLORER_EMBEDDED_FIGURE_SELECTOR
        )
        const isMultiDim = figure.hasAttribute("data-is-multi-dim")
        const isNarrativeChart = figure.hasAttribute(
            GRAPHER_NARRATIVE_CHART_CONFIG_FIGURE_ATTR
        )

        const embedType: EmbedType = isExplorer
            ? "explorer"
            : isMultiDim
              ? "multiDim"
              : isNarrativeChart
                ? "narrativeChart"
                : "grapher"

        // Stop observing visibility as soon as possible
        this.figuresObserver?.unobserve(figure)

        await match(embedType)
            .with("explorer", () => this.renderExplorerIntoFigure(figure))
            .with("multiDim", () => this.renderMultiDimIntoFigure(figure))
            .with("narrativeChart", () =>
                this.renderNarrativeChartIntoFigure(figure)
            )
            .with("grapher", () => this.renderGrapherIntoFigure(figure))
            .exhaustive()
    }

    setUpGlobalEntitySelectorForEmbeds() {
        const element = globalEntitySelectorElement()
        if (!element) return

        const embeddedDefaultCountriesParam = element.getAttribute(
            GLOBAL_ENTITY_SELECTOR_DEFAULT_COUNTRY
        )

        const [defaultEntityNames, windowEntityNames] = [
            Url.fromQueryParams({
                country: embeddedDefaultCountriesParam || undefined,
            }),
            getWindowUrl(),
        ]
            .map(migrateSelectedEntityNamesParam)
            .map(getSelectedEntityNamesParam)

        this.selection = new SelectionArray(
            windowEntityNames ?? defaultEntityNames
        )

        hydrateGlobalEntitySelectorIfAny(
            this.selection,
            this.graphersAndExplorersToUpdate
        )
    }
}

export const MultiEmbedderSingleton = new MultiEmbedder()
