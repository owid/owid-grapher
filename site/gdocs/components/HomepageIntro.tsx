import { RefObject, useContext, useRef, useState } from "react"
import cx from "classnames"
import {
    EnrichedBlockHomepageIntro,
    EnrichedBlockHomepageIntroPost,
    OwidGdocMinimalPostInterface,
} from "@ourworldindata/types"
import { dayjs, formatAuthors } from "@ourworldindata/utils"
import { useLinkedChart, useLinkedDocument } from "../utils.js"
import { DocumentContext } from "../DocumentContext.js"
import Image, { ImageParentContainer } from "./Image.js"
import { BlockErrorFallback } from "./BlockErrorBoundary.js"
import * as R from "remeda"
import { NewsletterWithSocials } from "../../NewsletterSubscription.js"
import { AttachmentsContext } from "../AttachmentsContext.js"
import { Button } from "@ourworldindata/components"
import { AnnouncementsIcon } from "./AnnouncementsIcon.js"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faArrowRight, faHeart } from "@fortawesome/free-solid-svg-icons"
import { useResizeObserver } from "usehooks-ts"

type FeaturedWorkTileProps = EnrichedBlockHomepageIntroPost & {
    isTertiary?: boolean
    className?: string
    id: string
    thumbnailSize?: ImageParentContainer
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
    thumbnailSize = "thumbnail",
    isNew,
    id,
}: FeaturedWorkTileProps) {
    const { linkedDocument, errorMessage } = useLinkedDocument(url)
    const { isPreviewing } = useContext(DocumentContext)
    const linkedDocumentFeaturedImage = linkedDocument?.["featured-image"]
    const thumbnailFilename = filename ?? linkedDocumentFeaturedImage
    const href = linkedDocument?.url ?? url

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

    title ||= linkedDocument?.title
    authors ||= linkedDocument?.authors
    description ||= linkedDocument?.excerpt

    return (
        <a
            href={href}
            aria-labelledby={id}
            className={cx("homepage-intro__featured-tile", className, {
                "homepage-intro__featured-tile--missing-image":
                    !thumbnailFilename,
            })}
        >
            {thumbnailFilename && (
                <Image
                    shouldLightbox={false}
                    filename={thumbnailFilename}
                    containerType={thumbnailSize}
                />
            )}
            {kicker && (
                <span className="h6-black-caps homepage-intro__featured-work-kicker">
                    {isNew && (
                        <span className="homepage-intro__new-tag">New</span>
                    )}
                    {kicker}
                </span>
            )}
            {title && (
                <h3
                    id={id}
                    className="homepage-intro__featured-work-title h3-bold"
                >
                    {title}
                </h3>
            )}
            {description && (
                <p className="homepage-intro__featured-work-description body-3-medium">
                    {description}
                </p>
            )}
            {authors && (
                <p className="homepage-intro__featured-work-authors body-3-medium-italic">
                    {formatAuthors(authors)}
                </p>
            )}
        </a>
    )
}

function useIsOverflowing<T extends HTMLElement = HTMLElement>(
    ref: RefObject<T>
): boolean {
    const [isOverflowing, setIsOverflowing] = useState(false)

    useResizeObserver({
        ref,
        onResize: () => {
            const element = ref.current
            if (!element) return

            const overflowing =
                element.scrollWidth > element.clientWidth ||
                element.scrollHeight > element.clientHeight

            setIsOverflowing(overflowing)
        },
    })

    return isOverflowing
}

function HomepageAnnouncement(props: {
    announcement: OwidGdocMinimalPostInterface
    index: number
}) {
    const { announcement, index } = props
    const { linkedChart } = useLinkedChart(announcement.cta?.url || "")
    const { linkedDocument } = useLinkedDocument(announcement.cta?.url || "")
    // If there's not enough space to show all of the third announcement, we link to the latest page, no matter what
    // If there is enough space, it behaves as normal:
    // - cta: link directly to the resource
    // - no cta: link to the latest page
    const announcementRef = useRef<HTMLLIElement>(null)
    const isOverflowing = useIsOverflowing(
        announcementRef as RefObject<HTMLElement>
    )
    const latestPageLink = `/latest#${announcement.slug}`
    const href = isOverflowing
        ? latestPageLink
        : linkedChart?.resolvedUrl ||
          linkedDocument?.url ||
          announcement.cta?.url ||
          latestPageLink

    return (
        <li
            className={cx("homepage-intro__announcement", {
                "homepage-intro__announcement--is-overflowing": isOverflowing,
            })}
            ref={announcementRef}
        >
            <a
                className="homepage-intro__announcement-link"
                aria-labelledby={`announcement-${announcement.id}`}
                tabIndex={index === 2 ? -1 : undefined}
                href={href}
            >
                <span className="homepage-intro__announcement-meta h6-black-caps">
                    {announcement.kicker} -{" "}
                    {dayjs(announcement.publishedAt).fromNow()}{" "}
                </span>
                <h3
                    id={`announcement-${announcement.id}`}
                    className="homepage-intro__announcement-title body-2-bold"
                >
                    {announcement.title}
                </h3>
                <p className="homepage-intro__excerpt body-3-medium">
                    {announcement.excerpt}
                </p>
                <span className="homepage-intro__announcement-read-more body-3-medium">
                    {announcement.cta ? announcement.cta.text : "Read more"}{" "}
                    <FontAwesomeIcon icon={faArrowRight} />
                </span>
            </a>
        </li>
    )
}

function HomepageAnnouncements() {
    const { homepageMetadata = {} } = useContext(AttachmentsContext)
    const announcements = R.prop(homepageMetadata, "announcements")
    if (!announcements || announcements.length === 0) return null
    return (
        <div className="homepage-intro__announcements span-cols-3 col-start-8 span-md-cols-14 col-md-start-1">
            <div className="homepage-intro__announcements-header">
                <AnnouncementsIcon />
                <h4 className="h2-bold">Updates and Announcements</h4>
            </div>
            <ul className="homepage-intro__announcements-list">
                {announcements.map((announcement, i) => (
                    <HomepageAnnouncement
                        announcement={announcement}
                        key={announcement.id}
                        index={i}
                    />
                ))}
            </ul>
            <Button
                href="/latest"
                text="See all updates"
                theme="outline-vermillion"
            />
            <Button
                className="homepage-intro__subscribe-button"
                href="/subscribe"
                text="Subscribe to our newsletters"
                theme="solid-vermillion"
            />
        </div>
    )
}

function DonationCta() {
    return (
        <div className="homepage-intro__donation-cta">
            <FontAwesomeIcon icon={faHeart} />
            <div>
                <p className="body-3-bold">
                    We are a non-profit — all our work is free to use and open
                    source.
                </p>
                <a href="/donate" className="body-3-bold">
                    Donate to support us
                </a>
            </div>
        </div>
    )
}

// Featured work used to be set in a way that explicitly defined where it would render,
// but now the new homepage design only supports 2 items with thumbnails and 2 without.
// This function sorts the items by type and takes the top 4 to display.
function getSortedFeaturedWork(featuredWork: EnrichedBlockHomepageIntroPost[]) {
    const ranking = ["primary", "secondary", "tertiary"]
    return R.take(
        R.sortBy(featuredWork, (work) => ranking.indexOf(work.type)),
        4
    ) as [
        EnrichedBlockHomepageIntroPost,
        EnrichedBlockHomepageIntroPost,
        EnrichedBlockHomepageIntroPost,
        EnrichedBlockHomepageIntroPost,
    ]
}

export type HomepageIntroProps = {
    className?: string
} & EnrichedBlockHomepageIntro

export function HomepageIntro({ className, featuredWork }: HomepageIntroProps) {
    const [w1, w2, w3, w4] = getSortedFeaturedWork(featuredWork)
    return (
        <section className={cx("homepage-intro", className)}>
            <div className="homepage-intro__featured-work grid grid-cols-2 span-cols-6 col-start-2 span-md-cols-14">
                <div className="homepage-intro__featured-work-column">
                    <FeaturedWorkTile id={"fw1"} {...w1} />
                    <FeaturedWorkTile id={"fw3"} {...w3} />
                </div>
                <div className="homepage-intro__featured-work-column">
                    <FeaturedWorkTile id={"fw2"} isTertiary {...w2} />
                    <FeaturedWorkTile id={"fw4"} isTertiary {...w4} />
                </div>
            </div>
            <HomepageAnnouncements />
            <div className="span-cols-3 col-start-11 span-md-cols-14 col-md-start-1">
                <NewsletterWithSocials className="homepage-intro__newsletter-signup" />
                <DonationCta />
            </div>
        </section>
    )
}
