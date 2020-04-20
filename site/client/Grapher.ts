import { ChartView } from "charts/ChartView"
import { throttle, isMobile } from "charts/Util"
import { CLASS_NAME as ADDITONAL_INFORMATION_CLASS_NAME } from "site/client/blocks/AdditionalInformation/AdditionalInformation"
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

export class MultiEmbedder {
    figuresToLoad: LoadableFigure[] = []
    globalEntitySelection?: GlobalEntitySelection
    constructor(
        container: HTMLElement | Document = document,
        globalEntitySelection?: GlobalEntitySelection
    ) {
        this.globalEntitySelection = globalEntitySelection
        const figures = Array.from(
            container.querySelectorAll("*[data-grapher-src]")
        ).filter(figure =>
            container === document
                ? figure.closest(`.${ADDITONAL_INFORMATION_CLASS_NAME}`) ===
                  null
                : figure.closest(`.${ADDITONAL_INFORMATION_CLASS_NAME}`) !==
                  null
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
                        element: element as HTMLElement
                    }
                    this.figuresToLoad.push(figure)

                    fetch(configUrl)
                        .then(data => data.text())
                        .then(html => {
                            figure.jsonConfig = readConfigFromHTML(html)
                            this.update()
                        })
                }
            }
        }

        window.addEventListener(
            "scroll",
            throttle(() => this.update(), 100)
        )
    }

    // Check for figures which are available to load and load them
    update() {
        const preloadDistance = window.innerHeight * 4
        this.figuresToLoad.forEach(figure => {
            if (!figure.isActive && figure.jsonConfig) {
                const windowTop = window.pageYOffset
                const windowBottom = window.pageYOffset + window.innerHeight
                const figureRect = figure.element.getBoundingClientRect()
                const bodyRect = document.body.getBoundingClientRect()
                const figureTop = figureRect.top - bodyRect.top
                const figureBottom = figureRect.bottom - bodyRect.top
                if (
                    windowBottom + preloadDistance >= figureTop &&
                    windowTop - preloadDistance <= figureBottom
                ) {
                    figure.isActive = true
                    figure.element.classList.remove("grapherPreview")
                    ChartView.bootstrap({
                        jsonConfig: figure.jsonConfig,
                        containerNode: figure.element,
                        isEmbed:
                            figure.element.parentNode !== document.body ||
                            undefined,
                        queryStr: figure.queryStr,
                        globalEntitySelection: this.globalEntitySelection
                    })
                }
            }
        })
    }
}

// Global entry point for initializing charts
export class Grapher {
    static globalEntitySelection: GlobalEntitySelection
    // Look for all <figure data-grapher-src="..."> elements in the document and turn them
    // into iframeless embeds
    static embedder: MultiEmbedder
    static embedAll() {
        this.globalEntitySelection = new GlobalEntitySelection()
        this.embedder = new MultiEmbedder(undefined, this.globalEntitySelection)
    }
}
