import React from "react"
import ReactDOM from "react-dom"
import { fetchText, isMobile } from "../../clientUtils/Util"
import { isPresent } from "../../clientUtils/isPresent"
import {
    GRAPHER_EMBEDDED_FIGURE_ATTR,
    GRAPHER_RENDER_TIMEOUT_ID,
} from "../../grapher/core/GrapherConstants"
import { deserializeJSONFromHTML } from "../../clientUtils/serializers"
import {
    Grapher,
    GrapherProgrammaticInterface,
} from "../../grapher/core/Grapher"
import { Explorer, ExplorerProps } from "../../explorer/Explorer"
import {
    EMBEDDED_EXPLORER_DELIMITER,
    EMBEDDED_EXPLORER_GRAPHER_CONFIGS,
    EXPLORER_EMBEDDED_FIGURE_SELECTOR,
} from "../../explorer/ExplorerConstants"
import {
    GLOBAL_ENTITY_SELECTOR_DEFAULT_COUNTRY,
    GLOBAL_ENTITY_SELECTOR_ELEMENT,
} from "../../grapher/controls/globalEntitySelector/GlobalEntitySelectorConstants"
import { getWindowUrl, Url } from "../../clientUtils/urls/Url"
import { SelectionArray } from "../../grapher/selection/SelectionArray"
import {
    getSelectedEntityNamesParam,
    migrateSelectedEntityNamesParam,
} from "../../grapher/core/EntityUrlBuilder"
import { hydrateGlobalEntitySelectorIfAny } from "../../grapher/controls/globalEntitySelector/GlobalEntitySelector"

const figuresFromDOM = (
    container: HTMLElement | Document = document,
    selector: string
) =>
    Array.from(
        container.querySelectorAll<HTMLElement>(`*[${selector}]`)
    ).filter(isPresent)

// Determine whether this device is powerful enough to handle
// loading a bunch of inline interactive charts
// 680px is also used in CSS – keep it in sync if you change this
export const shouldProgressiveEmbed = () =>
    !isMobile() ||
    window.screen.width > 680 ||
    pageContainsGlobalEntitySelector()

const pageContainsGlobalEntitySelector = () =>
    globalEntitySelectorElement() !== null

const globalEntitySelectorElement = () =>
    document.querySelector(GLOBAL_ENTITY_SELECTOR_ELEMENT)

class MultiEmbedder {
    // private figures: EmbeddedFigure[] = []
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
        }
    }

    /**
     * Finds all <figure data-grapher-src="..."> elements in the document and loads the iframeless
     * interactive charts when the user's viewport approaches them. Sets up a scroll event listener.
     *
     * BEWARE: this method is hardcoded in some scripts, make sure to check thoroughly before making
     * any changes.
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
        const figures = figuresFromDOM(
            container,
            GRAPHER_EMBEDDED_FIGURE_ATTR
        ).concat(figuresFromDOM(container, EXPLORER_EMBEDDED_FIGURE_SELECTOR))

        figures.forEach((figure) => {
            // TODO (?) Prevent adding duplicates
            this.figuresObserver?.observe(figure)
        })
    }

    async onIntersecting(entries: IntersectionObserverEntry[]) {
        entries.forEach((entry) => {
            if (entry.isIntersecting) {
                this.renderInteractiveFigure(entry.target)
            }
        })
    }

    async renderInteractiveFigure(figure: Element) {
        const isExplorer = figure.hasAttribute(
            EXPLORER_EMBEDDED_FIGURE_SELECTOR
        )
        const hasPreview = isExplorer ? false : !!figure.querySelector("img")
        if (!shouldProgressiveEmbed() && hasPreview) return

        const dataSrc = figure.getAttribute(
            isExplorer
                ? EXPLORER_EMBEDDED_FIGURE_SELECTOR
                : GRAPHER_EMBEDDED_FIGURE_ATTR
        )

        if (!dataSrc) return

        // Stop observing visibility as rendering won't stop from here
        this.figuresObserver?.unobserve(figure)

        const { fullUrl, queryStr } = Url.fromURL(dataSrc)

        const common: GrapherProgrammaticInterface = {
            isEmbeddedInAnOwidPage: true,
            queryStr,
        }

        const html = await fetchText(fullUrl)

        if (isExplorer) {
            const props: ExplorerProps = {
                ...common,
                ...deserializeJSONFromHTML(html, EMBEDDED_EXPLORER_DELIMITER),
                grapherConfigs: deserializeJSONFromHTML(
                    html,
                    EMBEDDED_EXPLORER_GRAPHER_CONFIGS
                ),
                queryStr,
                selection: new SelectionArray(
                    this.selection.selectedEntityNames
                ),
            }
            if (props.selection)
                this.graphersAndExplorersToUpdate.add(props.selection)
            ReactDOM.render(<Explorer {...props} />, figure)
        } else {
            figure.classList.remove("grapherPreview")
            const config: GrapherProgrammaticInterface = {
                ...deserializeJSONFromHTML(html),
                ...common,
                manager: {
                    selection: new SelectionArray(
                        this.selection.selectedEntityNames
                    ),
                },
            }
            if (config.manager?.selection)
                this.graphersAndExplorersToUpdate.add(config.manager.selection)
            Grapher.renderGrapherIntoContainer(config, figure)
        }
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
