import React from "react"
import { observable, action } from "mobx"
import { observer } from "mobx-react"
import { throttle } from "grapher/utils/Util"
import { Tippy } from "grapher/chart/Tippy"

interface CollapsibleListProps {
    items: React.ReactElement[]
}

@observer
export class CollapsibleList extends React.Component<CollapsibleListProps> {
    outerContainer: React.RefObject<HTMLDivElement> = React.createRef()
    moreButton: React.RefObject<HTMLLIElement> = React.createRef()
    outerWidth: number = 0
    moreButtonWidth: number = 0

    @observable visibleItems: React.ReactElement[] = []
    @observable dropdownItems: React.ReactElement[] = []
    widthsArray: number[] = []

    constructor(props: CollapsibleListProps) {
        super(props)
        this.visibleItems.push(...props.items)
    }

    updateOuterWidth() {
        this.outerWidth = this.outerContainer.current?.clientWidth ?? 0
    }

    numItemsVisible(outerWidth: number, initialWidth: number) {
        let total = initialWidth
        for (let i = 0; i < this.widthsArray.length; i++) {
            if (total + this.widthsArray[i] > outerWidth) {
                return i
            } else {
                total += this.widthsArray[i]
            }
        }
        return this.widthsArray.length
    }

    @action updateItemPartition() {
        const numItemsVisible = this.numItemsVisible(
            this.outerWidth, // outerListWidth,
            this.moreButtonWidth
        )

        this.visibleItems = this.props.items.slice(0, numItemsVisible)
        this.dropdownItems = this.props.items.slice(numItemsVisible)
    }

    onResize = throttle(() => {
        this.updateOuterWidth()
        this.updateItemPartition()
    }, 100)

    componentDidMount() {
        window.addEventListener("resize", this.onResize)
        this.updateOuterWidth()
        this.moreButtonWidth = this.moreButton.current?.clientWidth ?? 0
        this.outerContainer.current
            ?.querySelectorAll("li")
            .forEach((item) => this.widthsArray.push(item.clientWidth))
        this.updateItemPartition()
    }

    componentWillUnmount() {
        window.removeEventListener("resize", this.onResize)
    }

    render() {
        return (
            <div className="collapsibleList" ref={this.outerContainer}>
                <ul>
                    {this.visibleItems.map((item) => (
                        <li key={item.key} className="list-item visible">
                            {item}
                        </li>
                    ))}
                    <li
                        className="list-item visible moreButton"
                        ref={this.moreButton}
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
