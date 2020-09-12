import React, { ReactNode } from "react"
import { observable, action, computed } from "mobx"
import { observer } from "mobx-react"
import { throttle } from "grapher/utils/Util"
import { Tippy } from "grapher/chart/Tippy"

interface ListChild {
    index: number
    child: ReactNode
}

/** A UI component inspired by the "Priority+ Navbar" or "Progressively Collapsing Navbar"*/
@observer
export class CollapsibleList extends React.Component {
    private outerContainerRef: React.RefObject<
        HTMLDivElement
    > = React.createRef()
    private moreButtonRef: React.RefObject<HTMLLIElement> = React.createRef()
    private outerContainerWidth: number = 0
    private moreButtonWidth: number = 0
    private itemsWidths: number[] = []

    @observable private visibleItems: ListChild[] = []
    @observable private dropdownItems: ListChild[] = []

    constructor(props: any) {
        super(props)
        this.visibleItems = this.children
    }

    @computed private get children(): ListChild[] {
        return (
            React.Children.map(this.props.children, (child, i) => {
                return {
                    index: i,
                    child,
                }
            }) ?? []
        )
    }

    private updateOuterContainerWidth() {
        this.outerContainerWidth =
            this.outerContainerRef.current?.clientWidth ?? 0
    }

    private calculateItemWidths() {
        this.outerContainerRef.current
            ?.querySelectorAll(".list-item")
            .forEach((item) => this.itemsWidths.push(item.clientWidth))
    }

    private get numItemsVisible() {
        return numItemsVisible(
            this.itemsWidths,
            this.outerContainerWidth,
            this.moreButtonWidth
        )
    }

    @action private updateItemPartition() {
        this.visibleItems = this.children.slice(0, this.numItemsVisible)
        this.dropdownItems = this.children.slice(this.numItemsVisible)
    }

    @action private onResize = throttle(() => {
        this.updateOuterContainerWidth()
        this.updateItemPartition()
    }, 100)

    componentDidMount() {
        window.addEventListener("resize", this.onResize)

        this.moreButtonWidth = this.moreButtonRef.current?.clientWidth ?? 0
        this.updateOuterContainerWidth()
        this.calculateItemWidths()
        this.updateItemPartition()
    }

    componentWillUnmount() {
        window.removeEventListener("resize", this.onResize)
    }

    render() {
        return (
            <div className="collapsibleList" ref={this.outerContainerRef}>
                <ul>
                    {this.visibleItems.map((item) => (
                        <li key={item.index} className="list-item visible">
                            {item.child}
                        </li>
                    ))}
                    <li
                        className="list-item visible moreButton"
                        ref={this.moreButtonRef}
                        style={{
                            visibility: this.dropdownItems.length
                                ? "visible"
                                : "hidden",
                        }}
                    >
                        <MoreButton
                            options={this.dropdownItems.map((item) => (
                                <li
                                    key={item.index}
                                    className="list-item dropdown"
                                >
                                    {item.child}
                                </li>
                            ))}
                        />
                    </li>
                </ul>
            </div>
        )
    }
}

export class MoreButton extends React.Component<{
    options: React.ReactElement[]
}> {
    render() {
        const { options } = this.props
        return (
            <Tippy content={options} interactive={true} trigger={"click"}>
                <span>More</span>
            </Tippy>
        )
    }
}

/**
 * Given: an array of item widths, a container width, and a starting width
 * Returns the number of items that can fit in the container
 */
export function numItemsVisible(
    itemWidths: number[],
    containerWidth: number,
    startingWidth: number
) {
    let total = startingWidth
    for (let i = 0; i < itemWidths.length; i++) {
        if (total + itemWidths[i] > containerWidth) return i
        else total += itemWidths[i]
    }
    return itemWidths.length
}
