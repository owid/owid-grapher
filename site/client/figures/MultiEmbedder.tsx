import React from "react"
import ReactDOM from "react-dom"
import { throttle, fetchText, isPresent } from "grapher/utils/Util"
import {
    GlobalEntitySelectionSingleton,
    shouldProgressiveEmbed,
    GlobalEntitySelection,
} from "grapher/controls/globalEntityControl/GlobalEntitySelection"
import { GRAPHER_EMBEDDED_FIGURE_ATTR } from "grapher/core/GrapherConstants"
import { splitURLintoPathAndQueryString } from "utils/client/url"
import { deserializeJSONFromHTML } from "utils/serializers"
import { Grapher, GrapherProgrammaticInterface } from "grapher/core/Grapher"
import { Explorer } from "explorer/client/Explorer"
import { EXPLORER_EMBEDDED_FIGURE_SELECTOR } from "explorer/client/ExplorerConstants"

interface EmbeddedFigureProps {
    configUrl: string
    queryStr?: string
    container: HTMLElement
}

class EmbeddedFigure {
    protected props: EmbeddedFigureProps
    private isExplorer: boolean
    constructor(props: EmbeddedFigureProps, isExplorer = false) {
        this.props = props
        this.isExplorer = isExplorer
    }

    async renderIntoContainer(globalEntitySelection?: GlobalEntitySelection) {
        if (this._isLoaded) return
        this._isLoaded = true

        const common = {
            isEmbed: true,
            globalEntitySelection,
            queryStr: this.props.queryStr,
        }

        if (this.isExplorer) {
            const props = {
                ...common,
                queryString: this.props.queryStr,
                slug: "",
                program: "",
            }
            ReactDOM.render(<Explorer {...props} />, this.container)
            return
        }
        const html = await fetchText(this.props.configUrl)
        this.container.classList.remove("grapherPreview")
        const config: GrapherProgrammaticInterface = {
            ...deserializeJSONFromHTML(html),
            ...common,
        }
        Grapher.renderGrapherIntoContainer(config, this.container)
    }

    protected _isLoaded = false

    get isLoaded() {
        return this._isLoaded
    }

    get hasPreview() {
        return this.isExplorer ? false : !!this.container.querySelector("img")
    }

    get container() {
        return this.props.container
    }

    get boundingRect() {
        return this.container.getBoundingClientRect()
    }
}

const getAllEmbeddedFiguresInDOM = (
    container: HTMLElement | Document = document
) =>
    figuresFromDOM(container, GRAPHER_EMBEDDED_FIGURE_ATTR).concat(
        figuresFromDOM(container, EXPLORER_EMBEDDED_FIGURE_SELECTOR)
    )

const figuresFromDOM = (
    container: HTMLElement | Document = document,
    selector: string
) =>
    Array.from(container.querySelectorAll<HTMLElement>(`*[${selector}]`))
        .map((element) => {
            const dataSrc = element.getAttribute(selector)
            if (!dataSrc) return undefined
            const { path, queryString } = splitURLintoPathAndQueryString(
                dataSrc
            )
            const configUrl = path
            const queryStr = queryString
            const container = element
            const isExplorer = selector !== GRAPHER_EMBEDDED_FIGURE_ATTR

            if (isExplorer && configUrl.includes("explorer")) return undefined

            return new EmbeddedFigure(
                {
                    container,
                    configUrl,
                    queryStr,
                },
                isExplorer
            )
        })
        .filter(isPresent)

class MultiEmbedder {
    private figures: EmbeddedFigure[] = []
    private globalEntitySelection: GlobalEntitySelection

    constructor(globalEntitySelection: GlobalEntitySelection) {
        this.globalEntitySelection = globalEntitySelection
    }

    private shouldLoadFigure(figure: EmbeddedFigure) {
        if (figure.isLoaded) return false
        if (!shouldProgressiveEmbed() && figure.hasPreview) return false

        const preloadDistance = window.innerHeight * 4
        const windowTop = window.pageYOffset
        const windowBottom = window.pageYOffset + window.innerHeight
        const figureRect = figure.boundingRect
        const bodyRect = document.body.getBoundingClientRect()
        const figureTop = figureRect.top - bodyRect.top
        const figureBottom = figureRect.bottom - bodyRect.top
        return (
            windowBottom + preloadDistance >= figureTop &&
            windowTop - preloadDistance <= figureBottom &&
            figureRect.width > 0 &&
            figureRect.height > 0
        )
    }

    private loadVisibleFiguresThrottled = throttle(
        this.loadVisibleFigures.bind(this),
        200
    )

    /**
     * A trigger to load any interactive charts that have become visible.
     *
     * You can use this method when a hidden chart (display:none) becomes visible. The embedder
     * otherwise automatically loads interactive charts when they approach the viewport.
     */
    loadVisibleFigures() {
        this.figures
            .filter(this.shouldLoadFigure)
            .forEach((figure) =>
                figure.renderIntoContainer(this.globalEntitySelection)
            )
    }

    /**
     * Make the embedder aware of new <figure> elements that are injected into the DOM.
     *
     * Use this when you programmatically create/replace charts.
     */
    addFiguresFromDOM(container: HTMLElement | Document = document) {
        getAllEmbeddedFiguresInDOM(container).forEach((figure) => {
            // Prevent adding duplicates
            if (!this.figures.some((fig) => fig.container === figure.container))
                this.figures.push(figure)
        })

        // Trigger load for any added figures
        this.loadVisibleFiguresThrottled()
        return this
    }

    private watchingScroll = false

    watchScroll() {
        if (this.watchingScroll) return this

        window.addEventListener("scroll", this.loadVisibleFiguresThrottled)
        this.watchingScroll = true

        return this
    }

    /**
     * Finds all <figure data-grapher-src="..."> elements in the document and loads the iframeless
     * interactive charts when the user's viewport approaches them. Sets up a scroll event listener.
     *
     * BEWARE: this method is hardcoded in some scripts, make sure to check thoroughly before making
     * any changes.
     */
    embedAll() {
        this.addFiguresFromDOM().watchScroll()
    }
}

export const MultiEmbedderSingleton = new MultiEmbedder(
    GlobalEntitySelectionSingleton
)
