import {
    DEFAULT_GRAPHER_HEIGHT,
    DEFAULT_GRAPHER_WIDTH,
    generateGrapherImageSrcSet,
} from "@ourworldindata/grapher"
import { GRAPHER_DYNAMIC_THUMBNAIL_URL } from "../settings/clientSettings.js"
import { Url } from "@ourworldindata/utils"

function GrapherImageSource({
    defaultSrc,
    suppressHydrationWarning,
}: {
    defaultSrc: string
    suppressHydrationWarning: boolean | undefined
}) {
    const srcSet = generateGrapherImageSrcSet(defaultSrc)
    const sizes = `(max-width: 850px) 100vw, 850px`

    return (
        <source
            id="grapher-preview-source"
            srcSet={srcSet}
            sizes={sizes}
            suppressHydrationWarning={suppressHydrationWarning}
        />
    )
}

export default function GrapherImage(props: {
    url: string
    alt?: string
    noFormatting?: boolean
    enablePopulatingUrlParams?: boolean
}): React.ReactElement
export default function GrapherImage(props: {
    slug: string
    queryString?: string
    alt?: string
    noFormatting?: boolean
    enablePopulatingUrlParams?: boolean
}): React.ReactElement
export default function GrapherImage(props: {
    url?: string
    slug?: string
    queryString?: string
    alt?: string
    noFormatting?: boolean
    enablePopulatingUrlParams?: boolean
}) {
    if (!GRAPHER_DYNAMIC_THUMBNAIL_URL) return null

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
            <GrapherImageSource
                defaultSrc={defaultSrc}
                suppressHydrationWarning={props.enablePopulatingUrlParams}
            />
            <img
                className="GrapherImage"
                src={defaultSrc}
                alt={props.alt}
                width={DEFAULT_GRAPHER_WIDTH}
                height={DEFAULT_GRAPHER_HEIGHT}
                loading="lazy"
                data-no-img-formatting={props.noFormatting}
                // Suppresses a (inevitable) hydration mismatch warning when the image is rendered on the server with a dynamic URL incl. query
                // params, and the client then replaces it with "just" a normal URL.
                suppressHydrationWarning={props.enablePopulatingUrlParams}
            />
        </picture>
    )
}
