import { ChartView } from "charts/ChartView"
import { excludeUndefined, fetchText } from "charts/Util"

import { Figure, LoadProps } from "./Figure"
import { splitURLintoPathAndQueryString } from "utils/client/url"

/**
 * Given the HTML of a ChartPage, it extracts the chart's config as JSON
 */
export function readConfigFromHTML(html: string): any {
    const m = html.match(/jsonConfig\s*=\s*(\{.+\})/)
    return m ? JSON.parse(m[1]) : undefined
}

interface ChartFigureProps {
    configUrl: string
    queryStr?: string
    container: HTMLElement // TODO rename to container
}

export class ChartFigure implements Figure {
    private props: ChartFigureProps
    constructor(props: ChartFigureProps) {
        this.props = props
    }

    private _isLoaded: boolean = false
    private jsonConfig?: any

    get isLoaded() {
        return this._isLoaded
    }

    get hasPreview() {
        return !!this.container.querySelector("img")
    }

    get container() {
        return this.props.container
    }

    get boundingRect() {
        return this.container.getBoundingClientRect()
    }

    async load(loadProps: LoadProps) {
        if (!this._isLoaded) {
            this._isLoaded = true
            const html = await fetchText(this.props.configUrl)
            this.jsonConfig = readConfigFromHTML(html)
            this.container.classList.remove("grapherPreview")
            ChartView.bootstrap({
                jsonConfig: this.jsonConfig,
                containerNode: this.container,
                isEmbed: true,
                queryStr: this.props.queryStr,
                globalEntitySelection: loadProps.globalEntitySelection
            })
        }
    }

    static figuresFromDOM(
        container: HTMLElement | Document = document
    ): ChartFigure[] {
        const elements = Array.from(
            container.querySelectorAll<HTMLElement>("*[data-grapher-src]")
        )
        return excludeUndefined(
            elements.map(element => {
                const dataSrc = element.getAttribute("data-grapher-src")
                if (!dataSrc) return undefined
                const { path, queryString } = splitURLintoPathAndQueryString(
                    dataSrc
                )
                return new ChartFigure({
                    configUrl: path,
                    queryStr: queryString,
                    container: element
                })
            })
        )
    }
}
