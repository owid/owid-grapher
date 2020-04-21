import { bind } from "decko"

import { ChartView } from "charts/ChartView"
import { throttle, isMobile, fetchText } from "charts/Util"
import { GlobalEntitySelection } from "./GlobalEntitySelection"

interface LoadableFigure {
    configUrl: string
    queryStr: string
    element: HTMLElement
    jsonConfig?: any
    isActive?: true
}

// Given the html for a chart, extract the JSON config fragment
export function readConfigFromHTML(html: string): any {
    const m = html.match(/jsonConfig\s*=\s*(\{.+\})/)
    return m ? JSON.parse(m[1]) : undefined
}

// Determine whether this device is powerful enough to handle
// loading a bunch of inline interactive charts
export function shouldProgressiveEmbed() {
    // 680px is also used in CSS – keep it in sync if you change this
    return !isMobile() || window.screen.width > 680
}

/** Private class – use `Grapher` to access functionality. */
class MultiEmbedder {
    figures: LoadableFigure[] = []
    globalEntitySelection?: GlobalEntitySelection

    constructor(
        options: {
            globalEntitySelection?: GlobalEntitySelection
        } = {}
    ) {
        this.globalEntitySelection = options.globalEntitySelection
    }

    private figureIsLoaded(figure: LoadableFigure): boolean {
        return !!figure.isActive
    }

    private figureCanBeLoaded(figure: LoadableFigure): boolean {
        return figure.jsonConfig != null
    }

    private addFigure(figure: LoadableFigure) {
        // Prevent adding duplicates
        if (!this.figures.map(f => f.element).includes(figure.element)) {
            this.figures.push(figure)
        }
    }

    private shouldLoadFigure(figure: LoadableFigure) {
        const preloadDistance = window.innerHeight * 4
        const windowTop = window.pageYOffset
        const windowBottom = window.pageYOffset + window.innerHeight
        const figureRect = figure.element.getBoundingClientRect()
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

    private loadFigure(figure: LoadableFigure) {
        if (!figure.isActive && figure.jsonConfig) {
            figure.isActive = true
            figure.element.classList.remove("grapherPreview")
            ChartView.bootstrap({
                jsonConfig: figure.jsonConfig,
                containerNode: figure.element,
                isEmbed:
                    figure.element.parentNode !== document.body || undefined,
                queryStr: figure.queryStr,
                globalEntitySelection: this.globalEntitySelection
            })
        }
    }

    private loadVisibleFiguresThrottled = throttle(
        this.loadVisibleFigures.bind(this),
        200
    )

    // Check for figures which are available to load and load them
    @bind public loadVisibleFigures() {
        this.figures.forEach(figure => {
            if (
                !this.figureIsLoaded(figure) &&
                this.figureCanBeLoaded(figure) &&
                this.shouldLoadFigure(figure)
            ) {
                this.loadFigure(figure)
            }
        })
    }

    @bind public addFiguresFromDOM(
        container: HTMLElement | Document = document
    ) {
        const figures = Array.from(
            container.querySelectorAll<HTMLElement>("*[data-grapher-src]")
        )

        for (const element of figures) {
            const dataSrc = element.getAttribute("data-grapher-src")
            if (dataSrc) {
                // Only load inline embeds if the device is powerful enough, or if there's no static preview available
                if (shouldProgressiveEmbed() || !element.querySelector("img")) {
                    const [configUrl, queryStr] = dataSrc.split(/\?/)
                    const figure: LoadableFigure = {
                        configUrl,
                        queryStr,
                        element
                    }
                    this.addFigure(figure)

                    fetchText(configUrl).then(html => {
                        figure.jsonConfig = readConfigFromHTML(html)
                        this.loadVisibleFiguresThrottled()
                    })
                }
            }
        }

        return this
    }

    private watchingScroll: boolean = false

    @bind public watchScroll() {
        if (!this.watchingScroll) {
            window.addEventListener("scroll", this.loadVisibleFiguresThrottled)
            this.watchingScroll = true
        }
        return this
    }

    @bind public unwatchScroll() {
        if (this.watchingScroll) {
            window.removeEventListener(
                "scroll",
                this.loadVisibleFiguresThrottled
            )
            this.watchingScroll = false
        }
        return this
    }
}

/**
 * Global entry point for initializing charts. You can import this static class or use it through
 * `window.Grapher`.
 *
 * Ensures only a single GrapherSingleton instance exists in the current window.
 *
 */
export class Grapher {
    // Since this static class can be imported as well as loaded in a hardcoded script through
    // `window.Grapher`, we need to ensure an identical instance is used across all contexts.
    private static getInstance(): GrapherSingleton {
        const instance = (window as any).GrapherSingleton as
            | GrapherSingleton
            | undefined

        if (instance) {
            return instance
        } else {
            const instance = new GrapherSingleton()
            ;(window as any).GrapherSingleton = instance
            return instance
        }
    }

    /**
     * Finds all <figure data-grapher-src="..."> elements in the document and loads the iframeless
     * interactive charts when the user's viewport approaches them. Sets up a scroll event listener.
     */
    public static embedAll() {
        this.getInstance().embedAll()
    }

    /**
     * A trigger to load any interactive charts that have become visible.
     *
     * You can use this method when a hidden chart (display:none) becomes visible. The embedder
     * otherwise automatically loads interactive charts when they approach the viewport.
     */
    public static loadVisibleFigures() {
        this.getInstance().loadVisibleFigures()
    }

    /**
     * Make the embedder aware of new <figure> elements that are injected into the DOM.
     *
     * Use this when you programmatically create/replace charts.
     */
    public static addFiguresFromDOM(container: HTMLElement) {
        this.getInstance().addFiguresFromDOM(container)
    }
}

/**
 * Private singleton class.
 *
 * Use `window.Grapher` or import the `Grapher` static class to access its functionality. `Grapher`
 * ensures that only a single `GrapherSingleton` is instantiated in a window.
 */
class GrapherSingleton {
    public globalEntitySelection: GlobalEntitySelection
    public embedder: MultiEmbedder

    public constructor() {
        this.globalEntitySelection = new GlobalEntitySelection()
        this.embedder = new MultiEmbedder({
            globalEntitySelection: this.globalEntitySelection
        })
    }

    public embedAll() {
        this.embedder.addFiguresFromDOM().watchScroll()
    }

    public loadVisibleFigures() {
        this.embedder.loadVisibleFigures()
    }

    public addFiguresFromDOM(container: HTMLElement) {
        this.embedder.addFiguresFromDOM(container)
    }
}
