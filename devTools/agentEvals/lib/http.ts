import fs from "fs"
import path from "path"

export interface FetchTextResult {
    status: number
    contentType: string
    body: string
    url: string
}

export interface FetchTextOptions {
    accept?: string
    timeoutMs?: number
    retries?: number
}

/** GET a text resource with a wall-clock timeout and a couple of retries on 5xx. */
export async function fetchText(
    url: string,
    { accept, timeoutMs = 90_000, retries = 2 }: FetchTextOptions = {}
): Promise<FetchTextResult> {
    let lastError: unknown
    for (let attempt = 0; attempt <= retries; attempt++) {
        const controller = new AbortController()
        const timer = setTimeout(() => controller.abort(), timeoutMs)
        try {
            const response = await fetch(url, {
                headers: accept ? { accept } : {},
                signal: controller.signal,
                redirect: "follow",
            })
            const body = await response.text()
            if (response.status >= 500 && attempt < retries) {
                lastError = new Error(`${response.status} from ${url}`)
                continue
            }
            return {
                status: response.status,
                contentType: response.headers.get("content-type") ?? "",
                body,
                url,
            }
        } catch (error) {
            lastError = error
        } finally {
            clearTimeout(timer)
        }
        await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)))
    }
    throw lastError instanceof Error ? lastError : new Error(String(lastError))
}

/** Like fetchText, but stores the body on disk and reuses it on later runs. */
export async function fetchTextCached(
    url: string,
    cacheFile: string,
    options: FetchTextOptions = {}
): Promise<string> {
    if (fs.existsSync(cacheFile)) return fs.readFileSync(cacheFile, "utf8")
    const result = await fetchText(url, options)
    if (result.status !== 200)
        throw new Error(
            `${result.status} from ${url}: ${result.body.slice(0, 200)}`
        )
    fs.mkdirSync(path.dirname(cacheFile), { recursive: true })
    fs.writeFileSync(cacheFile, result.body)
    return result.body
}
