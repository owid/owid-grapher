import { ReactNode } from "react"
import { EnrichedHybridLink, Url } from "@ourworldindata/utils"
import { useLinkedChart, useLinkedDocument } from "../utils"
import { Thumbnail } from "./Thumbnail"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faExternalLinkAlt } from "@fortawesome/free-solid-svg-icons"

type HybridLinkProps = EnrichedHybridLink & { shouldRenderLinks: boolean }

/** A div instead of an <a> when links are off, e.g. inside a card that is
 * itself a link. */
function HybridLinkTarget({
    href,
    shouldRenderLinks,
    children,
}: {
    href: string
    shouldRenderLinks: boolean
    children: ReactNode
}) {
    if (!shouldRenderLinks) {
        return <div className="hybrid-link-item__link">{children}</div>
    }
    return (
        <a className="hybrid-link-item__link" href={href}>
            {children}
        </a>
    )
}

function HybridGdocLink(props: HybridLinkProps) {
    const { linkedDocument } = useLinkedDocument(props.url)

    // Checking for slug, because url always contains https://ourworldindata.org
    if (!linkedDocument?.slug) return null

    const title = props.title || linkedDocument.title
    const subtitle =
        props.subtitle || linkedDocument.excerpt || linkedDocument.subtitle

    return (
        <li className="hybrid-link-item">
            <HybridLinkTarget
                href={linkedDocument.url}
                shouldRenderLinks={props.shouldRenderLinks}
            >
                <Thumbnail
                    thumbnail={linkedDocument["featured-image"]}
                    className="hybrid-link-thumbnail"
                />
                <div className="hybrid-link-item-text">
                    <h4>{title}</h4>
                    <p>{subtitle}</p>
                </div>
            </HybridLinkTarget>
        </li>
    )
}

function HybridChartLink(props: HybridLinkProps) {
    const { linkedChart } = useLinkedChart(props.url)
    if (!linkedChart) return null

    const title = props.title || linkedChart.title
    const subtitle = props.subtitle || linkedChart.subtitle

    return (
        <li className="hybrid-link-item">
            <HybridLinkTarget
                href={linkedChart.resolvedUrl}
                shouldRenderLinks={props.shouldRenderLinks}
            >
                <Thumbnail
                    thumbnail={linkedChart.thumbnail}
                    className="hybrid-link-thumbnail"
                />
                <div className="hybrid-link-item-text">
                    <h4>{title}</h4>
                    <p>{subtitle}</p>
                </div>
            </HybridLinkTarget>
        </li>
    )
}

function HybridExternalLink(props: HybridLinkProps) {
    return (
        <li className="hybrid-link-item hybrid-link-item--external">
            <HybridLinkTarget
                href={props.url}
                shouldRenderLinks={props.shouldRenderLinks}
            >
                {props.thumbnail && (
                    <Thumbnail
                        thumbnail={props.thumbnail}
                        className="hybrid-link-thumbnail"
                    />
                )}
                <div className="hybrid-link-item-text">
                    <h4>
                        {props.title}
                        <FontAwesomeIcon
                            className="hybrid-link-item__external-icon"
                            icon={faExternalLinkAlt}
                        />
                    </h4>
                    <p>{props.subtitle}</p>
                </div>
            </HybridLinkTarget>
        </li>
    )
}

export function HybridLinkList({
    links,
    shouldRenderLinks = true,
}: {
    links: EnrichedHybridLink[]
    shouldRenderLinks?: boolean
}) {
    return (
        <ul className="hybrid-link-list">
            {links.map((link) => {
                const url = Url.fromURL(link.url)
                if (url.isGoogleDoc) {
                    return (
                        <HybridGdocLink
                            {...link}
                            key={link.url}
                            shouldRenderLinks={shouldRenderLinks}
                        />
                    )
                }
                if (url.isGrapher || url.isExplorer) {
                    return (
                        <HybridChartLink
                            {...link}
                            key={link.url}
                            shouldRenderLinks={shouldRenderLinks}
                        />
                    )
                }
                return (
                    <HybridExternalLink
                        {...link}
                        key={link.url}
                        shouldRenderLinks={shouldRenderLinks}
                    />
                )
            })}
        </ul>
    )
}
