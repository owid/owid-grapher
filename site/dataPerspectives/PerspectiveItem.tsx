import { useState } from "react"
import { CLOUDFLARE_IMAGES_URL } from "../../settings/clientSettings.mjs"
import { chartUrl, type DataPage, type Perspective } from "./data.js"

type RelatedDataItem = NonNullable<DataPage["relatedData"]>["items"][number]
type RelatedArticleItem = NonNullable<
    DataPage["relatedArticles"]
>["items"][number]

export interface PerspectiveSectionProps {
    page: DataPage
    selectedId?: string
    onSelect: (perspective: Perspective) => void
}

export function PerspectiveItem({
    page,
    perspective,
    selected,
    onSelect,
}: {
    page: DataPage
    perspective: Perspective
    selected: boolean
    onSelect: (perspective: Perspective) => void
}) {
    return (
        <button
            className="perspective"
            aria-pressed={selected}
            onClick={() => onSelect(perspective)}
        >
            <PerspectiveThumbnail src={chartUrl(page, perspective, true)} />
            <span className="perspective__title">{perspective.title}</span>
        </button>
    )
}

export function RelatedDataLink({ item }: { item: RelatedDataItem }) {
    return (
        <a className="perspective" href={`/grapher/${item.slug}`}>
            <PerspectiveThumbnail src={chartUrl(item, undefined, true)} />
            <span className="perspective__title">{item.title}</span>
        </a>
    )
}

export function RelatedArticleLink({
    item,
    imageWidth,
}: {
    item: RelatedArticleItem
    imageWidth: number
}) {
    return (
        <a className="perspective perspective--article" href={`/${item.slug}`}>
            <PerspectiveThumbnail
                src={`${CLOUDFLARE_IMAGES_URL}/${item.imageId}/w=${imageWidth}`}
            />
            <span className="perspective__title">{item.title}</span>
        </a>
    )
}

export function PerspectiveThumbnail({ src }: { src: string }) {
    const [imageFailed, setImageFailed] = useState(false)
    return (
        <span className="perspective__image">
            {imageFailed ? (
                <span className="perspective__fallback" aria-hidden="true">
                    —
                </span>
            ) : (
                <img
                    src={src}
                    alt=""
                    width="400"
                    height="240"
                    onError={() => setImageFailed(true)}
                />
            )}
        </span>
    )
}
