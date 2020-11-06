import { Explorer } from "./Explorer"
import { excludeUndefined } from "grapher/utils/Util"
import { Figure, LoadProps } from "site/client/figures/Figure"
import { splitURLintoPathAndQueryString } from "utils/client/url"

interface ExplorerFigureProps {
    queryStr?: string
    container: HTMLElement
}

export class ExplorerFigure implements Figure {
    private props: ExplorerFigureProps
    constructor(props: ExplorerFigureProps) {
        this.props = props
    }

    private _isLoaded: boolean = false

    get isLoaded() {
        return this._isLoaded
    }

    get hasPreview() {
        return false
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
            Explorer.createExplorerAndRenderToDom({
                containerNode: this.container,
                isEmbed: true,
                queryStr: this.props.queryStr,
                globalEntitySelection: loadProps.globalEntitySelection,
                slug: "",
                explorerProgramCode: "",
            })
        }
    }

    static figuresFromDOM(
        container: HTMLElement | Document = document
    ): ExplorerFigure[] {
        const elements = Array.from(
            container.querySelectorAll<HTMLElement>("*[data-explorer-src]")
        )
        return excludeUndefined(
            elements.map((element) => {
                const dataSrc = element.getAttribute("data-explorer-src")
                if (!dataSrc) return undefined
                const {
                    path: explorerUrl,
                    queryString: queryStr,
                } = splitURLintoPathAndQueryString(dataSrc)
                if (!explorerUrl.includes("explorer")) return undefined
                return new ExplorerFigure({
                    queryStr,
                    container: element,
                })
            })
        )
    }
}
