import React, { createRef } from "react"
import ReactDOM from "react-dom"
import classnames from "classnames"
import { debounce, get } from "../../clientUtils/Util.js"

function getTotalOffset(element: HTMLElement): {
    x: number
    y: number
} {
    let y = 0
    let x = 0
    while (true) {
        x += element.offsetLeft
        y += element.offsetTop
        if (!element.offsetParent) {
            break
        }
        element = element.offsetParent as HTMLElement
    }
    return { x, y }
}

const STICKY_NAV_HEIGHT = 54
const HEADING_SCROLL_MARGIN = 16

interface StickyNavProps {
    links: { text: string; target: string }[]
}
class StickyNav extends React.Component<
    StickyNavProps,
    {
        headingPositions: { id: string; position: number }[]
        currentHeadingIndex: number
    }
> {
    ulRef = createRef<HTMLUListElement>()

    state = {
        currentHeadingIndex: 0,
        headingPositions: [] as { id: string; position: number }[],
    }

    get links() {
        return this.props.links
    }

    handleResize = debounce(() => {
        this.setHeadingPositions()
    }, 100)

    handleScroll = debounce(() => {
        this.setCurrentHeading()
    }, 100)

    setCurrentHeading() {
        const { scrollY } = window
        let currentHeadingIndex = 0
        for (let i = 0; i < this.state.headingPositions.length; i++) {
            const heading = this.state.headingPositions[i]
            const target =
                heading.position -
                STICKY_NAV_HEIGHT -
                HEADING_SCROLL_MARGIN -
                // Additional clearance for height of actual element
                32
            if (scrollY <= target) {
                break
            } else {
                currentHeadingIndex = i
            }
        }

        const current = this.ulRef.current
        if (current) {
            const parent = current.parentElement
            if (parent) {
                const hasScrollbar = parent.scrollWidth < current.scrollWidth
                if (hasScrollbar) {
                    const listItem = current.children[
                        currentHeadingIndex
                    ] as HTMLElement
                    const containerPadding = 32
                    current.scrollTo({
                        behavior: "smooth",
                        left: listItem.offsetLeft - containerPadding,
                    })
                }
            }
        }

        this.setState({
            currentHeadingIndex,
        })
    }

    setHeadingPositions() {
        const headingPositions: any[] = []
        this.links.forEach((link) => {
            const element = document.querySelector<HTMLElement>(link.target)
            if (element) {
                const { y } = getTotalOffset(element)
                headingPositions.push({ id: link.target, position: y })
            }
        })

        this.setState(
            {
                headingPositions,
            },
            () => {
                this.setCurrentHeading()
            }
        )
    }

    componentDidMount() {
        this.setHeadingPositions()
        window.addEventListener("scroll", this.handleScroll)
        window.addEventListener("resize", this.handleResize)
    }

    componentWillUnmount() {
        window.removeEventListener("scroll", this.handleScroll)
        window.removeEventListener("resize", this.handleResize)
    }

    render() {
        if (!this.links) return null
        return (
            <>
                <style>
                    {`
                    [id] {
                         scroll-margin-top:${
                             STICKY_NAV_HEIGHT + HEADING_SCROLL_MARGIN
                         }px;
                    }`}
                </style>
                <ul className="sticky-nav-container" ref={this.ulRef}>
                    {this.links.map((link, i) => (
                        <li key={link.target}>
                            <a
                                tabIndex={0}
                                className={classnames({
                                    active:
                                        i === this.state.currentHeadingIndex,
                                })}
                                href={link.target}
                            >
                                {link.text}
                            </a>
                        </li>
                    ))}
                </ul>
            </>
        )
    }
}

export default StickyNav

export const hydrateStickyNav = () => {
    const wrapper = document.querySelector(".sticky-nav")
    const anchorTags = document.querySelectorAll(".sticky-nav a")
    const links: { target: string; text: string }[] = []

    for (const anchorTag of anchorTags) {
        const text = get(anchorTag, ["text"])
        const target = get(anchorTag, ["hash"])
        links.push({ text, target })
    }

    ReactDOM.hydrate(<StickyNav links={links} />, wrapper)
}
