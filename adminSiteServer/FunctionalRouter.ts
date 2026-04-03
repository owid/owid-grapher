import { Hono, Context } from "hono"
import fs from "fs/promises"
import path from "path"
import crypto from "crypto"
import { FILE_UPLOADS_DIRECTORY } from "../adminShared/validation.js"
import { AppVariables, HonoContext } from "./authentication.js"

type HonoApp = Hono<{ Variables: AppVariables }>
type Handler = (c: HonoContext) => Promise<any>

/**
 * Thin wrapper around a Hono sub-app that automatically JSON-serializes
 * handler return values. Handlers receive the native Hono Context directly.
 */
export class FunctionalRouter {
    app: HonoApp
    constructor() {
        this.app = new Hono<{ Variables: AppVariables }>()
    }

    private wrap(callback: Handler) {
        return async (c: Context<{ Variables: AppVariables }>) => {
            const result = await callback(c as HonoContext)
            return c.json(result)
        }
    }

    get(targetPath: string, callback: Handler) {
        this.app.get(targetPath, this.wrap(callback))
    }

    post(targetPath: string, callback: Handler) {
        this.app.post(targetPath, this.wrap(callback))
    }

    patch(targetPath: string, callback: Handler) {
        this.app.patch(targetPath, this.wrap(callback))
    }

    put(targetPath: string, callback: Handler) {
        this.app.put(targetPath, this.wrap(callback))
    }

    delete(targetPath: string, callback: Handler) {
        this.app.delete(targetPath, this.wrap(callback))
    }

    postWithFileUpload(targetPath: string, callback: Handler) {
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
                await fs.mkdir(FILE_UPLOADS_DIRECTORY, { recursive: true })
                const tmpName = crypto.randomBytes(16).toString("hex")
                const tmpPath = path.join(FILE_UPLOADS_DIRECTORY, tmpName)
                const buffer = Buffer.from(await file.arrayBuffer())
                await fs.writeFile(tmpPath, buffer)

                c.set("uploadedFile", {
                    path: tmpPath,
                    originalname: file.name,
                    mimetype: file.type,
                    size: file.size,
                })

                const result = await callback(c as HonoContext)
                return c.json(result)
            }
        )
    }
}
