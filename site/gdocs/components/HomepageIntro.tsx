import React, { useContext } from "react"
import cx from "classnames"
import {
    EnrichedBlockHomepageIntro,
    EnrichedBlockHomepageIntroPost,
} from "@ourworldindata/types"
import { formatAuthors, groupBy } from "@ourworldindata/utils"
import { useLinkedDocument } from "../utils.js"
import { DocumentContext } from "../OwidGdoc.js"
import Image from "./Image.js"
import { BlockErrorFallback } from "./BlockErrorBoundary.js"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import { faArrowRight } from "@fortawesome/free-solid-svg-icons"

type FeaturedWorkTileProps = EnrichedBlockHomepageIntroPost & {
    isTertiary?: boolean
    className?: string
}

function FeaturedWorkTile({
    isTertiary,
    title,
    kicker,
    authors,
    description,
    url,
    filename,
    className = "",
}: FeaturedWorkTileProps) {
    const { linkedDocument, errorMessage } = useLinkedDocument(url)
    const { isPreviewing } = useContext(DocumentContext)
    const linkedDocumentFeaturedImage = linkedDocument?.["featured-image"]
    const thumbnailFilename = filename ?? linkedDocumentFeaturedImage
    const href = `/${linkedDocument?.slug}` || url

    if (isPreviewing) {
        if (errorMessage) {
            return (
                <BlockErrorFallback
                    error={{
                        name: "Error with featured work",
                        message: `${errorMessage} This block won't render when the page is published`,
                    }}
                />
            )
        }
        if (!isTertiary && !thumbnailFilename) {
            return (
                <BlockErrorFallback
                    error={{
                        name: "Error with featured work",
                        message: `No thumbnail found for featured work. Only tertiary tiles can have missing images. This block won't render when the page is published`,
                    }}
                />
            )
        }
    }

    title = title || linkedDocument?.title
    authors = authors || linkedDocument?.authors
    description = description || linkedDocument?.excerpt

    return (
        <a
            href={href}
            className={cx("homepage-intro__featured-tile", className, {
                "homepage-intro__featured-tile--missing-image":
                    !thumbnailFilename,
            })}
        >
            {thumbnailFilename && (
                <Image shouldLightbox={false} filename={thumbnailFilename} />
            )}
            {kicker && (
                <span className="h6-black-caps homepage-intro__featured-work-kicker">
                    {kicker}
                </span>
            )}
            {title && (
                <p className="homepage-intro__featured-work-title">{title}</p>
            )}
            {description && (
                <p className="homepage-intro__featured-work-description">
                    {description}
                </p>
            )}
            {authors && (
                <p className="body-3-medium-italic homepage-intro__featured-work-authors">
                    {formatAuthors({ authors })}
                </p>
            )}
        </a>
    )
}

export type HomepageIntroProps = {
    className?: string
} & EnrichedBlockHomepageIntro

export function HomepageIntro({ className, featuredWork }: HomepageIntroProps) {
    const { primary, secondary, tertiary } = groupBy(
        featuredWork,
        (work) => work.type
    )
    return (
        <section className={className}>
            <section className="span-cols-3 col-start-2 homepage-intro__our-mission-container">
                <h2 className="h5-black-caps homepage-intro__our-mission-heading">
                    Our Mission
                </h2>
                <div className="homepage-intro__mission-wrapper">
                    <p className="homepage-intro__our-mission-lead">
                        What do we need to know to make the world a better
                        place?
                    </p>
                    <p className="homepage-intro__mission-answer">
                        To make progress against the pressing problems the world
                        faces, we need to be informed by the best research and
                        data.
                    </p>
                    <p className="homepage-intro__mission-answer">
                        Our World in Data makes this knowledge accessible and
                        understandable, to empower those working to build a
                        better world.
                    </p>
                    <a
                        className="homepage-intro__mission-link body-2-semibold"
                        href="/about"
                    >
                        Read about our mission{" "}
                        <FontAwesomeIcon icon={faArrowRight} />
                    </a>
                    <a
                        href="#subscribe"
                        className="homepage-intro__subscribe-button body-3-medium"
                    >
                        Subscribe to our newsletter
                    </a>
                </div>
                <div className="homepage-intro__mission-wrapper body-3-medium">
                    <p>
                        <strong>
                            We are a non-profit — all our work is free to use
                            and open source.
                        </strong>{" "}
                        We believe the best research and data should be
                        accessible to everyone. Consider supporting us if you
                        find our work valuable.
                    </p>
                    <a className="homepage-intro__donate-button" href="/donate">
                        Donate to support us
                    </a>
                </div>
                <div className="h6-black-caps">As seen on</div>
                <img
                    className="homepage-intro__media-logos"
                    src={`/media-logos.svg`}
                    alt="Logos of the publications that have used our content. From left to right: Science, Nature, PNAS, BBC, Financial Times, The New York Times, The Guardian, The Atlantic, and The Washington Post"
                    width={230}
                    height={75}
                />
            </section>
            <section className="grid grid-cols-9 span-cols-9 col-start-5 span-md-cols-12 col-md-start-2 homepage-intro__right-section">
                <h2 className="span-cols-9 span-md-cols-12 h5-black-caps homepage-intro__featured-work-heading">
                    Featured work
                </h2>
                <div className="grid grid-cols-9 span-cols-9 span-md-cols-12 homepage-intro__featured-work-container">
                    <div className="homepage-intro__primary-tiles span-cols-6">
                        {primary.map((work, i) => (
                            <FeaturedWorkTile key={i} {...work} />
                        ))}
                    </div>
                    <div className="homepage-intro__secondary-tiles span-cols-3 col-start-7">
                        {secondary.map((work, i) => (
                            <FeaturedWorkTile key={i} {...work} />
                        ))}
                    </div>
                    <div className="homepage-intro__tertiary-tiles span-cols-6 grid grid-cols-6">
                        {tertiary.map((work, i) => (
                            <FeaturedWorkTile
                                key={i}
                                className="span-cols-3"
                                isTertiary
                                {...work}
                            />
                        ))}
                    </div>
                    <div className="span-cols-6 homepage-intro__see-all-work-button-container">
                        <a
                            href="/latest"
                            className="body-3-medium homepage-intro__see-all-work-button"
                        >
                            See all our latest work
                            <FontAwesomeIcon icon={faArrowRight} />
                        </a>
                    </div>
                </div>
                <div className="span-cols-6 span-sm-cols-12">
                    <a
                        href="/latest"
                        className="body-3-medium homepage-intro__see-all-work-button homepage-intro__see-all-work-button--mobile"
                    >
                        See all our latest work
                        <FontAwesomeIcon icon={faArrowRight} />
                    </a>
                </div>
            </section>
        </section>
    )
}
