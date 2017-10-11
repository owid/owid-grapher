import ChartView from './ChartView'

interface LoadableFigure {
    configUrl: string
    queryStr: string
    element: HTMLElement
    jsonConfig?: any
    isActive?: true
}

export class MultiEmbedder {
    figuresToLoad: LoadableFigure[] = []
    constructor() {
        Array.from(document.getElementsByTagName("figure")).forEach(element => {
            const dataSrc = element.getAttribute('data-grapher-src')
            if (dataSrc) {
                const [configUrl, queryStr] = dataSrc.split(/\?/)
                const figure: LoadableFigure = { configUrl, queryStr, element }
                this.figuresToLoad.push(figure)

                fetch(configUrl + ".config.json").then(data => data.json()).then(jsonConfig => {
                    figure.jsonConfig = jsonConfig
                    this.update()
                })
            }
        })

        window.addEventListener('scroll', () => this.update())
    }

    // Check for figures which are available to load and load them
    update() {
        this.figuresToLoad.forEach(figure => {
            if (!figure.isActive && figure.jsonConfig) {
                const windowTop = window.scrollY
                const windowBottom = window.scrollY + window.innerHeight
                const figureRect = figure.element.getBoundingClientRect()
                const bodyRect = document.body.getBoundingClientRect()
                const figureTop = figureRect.top-bodyRect.top
                const figureBottom = figureRect.bottom-bodyRect.top
                if (windowBottom >= figureTop && windowTop <= figureBottom) {
                    figure.isActive = true
                    ChartView.bootstrap({ jsonConfig: figure.jsonConfig, containerNode: figure.element, isEmbed: true, queryStr: figure.queryStr })
                }
            }
        })
    }
}

// Global entry point for initializing charts
export default class Grapher {
    // Look for all <figure data-grapher-src="..."> elements in the document and turn them
    // into iframeless embeds
    static embedder: MultiEmbedder
    static embedAll() {
        this.embedder = new MultiEmbedder()
    }
}
