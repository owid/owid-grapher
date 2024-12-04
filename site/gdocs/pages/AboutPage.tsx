import cx from "classnames"
import { isEmpty } from "lodash"
import * as React from "react"

import { OwidGdocAboutInterface } from "@ourworldindata/types"
import { ArticleBlocks } from "../components/ArticleBlocks.js"
import Footnotes from "../components/Footnotes.js"

const NAV_LINKS = [
    { title: "About Us", href: "/about" },
    { title: "Organization", href: "/organization" },
    { title: "Funding", href: "/funding" },
    { title: "Team", href: "/team" },
    { title: "Jobs", href: "/jobs" },
    { title: "FAQs", href: "/faqs" },
]

export default function AboutPage({ content, slug }: OwidGdocAboutInterface) {
    return (
        <main className="about-page centered-article-container grid grid-cols-12-full-width">
            <h1 className="about-header col-start-2 col-end-limit display-2-semibold">
                About
            </h1>
            <AboutNav slug={slug} />
            <div className="about-body grid grid-cols-12-full-width col-start-1 col-end-limit">
                <ArticleBlocks
                    containerType="about-page"
                    blocks={content.body}
                />
            </div>
            {content.refs && !isEmpty(content.refs.definitions) ? (
                <Footnotes definitions={content.refs.definitions} />
            ) : null}
        </main>
    )
}

function AboutNav({ slug }: { slug: string }) {
    return (
        <nav className="about-nav grid grid-cols-12-full-width col-start-1 col-end-limit">
            <ul className="about-nav-list col-start-2 col-end-14 col-sm-start-1">
                {NAV_LINKS.map(({ title, href }) => (
                    <li key={href}>
                        <h2>
                            <a
                                className={cx("about-nav-link", {
                                    "about-nav-link--is-active":
                                        href === `/${slug}`,
                                })}
                                href={href}
                            >
                                {title}
                            </a>
                        </h2>
                    </li>
                ))}
            </ul>
        </nav>
    )
}
