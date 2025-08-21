import express, { NextFunction, Router } from "express"
import { Request, Response } from "./authentication.js"
import multer from "multer"
import { MULTER_UPLOADS_DIRECTORY } from "../adminShared/validation.js"

const upload = multer({ dest: MULTER_UPLOADS_DIRECTORY })

// Little wrapper to automatically send returned objects as JSON, makes
// the API code a bit cleaner
export class FunctionalRouter {
    router: Router
    constructor() {
        this.router = Router()
        this.router.use(express.urlencoded({ extended: true }))
        // Parse incoming requests with JSON payloads http://expressjs.com/en/api.html
        this.router.use(express.json({ limit: "50mb" }))
    }

    wrap(callback: (req: Request, res: Response) => Promise<any>) {
        return async (req: Request, res: Response, next: NextFunction) => {
            try {
                res.send(await callback(req, res))
            } catch (e) {
                console.error(e)
                next(e)
            }
        }
    }

    get(
        targetPath: string,
        callback: (req: Request, res: Response) => Promise<any>
    ) {
        this.router.get(targetPath, this.wrap(callback))
    }

    post(
        targetPath: string,
        callback: (req: Request, res: Response) => Promise<any>
    ) {
        this.router.post(targetPath, this.wrap(callback))
    }

    patch(
        targetPath: string,
        callback: (req: Request, res: Response) => Promise<any>
    ) {
        this.router.patch(targetPath, this.wrap(callback))
    }

    put(
        targetPath: string,
        callback: (req: Request, res: Response) => Promise<any>
    ) {
        this.router.put(targetPath, this.wrap(callback))
    }

    delete(
        targetPath: string,
        callback: (req: Request, res: Response) => Promise<any>
    ) {
        this.router.delete(targetPath, this.wrap(callback))
    }

    postWithFileUpload(
        targetPath: string,
        callback: (req: Request, res: Response) => Promise<any>
    ) {
        this.router.post(targetPath, upload.single("file"), this.wrap(callback))
    }
}
