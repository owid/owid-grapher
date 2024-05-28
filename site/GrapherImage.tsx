import React from "react"

import {
    DEFAULT_GRAPHER_HEIGHT,
    DEFAULT_GRAPHER_WIDTH,
} from "@ourworldindata/grapher"
import { BAKED_GRAPHER_EXPORTS_BASE_URL } from "../settings/clientSettings.js"

export default function GrapherImage({
    alt,
    slug,
    noFormatting,
}: {
    slug: string
    alt?: string
    noFormatting?: boolean
}) {
    return (
        <img
            className="GrapherImage"
            src={`${BAKED_GRAPHER_EXPORTS_BASE_URL}/${slug}.svg`}
            alt={alt}
            width={DEFAULT_GRAPHER_WIDTH}
            height={DEFAULT_GRAPHER_HEIGHT}
            loading="lazy"
            data-no-lightbox
            data-no-img-formatting={noFormatting}
        />
    )
}
