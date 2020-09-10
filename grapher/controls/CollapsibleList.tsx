import React from "react"
import { observable, action } from "mobx"
import { observer } from "mobx-react"
import { throttle } from "grapher/utils/Util"
import { Tippy } from "grapher/chart/Tippy"

interface CollapsibleListProps {
    items: React.ReactElement[]
}

/** A UI component inspired by the "Priority+ Navbar" or "Progressively Collapsing Navbar"*/
@observer
export class CollapsibleList extends React.Component<CollapsibleListProps> {
    private outerContainerRef: React.RefObject<
        HTMLDivElement
    > = React.createRef()
    private moreButtonRef: React.RefObject<HTMLLIElement> = React.createRef()
    private outerContainerWidth: number = 0
    private moreButtonWidth: number = 0
    private itemsWidths: number[] = []

    @observable private visibleItems: React.ReactElement[] = []
    @observable private dropdownItems: React.ReactElement[] = []

    constructor(props: CollapsibleListProps) {
        super(props)
        this.visibleItems.push(...props.items)
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
        let total = this.moreButtonWidth
        for (let i = 0; i < this.itemsWidths.length; i++) {
            if (total + this.itemsWidths[i] > this.outerContainerWidth) return i
            else total += this.itemsWidths[i]
        }
        return this.itemsWidths.length
    }

    @action private updateItemPartition() {
        this.visibleItems = this.props.items.slice(0, this.numItemsVisible)
        this.dropdownItems = this.props.items.slice(this.numItemsVisible)
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
                        <li key={item.key} className="list-item visible">
                            {item}
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
                                    key={item.key}
                                    className="list-item dropdown"
                                >
                                    {item}
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
