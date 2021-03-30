import * as React from "react"
import * as ReactDOM from "react-dom"
import { observable, action, runInAction } from "mobx"
import { observer } from "mobx-react"
import { HeaderSearch } from "./HeaderSearch"

import {
    CategoryWithEntries,
    SubNavId,
    TocHeading,
} from "../clientUtils/owidTypes"
import Headroom from "react-headroom"
import { TableOfContents } from "./TableOfContents"
import { TopicsMenu } from "./TopicsMenu"

@observer
export class SiteHeader extends React.Component<{
    baseUrl: string
    subnavId?: SubNavId
    subnavCurrentHref?: string
    headings?: TocHeading[]
    pageTitle?: string
}> {
    @observable private width!: number
    @observable.ref private categories: CategoryWithEntries[] = []

    @action.bound private onResize() {
        this.width = window.innerWidth
    }

    private async getEntries() {
        const json = await (
            await fetch("/headerMenu.json", {
                method: "GET",
                credentials: "same-origin",
                headers: {
                    Accept: "application/json",
                },
            })
        ).json()

        runInAction(() => (this.categories = json.categories))
    }

    componentDidMount() {
        this.getEntries()
        this.onResize()
        window.addEventListener("resize", this.onResize)
    }

    componentWillUnmount() {
        window.removeEventListener("resize", this.onResize)
    }

    render() {
        return (
            <header className="site-header">
                <div className="site-navigation-bar">
                    <div className="content-wrapper">
                        <div className="site-logo">
                            <a href="/" data-track-note="header-navigation">
                                Our World
                                <br /> in Data
                            </a>
                        </div>
                        <ul className="site-primary-links">
                            <li>
                                <a
                                    href="/blog"
                                    data-track-note="header-navigation"
                                >
                                    Latest
                                </a>
                            </li>
                            <li>
                                <a
                                    href="/about"
                                    data-track-note="header-navigation"
                                >
                                    About
                                </a>
                            </li>
                            <li>
                                <a
                                    href="/donate"
                                    data-track-note="header-navigation"
                                >
                                    Donate
                                </a>
                            </li>
                        </ul>
                        <div className="header-logos-wrapper">
                            <a
                                href="https://global-change-data-lab.org/"
                                className="gcdl-logo"
                            >
                                <img
                                    src={`${this.props.baseUrl}/gcdl-logo.svg`}
                                    alt="Global Change Data Lab logo"
                                />
                            </a>
                            <a
                                href="https://www.oxfordmartin.ox.ac.uk/global-development"
                                className="oxford-logo"
                            >
                                <img
                                    src={`${this.props.baseUrl}/oms-logo.svg`}
                                    alt="Oxford Martin School logo"
                                />
                            </a>
                        </div>
                    </div>
                </div>
                <div className="site-subnavigation-bar">
                    <div className="content-wrapper">
                        <TopicsMenu categories={this.categories} />
                        <TableOfContents
                            subnavId={this.props.subnavId}
                            subnavCurrentHref={this.props.subnavCurrentHref}
                            headings={this.props.headings}
                            pageTitle={this.props.pageTitle}
                            // hideSubheadings={true}
                        ></TableOfContents>
                        <HeaderSearch />
                    </div>
                </div>
            </header>
        )
    }
}

const wrapInDiv = (el: Element): Element => {
    const wrapper = document.createElement("div")
    if (!el.parentNode) return el
    el.parentNode.insertBefore(wrapper, el)
    wrapper.appendChild(el)
    return wrapper
}

export const runHeaderMenus = (
    baseUrl: string,
    subnavId?: SubNavId,
    subnavCurrentHref?: string,
    headings?: TocHeading[],
    pageTitle?: string
) => {
    const siteHeaderEl = document.querySelector(".site-header")
    if (!siteHeaderEl) return
    const wrapper = wrapInDiv(siteHeaderEl)

    ReactDOM.render(
        <Headroom style={{ zIndex: 20 }}>
            <SiteHeader
                baseUrl={baseUrl}
                subnavId={subnavId}
                subnavCurrentHref={subnavCurrentHref}
                headings={headings}
                pageTitle={pageTitle}
            />
        </Headroom>,
        wrapper
    )
}
