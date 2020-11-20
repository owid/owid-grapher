import { excludeUndefined, fetchText } from "grapher/utils/Util"
import { Figure, LoadProps } from "./Figure"
import { splitURLintoPathAndQueryString } from "utils/client/url"
import { Grapher } from "grapher/core/Grapher"
import { deserializeJSONFromHTML } from "utils/serializers"
import { GRAPHER_FIGURE_ATTR } from "grapher/core/GrapherConstants"

interface GrapherFigureProps {
    configUrl: string
    queryStr?: string
    container: HTMLElement // TODO rename to container
}

export class GrapherFigure implements Figure {
    private props: GrapherFigureProps
    constructor(props: GrapherFigureProps) {
        this.props = props
    }

    private _isLoaded = false
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
            this.jsonConfig = deserializeJSONFromHTML(html)
            this.container.classList.remove("grapherPreview")
            Grapher.bootstrap({
                jsonConfig: this.jsonConfig,
                containerNode: this.container,
                isEmbed: true,
                queryStr: this.props.queryStr,
                globalEntitySelection: loadProps.globalEntitySelection,
            })
        }
    }

    static figuresFromDOM(
        container: HTMLElement | Document = document
    ): GrapherFigure[] {
        const elements = Array.from(
            container.querySelectorAll<HTMLElement>(`*[${GRAPHER_FIGURE_ATTR}]`)
        )
        return excludeUndefined(
            elements.map((element) => {
                const dataSrc = element.getAttribute(GRAPHER_FIGURE_ATTR)
                if (!dataSrc) return undefined
                const { path, queryString } = splitURLintoPathAndQueryString(
                    dataSrc
                )
                return new GrapherFigure({
                    configUrl: path,
                    queryStr: queryString,
                    container: element,
                })
            })
        )
    }
}
