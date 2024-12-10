export interface Env {
    ASSETS: Fetcher
    url: URL
    GRAPHER_CONFIG_R2_BUCKET_URL: string
    GRAPHER_CONFIG_R2_BUCKET_FALLBACK_URL: string
    GRAPHER_CONFIG_R2_BUCKET_PATH: string
    GRAPHER_CONFIG_R2_BUCKET_FALLBACK_PATH: string
    CF_PAGES_BRANCH: string
    CLOUDFLARE_IMAGES_API_KEY: string
    CLOUDFLARE_IMAGES_URL: string
    ENV: string
}
// We collect the possible extensions here so we can easily take them into account
// when handling redirects
export const extensions = {
    configJson: ".config.json",
    png: ".png",
    svg: ".svg",
    csv: ".csv",
    metadata: ".metadata.json",
    readme: ".readme.md",
    zip: ".zip",
}
export type Etag = string
