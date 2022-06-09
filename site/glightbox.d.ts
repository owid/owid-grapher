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

    interface Options {
        selector?: string
    }
}
