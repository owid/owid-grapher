import { Env } from "./env.js"

// Polyfill middleware for use-sync-external-store's require("react") call
export const polyfillMiddleware: PagesFunction<Env> = async (context) => {
    // Set up the require polyfill if it doesn't exist
    if (typeof globalThis.require === "undefined") {
        globalThis.require = (module: string) => {
            if (module === "react") {
                // Return minimal React object that use-sync-external-store expects
                return { useSyncExternalStore: undefined }
            }
            throw new Error(
                `Module ${module} not available in CloudFlare environment`
            )
        }
    }

    // Continue to the next middleware/handler
    return context.next()
}
