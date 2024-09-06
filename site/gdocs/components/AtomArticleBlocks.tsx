import * as React from "react"
import { match } from "ts-pattern"

import { IMAGES_DIRECTORY, OwidEnrichedGdocBlock } from "@ourworldindata/types"
import { BAKED_BASE_URL } from "../../../settings/serverSettings.js"
import { useImage } from "../utils.js"
import ArticleBlock, { Container, getLayout } from "./ArticleBlock.js"
import { BlockErrorFallback } from "./BlockErrorBoundary.js"
import {
    getFilenameExtension,
    getFilenameWithoutExtension,
    LARGEST_IMAGE_WIDTH,
} from "@ourworldindata/utils"

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
    b: block,
    containerType = "default",
}: {
    b: OwidEnrichedGdocBlock
    containerType?: Container
}) {
    block.type = block.type.toLowerCase() as any // this comes from the user and may not be all lowercase, enforce it here
    if (block.parseErrors.filter(({ isWarning }) => !isWarning).length > 0) {
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
        .with({ type: "image" }, (block) => (
            <Image
                filename={block.filename}
                smallFilename={block.smallFilename}
                alt={block.alt}
            />
        ))
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
    const filenameWithoutExtension = encodeURIComponent(
        getFilenameWithoutExtension(image.filename)
    )
    const widthSuffix =
        image.originalWidth && image.originalWidth > LARGEST_IMAGE_WIDTH
            ? `_${LARGEST_IMAGE_WIDTH}`
            : ""
    const aspectRatio =
        image.originalWidth && image.originalHeight
            ? image.originalWidth / image.originalHeight
            : null
    const height = aspectRatio
        ? Math.round(LARGEST_IMAGE_WIDTH / aspectRatio)
        : undefined

    // If we're using a resized image (i.e. it has a width suffix), the file extension is ALWAYS png
    // If we're using the original image, we need to check the original file extension (which SHOULD be png, but might not be)
    const extension = widthSuffix ? "png" : getFilenameExtension(filename)

    return (
        <img
            src={`${BAKED_BASE_URL}${IMAGES_DIRECTORY}${filenameWithoutExtension}${widthSuffix}.${extension}`}
            alt={alt ?? image.defaultAlt}
            width={LARGEST_IMAGE_WIDTH}
            height={height}
        />
    )
}
