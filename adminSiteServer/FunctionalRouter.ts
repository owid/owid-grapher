import { Hono, Context } from "hono"
import fs from "fs/promises"
import path from "path"
import crypto from "crypto"
import { MULTER_UPLOADS_DIRECTORY } from "../adminShared/validation.js"
import { AppVariables, HonoContext } from "./authentication.js"
import { DbPlainUser } from "@ourworldindata/utils"

type HonoApp = Hono<{ Variables: AppVariables }>

/**
 * Express-compatible Request facade built from Hono's Context.
 * Lets existing handler code keep using `req.params`, `req.query`, `req.body`, etc.
 */
export interface CompatRequest {
    params: Record<string, string>
    query: Record<string, string | string[]>
    body: any
    headers: Record<string, string>
    cookies: Record<string, string>
    method: string
    path: string
    originalUrl: string
    ip: string | undefined
    file?: {
        path: string
        originalname: string
        mimetype: string
        size: number
    }
    get(name: string): string | undefined
}

/**
 * Express-compatible Response facade built from Hono's Context.
 * FunctionalRouter handlers return data, so they don't need res.send() etc.
 * But they do access res.locals.user.
 */
export interface CompatResponse {
    locals: { user: DbPlainUser }
    /** Set a response header (accumulated on the Hono context). */
    set(name: string, value: string): void
    /** Alias for set() — Express compat. */
    setHeader(name: string, value: string): void
    /** Set Content-Type header — Express compat. */
    type(contentType: string): void
    /** Set status code. Returns self for chaining. */
    status(code: number): CompatResponse
}

/** Alias kept for backward compat — handler files import this type. */
export type HandlerResponse = CompatResponse

/** Same as HandlerResponse but used by plain router helpers that need full response control. */
export type FullResponse = CompatResponse & {
    send(body: string | object | undefined): void
    json(body: any): void
    redirect(url: string): void
    end(): void
    write(chunk: string): void
    attachment(filename: string): void
    contentType(type: string): FullResponse
    clearCookie(name: string): void
    status(code: number): FullResponse
}

function buildCompatRequest(c: HonoContext, body?: any): CompatRequest {
    const url = new URL(c.req.url)
    return {
        params: c.req.param() as Record<string, string>,
        query: Object.fromEntries(url.searchParams.entries()),
        body,
        headers: Object.fromEntries(Array.from(c.req.raw.headers.entries())),
        cookies: parseCookieHeader(c.req.header("cookie") || ""),
        method: c.req.method,
        path: url.pathname,
        originalUrl: url.pathname + url.search,
        ip:
            c.req.header("x-forwarded-for") ||
            c.req.header("x-real-ip") ||
            undefined,
        get(name: string) {
            return c.req.header(name)
        },
    }
}

function parseCookieHeader(header: string): Record<string, string> {
    const cookies: Record<string, string> = {}
    if (!header) return cookies
    for (const pair of header.split(";")) {
        const [key, ...rest] = pair.split("=")
        if (key) {
            cookies[key.trim()] = decodeURIComponent(rest.join("=").trim())
        }
    }
    return cookies
}

function buildCompatResponse(c: HonoContext): CompatResponse {
    return {
        locals: {
            get user(): DbPlainUser {
                return c.get("user")
            },
        },
        set(name: string, value: string) {
            c.header(name, value)
        },
        setHeader(name: string, value: string) {
            c.header(name, value)
        },
        type(contentType: string) {
            c.header("Content-Type", contentType)
        },
        status(_code: number) {
            // Status is stored but not used — FunctionalRouter always sends
            // the return value as JSON with 200.
            return this
        },
    }
}

function buildFullResponse(
    c: HonoContext,
    responseState: { body?: string | object; statusCode: number }
): FullResponse {
    return {
        locals: {
            get user(): DbPlainUser {
                return c.get("user")
            },
        },
        set(name: string, value: string) {
            c.header(name, value)
        },
        setHeader(name: string, value: string) {
            c.header(name, value)
        },
        type(contentType: string) {
            c.header("Content-Type", contentType)
        },
        status(code: number) {
            responseState.statusCode = code
            return this
        },
        send(body: string | object | undefined) {
            responseState.body = body ?? ""
        },
        json(body: any) {
            responseState.body = body
        },
        redirect(url: string) {
            responseState.body = { __redirect: url }
        },
        end() {
            if (responseState.body === undefined) responseState.body = ""
        },
        write(chunk: string) {
            responseState.body = ((responseState.body as string) || "") + chunk
        },
        attachment(filename: string) {
            c.header(
                "Content-Disposition",
                `attachment; filename="${filename}"`
            )
        },
        contentType(type: string) {
            c.header("Content-Type", type)
            return this
        },
        clearCookie(_name: string) {
            // For Hono, use deleteCookie from hono/cookie instead
        },
    }
}

// Little wrapper to automatically send returned objects as JSON, makes
// the API code a bit cleaner
export class FunctionalRouter {
    app: HonoApp
    constructor() {
        this.app = new Hono<{ Variables: AppVariables }>()
    }

    /** For backward compat: apiRouter.router → apiRouter.app */
    get router(): HonoApp {
        return this.app
    }

    private wrapHandler(
        callback: (req: CompatRequest, res: HandlerResponse) => Promise<any>
    ) {
        return async (c: Context<{ Variables: AppVariables }>) => {
            const body = await parseBody(c)
            const req = buildCompatRequest(c as HonoContext, body)
            const res = buildCompatResponse(c as HonoContext)
            const result = await callback(req, res)
            return c.json(result)
        }
    }

    get(
        targetPath: string,
        callback: (req: CompatRequest, res: HandlerResponse) => Promise<any>
    ) {
        this.app.get(targetPath, this.wrapHandler(callback))
    }

    post(
        targetPath: string,
        callback: (req: CompatRequest, res: HandlerResponse) => Promise<any>
    ) {
        this.app.post(targetPath, this.wrapHandler(callback))
    }

    patch(
        targetPath: string,
        callback: (req: CompatRequest, res: HandlerResponse) => Promise<any>
    ) {
        this.app.patch(targetPath, this.wrapHandler(callback))
    }

    put(
        targetPath: string,
        callback: (req: CompatRequest, res: HandlerResponse) => Promise<any>
    ) {
        this.app.put(targetPath, this.wrapHandler(callback))
    }

    delete(
        targetPath: string,
        callback: (req: CompatRequest, res: HandlerResponse) => Promise<any>
    ) {
        this.app.delete(targetPath, this.wrapHandler(callback))
    }

    postWithFileUpload(
        targetPath: string,
        callback: (req: CompatRequest, res: HandlerResponse) => Promise<any>
    ) {
        this.app.post(
            targetPath,
            async (c: Context<{ Variables: AppVariables }>) => {
                // Parse multipart body natively via Hono
                const parsed = await c.req.parseBody({ all: true })

                const file = parsed["file"]
                if (!(file instanceof File)) {
                    return c.json({ error: "No file uploaded" }, 400)
                }

                // Write to a temp file in the uploads directory so the
                // handler's existing cleanup logic (fs.unlink) still works.
                await fs.mkdir(MULTER_UPLOADS_DIRECTORY, { recursive: true })
                const tmpName = crypto.randomBytes(16).toString("hex")
                const tmpPath = path.join(MULTER_UPLOADS_DIRECTORY, tmpName)
                const buffer = Buffer.from(await file.arrayBuffer())
                await fs.writeFile(tmpPath, buffer)

                // Build the remaining form fields as the body
                const body: Record<string, any> = {}
                for (const [key, value] of Object.entries(parsed)) {
                    if (key !== "file") body[key] = value
                }

                const req = buildCompatRequest(c as HonoContext, body)
                req.file = {
                    path: tmpPath,
                    originalname: file.name,
                    mimetype: file.type,
                    size: file.size,
                }
                const res = buildCompatResponse(c as HonoContext)
                const result = await callback(req, res)
                return c.json(result)
            }
        )
    }
}

async function parseBody(c: Context): Promise<any> {
    const contentType = c.req.header("content-type") || ""
    if (contentType.includes("application/json")) {
        try {
            return await c.req.json()
        } catch {
            return {}
        }
    }
    if (contentType.includes("application/x-www-form-urlencoded")) {
        try {
            return await c.req.parseBody()
        } catch {
            return {}
        }
    }
    return undefined
}

export { buildCompatRequest, buildFullResponse, parseBody }
export type { CompatRequest as Request }
