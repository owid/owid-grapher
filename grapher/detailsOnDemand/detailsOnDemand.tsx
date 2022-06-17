import React from "react"
import { observer } from "mobx-react"
import { GrapherInterface } from "../core/GrapherInterface.js"
import { TooltipManager } from "../tooltip/TooltipProps.js"
import { checkIsChildOfClass } from "../../clientUtils/Util.js"

interface DetailsOnDemandContainerProps {
    containerElement?: React.RefObject<HTMLDivElement>["current"]
    tooltipManager: TooltipManager
    details: GrapherInterface["details"]
}

@observer
export default class DetailsOnDemandContainer extends React.Component<DetailsOnDemandContainerProps> {
    constructor(props: DetailsOnDemandContainerProps) {
        super(props)
        this.handleMouseover = this.handleMouseover.bind(this)
        this.removeTooltip = this.removeTooltip.bind(this)
    }

    timeout: ReturnType<typeof setTimeout> | undefined = undefined
    tooltipId: string | undefined

    componentDidMount() {
        this.props.containerElement?.addEventListener(
            "mouseover",
            this.handleMouseover
        )
    }

    componentWillUnmount() {
        this.props.containerElement?.removeEventListener(
            "mouseover",
            this.handleMouseover
        )
    }

    renderTooltip(element: HTMLElement) {
        const term = element.getAttribute("data-term")
        const category = element.getAttribute("data-category")
        const { details, containerElement, tooltipManager } = this.props
        if (
            !term ||
            !category ||
            !details ||
            !containerElement ||
            !tooltipManager.tooltips
        ) {
            return
        }
        this.tooltipId = "detailOnDemand"
        const x = element.offsetLeft
        const y = element.offsetTop + element.offsetHeight
        const tooltip = (
            <div className="dod-tooltip">
                <div className="dod-category-container">
                    <p className="dod-category">{category}</p>
                </div>
                <h4 className="dod-title">{details[category][term].title}</h4>
                <p className="dod-content">{details[category][term].content}</p>
            </div>
        )
        tooltipManager.tooltips.set(this.tooltipId, {
            children: tooltip,
            id: this.tooltipId,
            tooltipManager,
            x,
            y,
        })
    }

    cancelRemoveTooltip() {
        if (this.timeout) clearTimeout(this.timeout)
    }

    removeTooltip() {
        if (this.tooltipId) {
            this.timeout = setTimeout(() => {
                if (this.tooltipId) {
                    this.props.tooltipManager.tooltips?.delete(this.tooltipId)
                    this.tooltipId = undefined
                }
            }, 80)
        }
    }

    handleMouseover(event: MouseEvent) {
        const element = event.target as HTMLElement
        // hovering over the tooltip
        if (checkIsChildOfClass(element, "dod-tooltip")) {
            this.cancelRemoveTooltip()
        }
        // hovering over the span
        else if (checkIsChildOfClass(element, "dod-term")) {
            this.cancelRemoveTooltip()
            this.renderTooltip(element)
        }
        // hovering over something else
        else {
            this.removeTooltip()
        }
    }

    render() {
        return null
    }
}
