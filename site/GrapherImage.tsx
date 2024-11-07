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
}): JSX.Element
export default function GrapherImage(props: {
    slug: string
    queryString?: string
    alt?: string
    noFormatting?: boolean
}): JSX.Element
export default function GrapherImage(props: {
    url?: string
    slug?: string
    queryString?: string
    alt?: string
    noFormatting?: boolean
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
        <picture>
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
