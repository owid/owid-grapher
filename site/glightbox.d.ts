// Type definitions for GLightbox 3.2.0
// Project: https://github.com/biati-digital/glightbox
// Definitions by: @mlbrgl (https://github.com/mlbrgl)

declare module "glightbox" {
    export = Glightbox
    declare function Glightbox(options?: Options): GlightboxApi

    export interface GlightboxApi {
        open: () => void
        reload: () => void
    }

    interface Element {
        href?: string
        type?: "image" | "video" | "external"
        title?: string
        description?: string
        height?: number
        width?: number
        content?: string | HTMLElement | null
        alt?: string
        source?: "youtube" | "vimeo" | "local"
    }
    interface Options {
        selector?: string
        elements?: Element[]
        autoplayVideos?: boolean
    }
}
