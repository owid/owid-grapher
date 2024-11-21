// Double brackets around this filename allows us to match /:id/w=:width
import { Env, Etag } from "../_common/env.js"
import { IRequestStrict, Router, StatusError, error } from "itty-router"

const router = Router<
    IRequestStrict,
    [URL, Env, Etag, EventContext<unknown, any, Record<string, unknown>>]
>()

router
    .get(`/images/:id/w=:width`, async ({ params: { id, width } }, _, env) => {
        const sourceUrl = `${env.CLOUDFLARE_IMAGES_URL}/${id}/w=${width}`
        const image = await fetch(sourceUrl, {
            headers: {
                Authorization: `Bearer ${env.CLOUDFLARE_IMAGES_API_KEY}`,
                // Based on my experiments, as long as width is the source image's width, CF won't change the format.
                // e.g. if example.png is 1000px wide and we request example.png/w=1000, we'll get a PNG.
                // If we ask for a different size, we might get a JPEG (but not a WebP or AVIF.)
                Accept: "image/png, image/jpeg, image/svg+xml",
            },
        })
        const buffer = await image.arrayBuffer()

        const maxAge = 60 * 60 * 24 // 1 day

        const response = new Response(buffer, {
            status: image.status,
            headers: new Headers({
                "Content-Type": image.headers.get("Content-Type"),
                "Content-Length": image.headers.get("Content-Length"),
                "Cache-Control": `public, max-age=${maxAge}`,
                "Access-Control-Allow-Origin": "*",
            }),
        })

        return response
    })
    .all("*", () => error(404, "Route not defined"))

export const onRequest: PagesFunction<Env> = async (context) => {
    const { request, env } = context
    const url = new URL(request.url)

    return router
        .fetch(
            request,
            url,
            { ...env, url },
            request.headers.get("if-none-match"),
            context
        )
        .catch(async (e) => {
            console.log("Handling error", e)
            if (e instanceof StatusError && e.status === 404) {
                console.log("Handling 404 for", url.pathname)
                return error(404, "Not found")
            } else if (e instanceof StatusError) {
                return error(e.status, e.message)
            } else return error(500, e)
        })
}
