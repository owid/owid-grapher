import { bind } from "decko"

import { throttle, isMobile } from "grapher/utils/Util"
import {
    GlobalEntitySelection,
    pageContainsGlobalEntityControl,
} from "grapher/controls/globalEntityControl/GlobalEntitySelection"
import { Figure } from "./figures/Figure"
import { ChartFigure } from "./figures/ChartFigure"
import { ExplorerFigure } from "explorer/client/ExplorerFigure"

// Determine whether this device is powerful enough to handle
// loading a bunch of inline interactive charts
export function shouldProgressiveEmbed() {
    // 680px is also used in CSS – keep it in sync if you change this
    return (
        !isMobile() ||
        window.screen.width > 680 ||
        pageContainsGlobalEntityControl()
    )
}

/** Private class – use `GrapherPageUtils` to access functionality. */
class MultiEmbedder {
    private figures: Figure[] = []
    private globalEntitySelection?: GlobalEntitySelection

    constructor(
        options: {
            globalEntitySelection?: GlobalEntitySelection
        } = {}
    ) {
        this.globalEntitySelection = options.globalEntitySelection
    }

    @bind private addFigure(figure: Figure) {
        // Prevent adding duplicates
        if (!this.figures.map((f) => f.container).includes(figure.container)) {
            this.figures.push(figure)
        }
    }

    @bind private shouldLoadFigure(figure: Figure) {
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
    @bind public loadVisibleFigures() {
        this.figures.filter(this.shouldLoadFigure).forEach((figure) =>
            figure.load({
                globalEntitySelection: this.globalEntitySelection,
            })
        )
    }

    /**
     * Make the embedder aware of new <figure> elements that are injected into the DOM.
     *
     * Use this when you programmatically create/replace charts.
     */
    @bind public addFiguresFromDOM(
        container: HTMLElement | Document = document
    ) {
        ChartFigure.figuresFromDOM(container).forEach(this.addFigure)
        ExplorerFigure.figuresFromDOM(container).forEach(this.addFigure)
        // Trigger load for any added figures
        this.loadVisibleFiguresThrottled()
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
 * `window.GrapherPageUtils`.
 *
 * Ensures only a single GrapherPageUtilsSingleton instance exists in the current window.
 *
 */
export class GrapherPageUtils {
    // Since this static class can be imported as well as loaded in a hardcoded script through
    // `window.GrapherPageUtils`, we need to ensure an identical instance is used across all contexts.
    private static getInstance(): GrapherPageUtilsSingleton {
        const instance = (window as any).GrapherPageUtilsSingleton as
            | GrapherPageUtilsSingleton
            | undefined

        if (instance) {
            return instance
        } else {
            const instance = new GrapherPageUtilsSingleton()
            ;(window as any).GrapherPageUtilsSingleton = instance
            return instance
        }
    }

    public static get globalEntitySelection(): GlobalEntitySelection {
        return this.getInstance().globalEntitySelection
    }

    public static get embedder(): MultiEmbedder {
        return this.getInstance().embedder
    }

    /**
     * Finds all <figure data-grapher-src="..."> elements in the document and loads the iframeless
     * interactive charts when the user's viewport approaches them. Sets up a scroll event listener.
     *
     * BEWARE: this method is hardcoded in some scripts, make sure to check thoroughly before making
     * any changes.
     */
    public static embedAll() {
        this.getInstance().embedder.addFiguresFromDOM().watchScroll()
    }
}

/**
 * Private singleton class.
 *
 * Use `window.GrapherPageUtils` or import the `GrapherPageUtils` static class to access its functionality. `GrapherPageUtils`
 * ensures that only a single `GrapherPageUtilsSingleton` is instantiated in a window.
 */
class GrapherPageUtilsSingleton {
    public globalEntitySelection: GlobalEntitySelection
    public embedder: MultiEmbedder

    public constructor() {
        this.globalEntitySelection = new GlobalEntitySelection()
        this.embedder = new MultiEmbedder({
            globalEntitySelection: this.globalEntitySelection,
        })
    }
}
