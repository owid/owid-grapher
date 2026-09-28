import { match } from "ts-pattern"

import { OwidEnrichedGdocBlock } from "@ourworldindata/types"
import { normalizeBlockType, useImage } from "../utils.js"
import ArticleBlock from "./ArticleBlock.js"
import { Container, getLayout } from "./layout.js"
import { BlockErrorFallback } from "./BlockErrorBoundary.js"
import { LARGEST_IMAGE_WIDTH } from "@ourworldindata/utils"
import { CLOUDFLARE_IMAGES_URL } from "../../../settings/clientSettings.mjs"

export default function AtomArticleBlocks({
    blocks,
    containerType = "default",
}: {
    blocks: OwidEnrichedGdocBlock[]
    containerType?: Container
}) {
    return (
        <>
            {blocks.map((block: OwidEnrichedGdocBlock, i: number) => {
                return (
                    <AtomArticleBlock
                        key={i}
                        b={block}
                        containerType={containerType}
                    />
                )
            })}
        </>
    )
}

function AtomArticleBlock({
    b: rawBlock,
    containerType = "default",
}: {
    b: OwidEnrichedGdocBlock
    containerType?: Container
}) {
    const block = normalizeBlockType(rawBlock)
    if (block.parseErrors.some(({ isWarning }) => !isWarning)) {
        return (
            <BlockErrorFallback
                className={getLayout("default", containerType)}
                error={{
                    name: `Error in ${block.type}`,
                    message: block.parseErrors[0].message,
                }}
            />
        )
    }
    return match(block)
        .with({ type: "image" }, (block) => {
            // Skip mobile-only blocks in Atom feeds (assuming a desktop image will also be specified)
            if (block.visibility === "mobile") return null
            return (
                <Image
                    filename={block.filename}
                    smallFilename={block.smallFilename}
                    alt={block.alt}
                />
            )
        })
        .otherwise(() => (
            <ArticleBlock b={block} containerType={containerType} />
        ))
}

function Image({
    filename,
    smallFilename,
    alt,
}: {
    filename: string
    smallFilename?: string
    alt?: string
}) {
    const normalImage = useImage(filename)
    const smallImage = useImage(smallFilename)
    const image = smallImage || normalImage
    if (!image) return null

    let height: string | number = "auto"
    if (image.originalWidth && image.originalHeight) {
        height =
            (image.originalHeight / image.originalWidth) * LARGEST_IMAGE_WIDTH
    }

    return (
        <img
            src={`${CLOUDFLARE_IMAGES_URL}/${image.cloudflareId}/w=${LARGEST_IMAGE_WIDTH}`}
            alt={alt ?? image.defaultAlt}
            width={LARGEST_IMAGE_WIDTH}
            height={height}
        />
    )
}
