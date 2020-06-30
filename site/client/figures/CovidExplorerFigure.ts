import { CovidDataExplorer } from "charts/covidDataExplorer/CovidDataExplorer"
import { covidDashboardSlug } from "charts/covidDataExplorer/CovidConstants"
import { excludeUndefined } from "charts/Util"

import { Figure, LoadProps } from "./Figure"

interface CovidExplorerFigureProps {
    queryStr: string
    container: HTMLElement
}

export class CovidExplorerFigure extends Figure {
    private props: CovidExplorerFigureProps
    constructor(props: CovidExplorerFigureProps) {
        super()
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
            CovidDataExplorer.bootstrap({
                containerNode: this.container,
                isEmbed: true,
                queryStr: this.props.queryStr
            })
        }
    }

    static figuresFromDOM(
        container: HTMLElement | Document = document
    ): CovidExplorerFigure[] {
        const elements = Array.from(
            container.querySelectorAll<HTMLElement>("*[data-explorer-src]")
        )
        return excludeUndefined(
            elements.map(element => {
                const dataSrc = element.getAttribute("data-explorer-src")
                if (!dataSrc) return undefined
                const [explorerUrl, queryStr] = dataSrc.split(/\?/)
                if (!explorerUrl.includes(covidDashboardSlug)) return undefined
                return new CovidExplorerFigure({
                    queryStr,
                    container: element
                })
            })
        )
    }
}
