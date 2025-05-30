import cx from "classnames"
import {
    EnrichedBlockRecirc,
    EnrichedRecircLink,
    Url,
} from "@ourworldindata/utils"
import { useLinkedChart, useLinkedDocument } from "../utils.js"
import { Thumbnail } from "./Thumbnail.js"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faExternalLinkAlt } from "@fortawesome/free-solid-svg-icons"

function RecircGdocLink(props: EnrichedRecircLink) {
    const { linkedDocument } = useLinkedDocument(props.url)

    // Checking for slug, because url always contains https://ourworldindata.org
    if (!linkedDocument?.slug) return null

    const title = props.title || linkedDocument.title
    const subtitle = props.subtitle || linkedDocument.subtitle

    return (
        <li className="recirc-item">
            <a href={linkedDocument.url}>
                <Thumbnail
                    thumbnail={linkedDocument["featured-image"]}
                    className="recirc-thumbnail"
                />
                <div className="recirc-item-text">
                    <h4>{title}</h4>
                    <p>{subtitle}</p>
                </div>
            </a>
        </li>
    )
}

function RecircChartLink(props: EnrichedRecircLink) {
    const { linkedChart } = useLinkedChart(props.url)
    if (!linkedChart) return null

    const title = props.title || linkedChart.title
    const subtitle = props.subtitle || linkedChart.subtitle

    return (
        <li className="recirc-item">
            <a href={linkedChart.resolvedUrl}>
                <Thumbnail
                    thumbnail={linkedChart.thumbnail}
                    className="recirc-thumbnail"
                />
                <div className="recirc-item-text">
                    <h4>{title}</h4>
                    <p>{subtitle}</p>
                </div>
            </a>
        </li>
    )
}

function RecircExternalLink(props: EnrichedRecircLink) {
    return (
        <li className="recirc-item recirc-item--external">
            <a href={props.url}>
                <div className="recirc-item-text">
                    <h4>
                        {props.title}
                        <FontAwesomeIcon icon={faExternalLinkAlt} />
                    </h4>
                    <p>{props.subtitle}</p>
                </div>
            </a>
        </li>
    )
}

export default function Recirc({
    d,
    className = "",
}: {
    d: EnrichedBlockRecirc
    className?: string
}) {
    return (
        <div className={cx(className, "recirc", `recirc--${d.align}`)}>
            <span className="recirc__heading body-3-bold">{d.title}</span>
            <ul>
                {d.links.map((link) => {
                    const url = Url.fromURL(link.url)
                    if (url.isGoogleDoc) {
                        return <RecircGdocLink {...link} key={link.url} />
                    }
                    if (url.isGrapher || url.isExplorer) {
                        return <RecircChartLink {...link} key={link.url} />
                    }
                    return <RecircExternalLink {...link} key={link.url} />
                })}
            </ul>
        </div>
    )
}
