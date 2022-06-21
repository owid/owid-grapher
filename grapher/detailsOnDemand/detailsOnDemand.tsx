import React from "react"
import Markdown from "markdown-to-jsx"
import { observer } from "mobx-react"
import { GrapherInterface } from "../core/GrapherInterface.js"
import { TooltipManager } from "../tooltip/TooltipProps.js"
import { checkIsChildOfClass, isTouchDevice } from "../../clientUtils/Util.js"

interface DetailsOnDemandContainerProps {
    containerElement?: React.RefObject<HTMLDivElement>["current"]
    tooltipManager: TooltipManager
    details: GrapherInterface["details"]
}

@observer
export default class DetailsOnDemandContainer extends React.Component<DetailsOnDemandContainerProps> {
    constructor(props: DetailsOnDemandContainerProps) {
        super(props)
        this.handleFocus = this.handleFocus.bind(this)
        this.handleClick = this.handleClick.bind(this)
        this.handleMouseover = this.handleMouseover.bind(this)
        this.removeTooltip = this.removeTooltip.bind(this)
    }

    timeout: ReturnType<typeof setTimeout> | undefined = undefined
    tooltipId: string | undefined

    componentDidMount() {
        if (isTouchDevice()) {
            this.props.containerElement?.addEventListener(
                "click",
                this.handleClick
            )
        } else {
            this.props.containerElement?.addEventListener(
                "mouseover",
                this.handleMouseover
            )
            this.props.containerElement?.addEventListener(
                "focusin",
                this.handleFocus
            )
        }

        document.body.addEventListener("keydown", (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                this.removeTooltip()
            }
        })
    }

    componentWillUnmount() {
        if (isTouchDevice()) {
        } else {
            this.props.containerElement?.removeEventListener(
                "mouseover",
                this.handleMouseover
            )
        }
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
                <Markdown
                    className="dod-content"
                    options={{
                        overrides: {
                            a: ({ children, ...props }) => (
                                <a
                                    rel="noopener noreferrer"
                                    target="_blank"
                                    {...props}
                                >
                                    {children}
                                </a>
                            ),
                        },
                    }}
                >
                    {details[category][term].content}
                </Markdown>
            </div>
        )
        tooltipManager.tooltips.set(this.tooltipId, {
            children: tooltip,
            id: this.tooltipId,
            tooltipManager,
            x,
            y,
            style: {
                animation: "appear 50ms cubic-bezier(0.47, 0, 0.74, 0.71)",
            },
        })
    }

    cancelRemoveTooltip() {
        if (this.timeout) clearTimeout(this.timeout)
    }

    removeTooltip() {
        if (this.tooltipId) {
            // using a timeout before removing so that the tooltip doesn't disppear
            // while the user is moving their mouse to hover over it
            this.timeout = setTimeout(() => {
                if (this.tooltipId) {
                    this.props.tooltipManager.tooltips?.delete(this.tooltipId)
                    this.tooltipId = undefined
                }
            }, 80)
        }
    }

    handleClick(event: MouseEvent) {
        const element = event.target as HTMLElement
        // clicking on the span
        if (checkIsChildOfClass(element, "dod-term")) {
            this.renderTooltip(element)
        }
        // clicking on anything that isn't the tooltip
        else if (!checkIsChildOfClass(element, "dod-tooltip")) {
            this.removeTooltip()
        }
    }

    handleFocus(event: FocusEvent) {
        const element = event.target as HTMLElement
        // focusing on the span
        if (checkIsChildOfClass(element, "dod-term")) {
            this.renderTooltip(element)
        }
        // focusing on something else
        else if (!checkIsChildOfClass(element, "dod-tooltip")) {
            this.removeTooltip()
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
