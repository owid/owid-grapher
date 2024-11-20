import React from "react"

import {
    DEFAULT_GRAPHER_HEIGHT,
    DEFAULT_GRAPHER_WIDTH,
    generateGrapherImageSrcSet,
} from "@ourworldindata/grapher"
import { GRAPHER_DYNAMIC_THUMBNAIL_URL } from "../settings/clientSettings.js"
import { Url } from "@ourworldindata/utils"

function GrapherImageSource({ defaultSrc }: { defaultSrc: string }) {
    const srcSet = generateGrapherImageSrcSet(defaultSrc)
    const sizes = `(max-width: 850px) 100vw, 850px`

    return <source id="grapher-preview-source" srcSet={srcSet} sizes={sizes} />
}

export default function GrapherImage(props: {
    url: string
    alt?: string
    noFormatting?: boolean
    enablePopulatingUrlParams?: boolean
}): JSX.Element
export default function GrapherImage(props: {
    slug: string
    queryString?: string
    alt?: string
    noFormatting?: boolean
    enablePopulatingUrlParams?: boolean
}): JSX.Element
export default function GrapherImage(props: {
    url?: string
    slug?: string
    queryString?: string
    alt?: string
    noFormatting?: boolean
    enablePopulatingUrlParams?: boolean
}) {
    let slug: string = ""
    let queryString: string = ""
    if (props.url) {
        const url = Url.fromURL(props.url)
        slug = url.slug!
        queryString = url.queryStr
    } else {
        slug = props.slug!
        queryString = props.queryString ?? ""
    }

    const defaultSrc = `${GRAPHER_DYNAMIC_THUMBNAIL_URL}/${slug}.png${queryString}`
    return (
        <picture
            // This tells our Cloudflare functions to replace the src with the dynamic thumbnail URL, including URL params like `?time=2020`.
            // Enabling this option only makes sense if this is the _main_ chart on a _standalone_ grapher/data page - it will pass on the URL params from the page to the thumbnail.
            data-owid-populate-url-params={props.enablePopulatingUrlParams}
        >
            <GrapherImageSource defaultSrc={defaultSrc} />
            <img
                className="GrapherImage"
                src={defaultSrc}
                alt={props.alt}
                width={DEFAULT_GRAPHER_WIDTH}
                height={DEFAULT_GRAPHER_HEIGHT}
                loading="lazy"
                data-no-lightbox
                data-no-img-formatting={props.noFormatting}
            />
        </picture>
    )
}
