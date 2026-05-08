import { OwidGdocType } from "@ourworldindata/utils"
import { PageChronologicalRecord } from "@ourworldindata/types"
import { getPrefixedGdocPath } from "@ourworldindata/components"
import { AttachmentsContext } from "../gdocs/AttachmentsContext.js"
import Image from "../gdocs/components/Image.js"
import { ArticleBlocks } from "../gdocs/components/ArticleBlocks.js"
import cx from "classnames"
import { LatestHitMetadata } from "./LatestHitMetadata.js"
import { LATEST_HIT_GRID_CLASSES, makeAttachments } from "./latestUtils.js"
import { useLatestContext } from "./LatestContext.js"

export const LatestDataInsightHit = ({
    hit,
    selectedTopic,
    position,
}: {
    hit: PageChronologicalRecord
    selectedTopic?: string
    position: number
}) => {
    const { analytics } = useLatestContext()
    const href = getPrefixedGdocPath("", {
        slug: hit.slug,
        content: { type: OwidGdocType.DataInsight },
    })
    const body = hit.body ?? []
    const firstImage = body.find((block) => block.type === "image")
    const otherBlocks = body.filter((block) => block !== firstImage)
    const titleId = `latest-hit-${hit.slug}-title`

    return (
        <AttachmentsContext.Provider value={makeAttachments(hit)}>
            <article
                id={hit.slug}
                className={cx(
                    "latest-data-insight-hit",
                    LATEST_HIT_GRID_CLASSES
                )}
            >
                <LatestHitMetadata
                    latestType={hit.latestType}
                    tags={hit.tags}
                    publishedAt={hit.date}
                    selectedTopic={selectedTopic}
                />
                <a
                    href={href}
                    aria-labelledby={titleId}
                    className="latest-data-insight-hit__card grid grid-cols-8"
                    onClick={() =>
                        analytics.logLatestResultClick(hit, position)
                    }
                >
                    {firstImage && (
                        <Image
                            className="latest-data-insight-hit__image span-cols-3"
                            filename={firstImage.filename}
                            containerType="latest-data-insight"
                            shouldLightbox={false}
                        />
                    )}
                    <div className="latest-data-insight-hit__content span-cols-5">
                        <h2
                            id={titleId}
                            className="latest-data-insight-hit__title body-1-bold"
                        >
                            {hit.title}
                        </h2>
                        <div className="latest-data-insight-hit__blocks">
                            <ArticleBlocks
                                blocks={otherBlocks}
                                shouldRenderLinks={false}
                            />
                        </div>
                    </div>
                </a>
            </article>
        </AttachmentsContext.Provider>
    )
}
