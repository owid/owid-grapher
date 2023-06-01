import React, { createRef } from "react"
import ReactDOM from "react-dom"
import cx from "classnames"
import { throttle } from "@ourworldindata/utils"

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

interface HeadingPosition {
    id: string
    yPosition: number
}

interface StickyNavLink {
    text: string
    target: string
}

interface StickyNavProps {
    links: StickyNavLink[]
    className?: string
}
class StickyNav extends React.Component<
    StickyNavProps,
    {
        headingPositions: HeadingPosition[]
        currentHeadingIndex?: number
        links: StickyNavLink[]
    }
> {
    ulRef = createRef<HTMLUListElement>()
    resizeObserver: ResizeObserver | null = null

    state = {
        currentHeadingIndex: undefined,
        headingPositions: [] as HeadingPosition[],
        links: this.props.links,
    }

    handleResize = () => {
        window.requestAnimationFrame(() => this.setHeadingPositions())
    }

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
        const headingPositions: HeadingPosition[] = []

        this.state.links.forEach(({ target }, i) => {
            const element = document.querySelector<HTMLElement>(target)
            if (element) {
                const { y } = getTotalOffset(element)
                headingPositions.push({ id: target, yPosition: y })
            } else {
                // Because of filterValidLinks, this should never happen
                // But if it does, pretend the heading exists
                // 1 pixel after the preceding heading
                const previousHeadingYPosition =
                    i === 0 ? 0 : headingPositions[i - 1].yPosition
                headingPositions.push({
                    id: target,
                    yPosition: previousHeadingYPosition + 1,
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
        window.addEventListener("scroll", this.handleScroll, { passive: true })
        // Web fonts and grapher hydration make the page height change
        // So we recalculate the heading positions whenever the document body changes size
        this.resizeObserver = new ResizeObserver(this.handleResize)
        this.resizeObserver.observe(document.body)
    }

    componentWillUnmount() {
        window.removeEventListener("scroll", this.handleScroll)
        this.resizeObserver?.disconnect()
    }

    render() {
        if (!this.state.links) return null
        return (
            <>
                <style>
                    {/* add scroll-margin-top to all elements with an ID */}
                    {/* increase top margin for sticky columns so the nav doesn't obscure them */}
                    {`
                    [id] {
                         scroll-margin-top:${
                             STICKY_NAV_HEIGHT + HEADING_SCROLL_MARGIN
                         }px;
                    }
                    .wp-sticky-container {
                        top: 70px;
                    }`}
                </style>
                <ul
                    className={cx("sticky-nav-container", this.props.className)}
                    ref={this.ulRef}
                >
                    {this.state.links.map((link, i) => (
                        <li key={link.target}>
                            <a
                                tabIndex={0}
                                className={cx({
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
    if (wrapper) {
        const anchorTags =
            document.querySelectorAll<HTMLAnchorElement>(".sticky-nav a")
        const links: StickyNavLink[] = []

        for (const anchorTag of anchorTags) {
            const text = anchorTag.innerText
            const target = anchorTag.hash
            links.push({ text, target })
        }

        ReactDOM.hydrate(<StickyNav links={links} />, wrapper)
    }
}
