import React, { createRef } from "react"
import ReactDOM from "react-dom"
import classnames from "classnames"
import { throttle } from "../../clientUtils/Util.js"

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
        headingPositions: { id: string; yPosition: number }[]
        currentHeadingIndex?: number
        links: { text: string; target: string }[]
    }
> {
    ulRef = createRef<HTMLUListElement>()

    state = {
        currentHeadingIndex: undefined,
        headingPositions: [] as { id: string; yPosition: number }[],
        links: this.props.links,
    }

    handleResize = throttle(() => {
        this.setHeadingPositions()
    }, 50)

    handleScroll = throttle(() => {
        this.setCurrentHeading()
    }, 50)

    // Make sure that each item in the nav actually points to a heading in the page
    filterValidLinks() {
        const validLinks = this.state.links.filter(
            (link) =>
                link.target.startsWith("#") &&
                document.querySelector(link.target)
        )

        this.setState({
            links: validLinks,
        })
    }

    setCurrentHeading() {
        const { scrollY } = window
        let currentHeadingIndex = 0
        for (let i = 0; i < this.state.headingPositions.length; i++) {
            const heading = this.state.headingPositions[i]
            const target =
                heading.yPosition -
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
        const headingPositions: { id: string; yPosition: number }[] = []

        this.state.links.forEach(({ target }, i) => {
            const element = document.querySelector<HTMLElement>(target)
            if (element) {
                const { y } = getTotalOffset(element)
                headingPositions.push({ id: target, yPosition: y })
            } else {
                // Because of filterValidLinks, this should never happen
                // But if it does, pretend the heading exists
                // 1 pixel after the preceding heading
                headingPositions.push({
                    id: target,
                    yPosition: headingPositions[i - 1].yPosition + 1,
                })
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
        this.filterValidLinks()
        // Web fonts change the position of elements
        // so we set the active heading only once we know where everything is.
        // The alternative is to call setHeadingPositions as soon as the component mounts,
        // but this can make currentHeadingIndex jump around.
        window.addEventListener("load", this.handleResize)
        window.addEventListener("scroll", this.handleScroll)
        window.addEventListener("resize", this.handleResize)
    }

    componentWillUnmount() {
        window.removeEventListener("scroll", this.handleScroll)
        window.removeEventListener("resize", this.handleResize)
        window.removeEventListener("load", this.handleResize)
    }

    render() {
        if (!this.state.links) return null
        return (
            <>
                <style>
                    {/* add scroll-margin-top to all elements with an ID */}
                    {`
                    [id] {
                         scroll-margin-top:${
                             STICKY_NAV_HEIGHT + HEADING_SCROLL_MARGIN
                         }px;
                    }`}
                </style>
                <ul className="sticky-nav-container" ref={this.ulRef}>
                    {this.state.links.map((link, i) => (
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
    const anchorTags =
        document.querySelectorAll<HTMLAnchorElement>(".sticky-nav a")
    const links: { target: string; text: string }[] = []

    for (const anchorTag of anchorTags) {
        const text = anchorTag.innerText
        const target = anchorTag.hash
        links.push({ text, target })
    }

    ReactDOM.hydrate(<StickyNav links={links} />, wrapper)
}
