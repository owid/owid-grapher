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
    enablePopulatingUrlParams,
}: {
    slug: string
    alt?: string
    noFormatting?: boolean
    enablePopulatingUrlParams?: boolean
}) {
    return (
        <img
            className="GrapherImage"
            // TODO: use the CF worker to render these previews so that we can show non-default configurations of the chart
            // https://github.com/owid/owid-grapher/issues/3661
            src={`${BAKED_GRAPHER_EXPORTS_BASE_URL}/${slug}.svg`}
            alt={alt}
            width={DEFAULT_GRAPHER_WIDTH}
            height={DEFAULT_GRAPHER_HEIGHT}
            loading="lazy"
            data-no-lightbox
            data-no-img-formatting={noFormatting}
            // This tells our Cloudflare functions to replace the src with the dynamic thumbnail URL, including URL params like `?time=2020`
            data-owid-populate-url-params={enablePopulatingUrlParams}
        />
    )
}
