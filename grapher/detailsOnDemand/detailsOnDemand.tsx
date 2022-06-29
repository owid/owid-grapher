import React from "react"
import ReactDOM from "react-dom"
import { Markdown } from "../markdown/Markdown.js"
import { observer } from "mobx-react"
import { GrapherInterface } from "../core/GrapherInterface.js"
import { TooltipManager } from "../tooltip/TooltipProps.js"
// import { checkIsChildOfClass, isTouchDevice } from "../../clientUtils/Util.js"
import { Tippy } from "../chart/Tippy.js"

interface DetailsOnDemandContainerProps {
    containerElement?: React.RefObject<HTMLDivElement>["current"]
    tooltipManager: TooltipManager
    details: GrapherInterface["details"]
}

@observer
export default class DetailsOnDemandContainer extends React.Component<DetailsOnDemandContainerProps> {
    constructor(props: DetailsOnDemandContainerProps) {
        super(props)
    }

    componentDidMount() {
        // TODO: do this via a tippy singleton, try to add them in the TextWrap step
        // instead of this DOM manipulation which doesn't even work when
        // changing grapher tabs
        this.addTippysToDodSpans()
    }

    addTippysToDodSpans() {
        document.body.querySelectorAll(".dod-term").forEach((element) => {
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
            ReactDOM.render(
                <Tippy
                    content={
                        <div className="dod-tooltip">
                            <h3>{details[category][term]?.title}</h3>
                            <Markdown>
                                {details[category][term]?.content}
                            </Markdown>
                        </div>
                    }
                    interactive
                    arrow={false}
                >
                    <span>{element.textContent}</span>
                </Tippy>,
                element
            )
        })
    }

    render() {
        return null
    }
}
