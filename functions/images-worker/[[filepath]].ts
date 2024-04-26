import { RequestInit, RequestInitCfProperties } from "@cloudflare/workers-types"

export const onRequestGet: PagesFunction = async (context) => {
    const imageFilepath = context.params.filepath
    return handleRequest(context.request, imageFilepath)
}

/**
 * Fetch and log a request
 * @param {Request} request
 */
async function handleRequest(request: Request, filepath: string[]) {
    // Parse request URL to get access to query string
    const url = new URL(request.url)

    const fileExtension = filepath.at(-1).split(".").pop()

    // Cloudflare-specific options are in the cf object.
    const options: RequestInit<RequestInitCfProperties> = { cf: { image: {} } }

    // Copy parameters from query string to request options.
    // You can implement various different parameters here.
    if (url.searchParams.has("fit"))
        options.cf.image.fit = url.searchParams.get("fit") as any
    if (url.searchParams.has("width"))
        options.cf.image.width = url.searchParams.get("width") as any
    if (url.searchParams.has("height"))
        options.cf.image.height = url.searchParams.get("height") as any
    if (url.searchParams.has("quality"))
        options.cf.image.quality = url.searchParams.get("quality") as any

    // Your Worker is responsible for automatic format negotiation. Check the Accept header.
    // const accept = request.headers.get("Accept")
    // if (/image\/avif/.test(accept)) {
    //     options.cf.image.format = "avif"
    // } else if (/image\/webp/.test(accept)) {
    //     options.cf.image.format = "webp"
    // }

    options.cf.image.format = fileExtension as any

    // Get URL of the original (full size) image to resize.
    // You could adjust the URL here, e.g., prefix it with a fixed address of your server,
    // so that user-visible URLs are shorter and cleaner.
    const imageURL = new URL(`/${filepath.join("/")}`, url)

    // Build a request that passes through request headers
    const imageRequest = new Request(imageURL, {
        headers: request.headers,
    })

    // Returning fetch() with resizing options will pass through response with the resized image.
    return fetch(imageRequest, options)
}
