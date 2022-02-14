import React from "react"
import ReactDOM from "react-dom"
import { fetchText, isMobile } from "../../clientUtils/Util.js"
import { isPresent } from "../../clientUtils/isPresent.js"
import { GRAPHER_EMBEDDED_FIGURE_ATTR } from "../../grapher/core/GrapherConstants.js"
import { deserializeJSONFromHTML } from "../../clientUtils/serializers.js"
import {
    Grapher,
    GrapherProgrammaticInterface,
} from "../../grapher/core/Grapher.js"
import { Explorer, ExplorerProps } from "../../explorer/Explorer.js"
import {
    EMBEDDED_EXPLORER_DELIMITER,
    EMBEDDED_EXPLORER_GRAPHER_CONFIGS,
    EXPLORER_EMBEDDED_FIGURE_SELECTOR,
} from "../../explorer/ExplorerConstants.js"
import {
    GLOBAL_ENTITY_SELECTOR_DEFAULT_COUNTRY,
    GLOBAL_ENTITY_SELECTOR_ELEMENT,
} from "../../grapher/controls/globalEntitySelector/GlobalEntitySelectorConstants.js"
import { getWindowUrl, Url } from "../../clientUtils/urls/Url.js"
import { SelectionArray } from "../../grapher/selection/SelectionArray.js"
import {
    getSelectedEntityNamesParam,
    migrateSelectedEntityNamesParam,
} from "../../grapher/core/EntityUrlBuilder.js"
import { hydrateGlobalEntitySelectorIfAny } from "../../grapher/controls/globalEntitySelector/GlobalEntitySelector.js"
import { action } from "mobx"
import { Annotation } from "../../clientUtils/owidTypes.js"
import { hydrateAnnotatingDataValue } from "../AnnotatingDataValue.js"

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
        } else {
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
        const figures = figuresFromDOM(
            container,
            GRAPHER_EMBEDDED_FIGURE_ATTR
        ).concat(figuresFromDOM(container, EXPLORER_EMBEDDED_FIGURE_SELECTOR))

        figures.forEach((figure) => {
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

    @action.bound
    async renderInteractiveFigure(figure: Element, annotation?: Annotation) {
        const isExplorer = figure.hasAttribute(
            EXPLORER_EMBEDDED_FIGURE_SELECTOR
        )

        const dataSrc = figure.getAttribute(
            isExplorer
                ? EXPLORER_EMBEDDED_FIGURE_SELECTOR
                : GRAPHER_EMBEDDED_FIGURE_ATTR
        )

        if (!dataSrc) return

        const hasPreview = isExplorer ? false : !!figure.querySelector("img")
        if (!shouldProgressiveEmbed() && hasPreview) return

        // Stop observing visibility as soon as possible, that is not before
        // shouldProgressiveEmbed gets a chance to reevaluate a possible change
        // in screen size on mobile (i.e. after a rotation). Stopping before
        // shouldProgressiveEmbed would prevent rendering interactive charts
        // when going from portrait to landscape mode (without page reload).
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
                annotation,
            }
            if (config.manager?.selection)
                this.graphersAndExplorersToUpdate.add(config.manager.selection)

            const grapherInstance = Grapher.renderGrapherIntoContainer(
                config,
                figure
            )
            if (!grapherInstance) return
            hydrateAnnotatingDataValue(grapherInstance, figure)
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
