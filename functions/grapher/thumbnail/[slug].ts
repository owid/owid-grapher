import { createRedirectResponse } from "../../_common/redirectTools.js"

/** Redirects the deprecated `/grapher/thumbnail/:slug` image route to `/grapher/:slug.(png|svg)` */
export const onRequestGet: PagesFunction = async ({ request, params }) => {
    const url = new URL(request.url)
    const slugWithExtension = params.slug as string
    // The old route served SVG when the path had no extension
    const targetFilename = /\.(png|svg)$/.test(slugWithExtension)
        ? slugWithExtension
        : `${slugWithExtension}.svg`
    return createRedirectResponse(url, `/grapher/${targetFilename}`)
}
