import React from "react"
import ReactDOM from "react-dom"
import { GlobalEntitySelection } from "grapher/controls/globalEntityControl/GlobalEntitySelection"
import { GRAPHER_EMBEDDED_FIGURE_ATTR } from "grapher/core/GrapherConstants"
import { fetchText, isPresent } from "grapher/utils/Util"
import { splitURLintoPathAndQueryString } from "utils/client/url"
import { deserializeJSONFromHTML } from "utils/serializers"
import { Grapher } from "grapher/core/Grapher"
import { Explorer } from "explorer/client/Explorer"
import { EXPLORER_EMBEDDED_FIGURE_SELECTOR } from "explorer/client/ExplorerConstants"

interface EmbeddedFigureProps {
    configUrl: string
    queryStr?: string
    container: HTMLElement
}

export class EmbeddedFigure {
    protected props: EmbeddedFigureProps
    private isExplorer: boolean
    constructor(props: EmbeddedFigureProps, isExplorer = false) {
        this.props = props
        this.isExplorer = isExplorer
    }

    async renderIntoContainer(globalEntitySelection?: GlobalEntitySelection) {
        if (this._isLoaded) return
        this._isLoaded = true

        if (this.isExplorer) {
            const props = {
                isEmbed: true,
                queryString: this.props.queryStr,
                globalEntitySelection,
                slug: "",
                program: "",
            }
            ReactDOM.render(<Explorer {...props} />, this.container)
            return
        }
        const html = await fetchText(this.props.configUrl)
        this.container.classList.remove("grapherPreview")
        Grapher.renderGrapherComponentIntoContainer({
            jsonConfig: deserializeJSONFromHTML(html),
            containerNode: this.container,
            isEmbed: true,
            queryStr: this.props.queryStr,
            globalEntitySelection,
        })
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

export const getAllEmbeddedFiguresInDOM = (
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
            if (selector === GRAPHER_EMBEDDED_FIGURE_ATTR)
                return new EmbeddedFigure({
                    container,
                    configUrl,
                    queryStr,
                })

            if (!configUrl.includes("explorer")) return undefined
            return new EmbeddedFigure(
                {
                    container,
                    configUrl,
                    queryStr,
                },
                true
            )
        })
        .filter(isPresent)
