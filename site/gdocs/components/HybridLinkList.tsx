import { EnrichedHybridLink, Url } from "@ourworldindata/utils"
import { useLinkedChart, useLinkedDocument } from "../utils"
import { Thumbnail } from "./Thumbnail"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faExternalLinkAlt } from "@fortawesome/free-solid-svg-icons"

function HybridGdocLink(props: EnrichedHybridLink) {
    const { linkedDocument } = useLinkedDocument(props.url)

    // Checking for slug, because url always contains https://ourworldindata.org
    if (!linkedDocument?.slug) return null

    const title = props.title || linkedDocument.title
    const subtitle = props.subtitle || linkedDocument.subtitle

    return (
        <li className="hybrid-link-item">
            <a href={linkedDocument.url}>
                <Thumbnail
                    thumbnail={linkedDocument["featured-image"]}
                    className="hybrid-link-thumbnail"
                />
                <div className="hybrid-link-item-text">
                    <h4>{title}</h4>
                    <p>{subtitle}</p>
                </div>
            </a>
        </li>
    )
}

function HybridChartLink(props: EnrichedHybridLink) {
    const { linkedChart } = useLinkedChart(props.url)
    if (!linkedChart) return null

    const title = props.title || linkedChart.title
    const subtitle = props.subtitle || linkedChart.subtitle

    return (
        <li className="hybrid-link-item">
            <a href={linkedChart.resolvedUrl}>
                <Thumbnail
                    thumbnail={linkedChart.thumbnail}
                    className="hybrid-link-thumbnail"
                />
                <div className="hybrid-link-item-text">
                    <h4>{title}</h4>
                    <p>{subtitle}</p>
                </div>
            </a>
        </li>
    )
}

function HybridExternalLink(props: EnrichedHybridLink) {
    return (
        <li className="hybrid-link-item hybrid-link-item--external">
            <a href={props.url}>
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
            </a>
        </li>
    )
}

export function HybridLinkList({ links }: { links: EnrichedHybridLink[] }) {
    return (
        <ul className="hybrid-link-list">
            {links.map((link) => {
                const url = Url.fromURL(link.url)
                if (url.isGoogleDoc) {
                    return <HybridGdocLink {...link} key={link.url} />
                }
                if (url.isGrapher || url.isExplorer) {
                    return <HybridChartLink {...link} key={link.url} />
                }
                return <HybridExternalLink {...link} key={link.url} />
            })}
        </ul>
    )
}
