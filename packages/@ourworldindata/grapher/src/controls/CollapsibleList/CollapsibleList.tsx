import React, { ReactNode } from "react"
import { observable, action } from "mobx"
import { observer } from "mobx-react"
import { throttle } from "@ourworldindata/utils"
import { Tippy } from "../../chart/Tippy"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import { faCog } from "@fortawesome/free-solid-svg-icons/faCog"

interface ListChild {
    index: number
    child: ReactNode
}

/** A UI component inspired by the "Priority+ Navbar" or "Progressively Collapsing Navbar"*/
@observer
export class CollapsibleList extends React.Component<{
    children: React.ReactNode
}> {
    private outerContainerRef: React.RefObject<HTMLDivElement> =
        React.createRef()
    private moreButtonRef: React.RefObject<HTMLLIElement> = React.createRef()
    private outerContainerWidth: number = 0
    private moreButtonWidth: number = 0
    private itemsWidths: number[] = []

    @observable private numItemsVisible?: number

    private get children(): ListChild[] {
        return (
            React.Children.map(this.props.children, (child, i) => {
                return {
                    index: i,
                    child,
                }
            }) ?? []
        )
    }

    private updateOuterContainerWidth(): void {
        this.outerContainerWidth =
            this.outerContainerRef.current?.clientWidth ?? 0
    }

    private calculateItemWidths(): void {
        this.itemsWidths = []
        this.outerContainerRef.current
            ?.querySelectorAll(".list-item.visible, .list-item.hidden")
            .forEach((item): number => this.itemsWidths.push(item.clientWidth))
    }

    @action private updateNumItemsVisible(): void {
        const numItemsVisibleWithoutMoreButton = numItemsVisible(
            this.itemsWidths,
            this.outerContainerWidth
        )

        this.numItemsVisible =
            numItemsVisibleWithoutMoreButton >= this.children.length
                ? numItemsVisibleWithoutMoreButton
                : numItemsVisible(
                      this.itemsWidths,
                      this.outerContainerWidth,
                      this.moreButtonWidth
                  )
    }

    private get visibleItems(): ListChild[] {
        return this.children.slice(0, this.numItemsVisible)
    }

    private get dropdownItems(): ListChild[] {
        return this.children.slice(this.numItemsVisible)
    }

    @action private onResize = throttle((): void => {
        this.updateItemVisibility()
    }, 100)

    @action private updateItemVisibility(): void {
        this.updateOuterContainerWidth()
        this.updateNumItemsVisible()
    }

    componentDidUpdate(): void {
        // react to children being added or removed, for example
        this.calculateItemWidths()
        this.updateItemVisibility()
    }

    componentDidMount(): void {
        window.addEventListener("resize", this.onResize)

        this.moreButtonWidth = this.moreButtonRef.current?.clientWidth ?? 0
        this.calculateItemWidths()
        this.updateItemVisibility()
    }

    componentWillUnmount(): void {
        window.removeEventListener("resize", this.onResize)
    }

    render(): JSX.Element {
        return (
            <div className="collapsibleList" ref={this.outerContainerRef}>
                <ul>
                    {this.visibleItems.map(
                        (item): JSX.Element => (
                            <li key={item.index} className="list-item visible">
                                {item.child}
                            </li>
                        )
                    )}
                    <li
                        className="list-item moreButton"
                        ref={this.moreButtonRef}
                        style={{
                            visibility: this.dropdownItems.length
                                ? "visible"
                                : "hidden",
                        }}
                    >
                        <MoreButton
                            options={this.dropdownItems.map(
                                (item): JSX.Element => (
                                    <li
                                        key={item.index}
                                        className="list-item dropdown"
                                    >
                                        {item.child}
                                    </li>
                                )
                            )}
                        />
                    </li>
                    {/* Invisibly render dropdown items such that we can measure their clientWidth, too */}
                    {this.dropdownItems.map(
                        (item): JSX.Element => (
                            <li key={item.index} className="list-item hidden">
                                {item.child}
                            </li>
                        )
                    )}
                </ul>
            </div>
        )
    }
}

export class MoreButton extends React.Component<{
    options: React.ReactElement[]
}> {
    render(): JSX.Element {
        const { options } = this.props
        return (
            <Tippy
                content={options}
                interactive={true}
                trigger={"click"}
                placement={"bottom"}
            >
                <span>
                    <FontAwesomeIcon icon={faCog} />
                    &nbsp;More
                </span>
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
    startingWidth: number = 0
): number {
    let total = startingWidth
    for (let i = 0; i < itemWidths.length; i++) {
        if (total + itemWidths[i] > containerWidth) return i
        else total += itemWidths[i]
    }
    return itemWidths.length
}
