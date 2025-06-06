import { match } from "ts-pattern"

import { OwidEnrichedGdocBlock } from "@ourworldindata/types"
import { useImage } from "../utils.js"
import ArticleBlock from "./ArticleBlock.js"
import { Container, getLayout } from "./layout.js"
import { BlockErrorFallback } from "./BlockErrorBoundary.js"
import { LARGEST_IMAGE_WIDTH } from "@ourworldindata/utils"
import { CLOUDFLARE_IMAGES_URL } from "../../../settings/clientSettings.js"

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
