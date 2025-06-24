import * as _ from "lodash-es"
import cx from "classnames"
import { useEffect, useRef } from "react"

import { OwidGdocAboutInterface } from "@ourworldindata/types"
import { ABOUT_LINKS } from "../../SiteConstants.js"
import { ArticleBlocks } from "../components/ArticleBlocks.js"
import Footnotes from "../components/Footnotes.js"

type AboutPageProps = Omit<
    OwidGdocAboutInterface,
    "markdown" | "publicationContext" | "revisionId"
>

export default function AboutPage({ content, slug }: AboutPageProps) {
    const shouldOverrideTitle = content["override-title"]
    return (
        <main className="about-page centered-article-container grid grid-cols-12-full-width">
            <h1 className="about-header col-start-2 col-end-limit display-2-semibold">
                {(shouldOverrideTitle && content.title) || "About"}
            </h1>
            {!content["hide-nav"] && <AboutNav slug={slug} />}
            <div className="about-body grid grid-cols-12-full-width col-start-1 col-end-limit">
                <ArticleBlocks
                    containerType="about-page"
                    blocks={content.body}
                />
            </div>
            {content.refs && !_.isEmpty(content.refs.definitions) ? (
                <Footnotes definitions={content.refs.definitions} />
            ) : null}
        </main>
    )
}

function AboutNav({ slug }: { slug: string }) {
    const activeLinkRef = useRef<HTMLAnchorElement>(null)

    // Scroll the nav to the active link, since it might not be visible
    // on mobile.
    useEffect(() => {
        const activeLink = activeLinkRef.current
        if (activeLink) {
            const nav = activeLink.closest("nav")
            if (nav) {
                const activeLinkOffset = activeLink.offsetLeft
                const navWidth = nav.offsetWidth
                const activeLinkWidth = activeLink.offsetWidth
                // Center the active link.
                nav.scrollLeft =
                    activeLinkOffset - (navWidth - activeLinkWidth) / 2
            }
        }
    }, [])

    return (
        <nav className="about-nav grid grid-cols-12-full-width col-start-1 col-end-limit">
            <ul className="about-nav-list col-start-2 col-end-14 col-sm-start-1">
                {ABOUT_LINKS.map(({ title, url }) => {
                    const isActive = url === `/${slug}`
                    return (
                        <li key={url}>
                            <a
                                className={cx("about-nav-link", {
                                    "about-nav-link--is-active": isActive,
                                })}
                                ref={isActive ? activeLinkRef : undefined}
                                href={url}
                                aria-current={isActive ? "page" : undefined}
                            >
                                {title}
                            </a>
                        </li>
                    )
                })}
            </ul>
        </nav>
    )
}
