import React from "react"
import ReactDOM from "react-dom"
import classnames from "classnames"
import { debounce, get } from "../../clientUtils/Util.js"

function getPositionFromTopOfPage(element: HTMLElement): number {
    let y = 0
    while (true) {
        y += element.offsetTop
        if (element.offsetParent === null) {
            break
        }
        element = element.offsetParent as HTMLElement
    }
    return y
}

// Actual height is 54px but this gives it some top margin
const STICKY_NAV_HEIGHT = 80

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
            if (scrollY < heading.position - STICKY_NAV_HEIGHT - 1) {
                break
            } else {
                currentHeadingIndex = i
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
                const y = getPositionFromTopOfPage(element)
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
                         scroll-margin-top:${STICKY_NAV_HEIGHT}px;
                    }`}
                </style>
                <ul className="sticky-nav-container">
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
