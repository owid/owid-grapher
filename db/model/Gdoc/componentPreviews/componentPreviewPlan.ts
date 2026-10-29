import {
    GdocComponentPreviewItem,
    GdocComponentPreviewUpdateReason,
} from "@ourworldindata/types"
import {
    type ComponentPreviewBlock,
    type ComponentPreviewChange,
} from "./componentPreviewBlocks.js"
import {
    type ComponentPreviewSource,
    componentPreviewSpecKey,
} from "./componentPreviewSources.js"

export function makeItem(
    block: ComponentPreviewBlock,
    status: GdocComponentPreviewItem["status"],
    message?: string,
    reason?: GdocComponentPreviewUpdateReason
): GdocComponentPreviewItem {
    return {
        tabTitle: block.tabTitle,
        componentType: block.spec.type,
        target: block.spec.target,
        status,
        ...(reason ? { reason } : {}),
        ...(message ? { message } : {}),
    }
}

/**
 * Existing images get replaced in place with `replaceImage`. That keeps the
 * image's object id, and with it any comments anchored on the image, as well
 * as the size the author gave it. But it center-crops the new image into the
 * old frame, so when the shapes differ, the image gets deleted and inserted
 * again at the same width instead (losing its comments).
 */
export interface PlannedChanges {
    replacements: ComponentPreviewChange[]
    insertions: ComponentPreviewChange[]
    reinsertions: ComponentPreviewChange[]
}

// How far apart aspect ratios can be before reinserting rather than cropping
const ASPECT_RATIO_TOLERANCE = 0.02

function hasWrongShape(
    block: ComponentPreviewBlock,
    aspectRatio: number | undefined
): boolean {
    const size = block.image?.size
    if (!size || !aspectRatio) return false
    const currentAspectRatio = size.width / size.height
    return (
        Math.abs(currentAspectRatio - aspectRatio) / aspectRatio >
        ASPECT_RATIO_TOLERANCE
    )
}

function getUpdateReason(
    block: ComponentPreviewBlock,
    imageUrl: string,
    previewUrlPrefixes: string[]
): GdocComponentPreviewUpdateReason {
    const sourceUri = block.image?.sourceUri
    if (sourceUri === imageUrl) return "wrongShape"
    const isPreview = previewUrlPrefixes.some((prefix) =>
        sourceUri?.startsWith(prefix)
    )
    return isPreview ? "outdated" : "pastedByHand"
}

/**
 * Decides what happens to each component's preview image: an image above the
 * component is up to date when it was inserted from the current URL and its
 * frame has the image's shape; otherwise it's replaced, or reinserted if the
 * shapes differ. Components without one get an image inserted, unless their
 * image is below them, which is only reported.
 *
 * `previewUrlPrefixes` tells our own previews apart from images pasted in by
 * hand, for the author's information.
 */
export function planComponentPreviewChanges(
    blocks: ComponentPreviewBlock[],
    sources: Map<string, ComponentPreviewSource>,
    previewUrlPrefixes: string[]
): {
    items: Map<ComponentPreviewBlock, GdocComponentPreviewItem>
    planned: PlannedChanges
} {
    const items = new Map<ComponentPreviewBlock, GdocComponentPreviewItem>()
    const planned: PlannedChanges = {
        replacements: [],
        insertions: [],
        reinsertions: [],
    }
    for (const block of blocks) {
        const source = sources.get(componentPreviewSpecKey(block.spec))
        if (!source || source.status === "unresolved") {
            items.set(block, makeItem(block, "unresolved", source?.message))
            continue
        }
        const change = { block, imageUrl: source.imageUrl }
        const { message } = source
        if (block.image) {
            const wrongShape = hasWrongShape(block, source.aspectRatio)
            if (block.image.sourceUri === source.imageUrl && !wrongShape) {
                items.set(block, makeItem(block, "upToDate", message))
                continue
            }
            if (wrongShape) planned.reinsertions.push(change)
            else planned.replacements.push(change)
            const reason = getUpdateReason(
                block,
                source.imageUrl,
                previewUrlPrefixes
            )
            items.set(block, makeItem(block, "updated", message, reason))
        } else if (block.imageBelow) {
            items.set(block, makeItem(block, "imageBelow", message))
        } else {
            planned.insertions.push(change)
            items.set(block, makeItem(block, "inserted", message))
        }
    }
    return { items, planned }
}
