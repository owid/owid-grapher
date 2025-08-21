import {
    DbInsertFile,
    DbPlainFile,
    FilesTableName,
    JsonError,
} from "@ourworldindata/types"
import fs from "fs/promises"
import * as db from "../../db/db.js"
import { Request } from "../authentication.js"
import e from "express"
import { saveFileToAssetsR2 } from "../R2/assetsR2Helpers.js"
import path from "path"
import { MULTER_UPLOADS_DIRECTORY } from "../../adminShared/validation.js"

export async function getFiles(
    _req: Request,
    _res: e.Response<any, Record<string, any>>,
    trx: db.KnexReadonlyTransaction
): Promise<{ files: DbPlainFile[] }> {
    const files = await trx(FilesTableName).select("*")
    return { files }
}

export async function uploadFileToR2(
    req: Request & { file?: Express.Multer.File },
    res: e.Response<any, Record<string, any>>,
    trx: db.KnexReadWriteTransaction
): Promise<{ success: boolean; path: string }> {
    if (!req.file) {
        throw new JsonError("No file uploaded", 400)
    }
    const filePath = String(req.query.path)
    if (!filePath) {
        throw new JsonError("No target path specified", 400)
    }
    const tmpPath = path.resolve(req.file.path)
    const targetPath = path.resolve(MULTER_UPLOADS_DIRECTORY)

    if (!tmpPath.startsWith(targetPath + path.sep)) {
        throw new JsonError("Invalid file upload path", 400)
    }

    const filename = req.file.originalname

    const preexistingFile = await trx(FilesTableName)
        .where({
            filename,
            path: filePath,
        })
        .first()

    if (preexistingFile) {
        throw new JsonError(
            `A file with filename "${filename}" already exists in "${filePath}"`,
            400
        )
    }

    try {
        // Read the uploaded file from tmp-uploads
        const fileBuffer = await fs.readFile(tmpPath)
        const r2Key = path.join(filePath, filename)

        const r2Response = await saveFileToAssetsR2(
            fileBuffer,
            r2Key,
            req.file.mimetype
        )

        if (!r2Response) {
            throw new JsonError("Failed to upload file to R2", 500)
        }

        const removeEtagQuotes = (etag: string = "") => etag.replace(/"/g, "")

        const metadata: DbInsertFile = {
            filename,
            path: filePath,
            etag: removeEtagQuotes(r2Response.ETag),
            createdBy: res.locals.user.id,
        }

        await db.knexRawInsert(
            trx,
            `INSERT INTO files (
                filename,
                path,
                etag,
                createdBy
            ) 
             VALUES (?, ?, ?, ?)`,
            [
                metadata.filename,
                metadata.path,
                metadata.etag,
                metadata.createdBy,
            ]
        )

        // Delete the temporary file
        await fs.unlink(tmpPath)

        return {
            success: true,
            path: filePath,
        }
    } catch (error) {
        // If upload fails, try to clean up the temp file
        try {
            await fs.unlink(tmpPath)
        } catch (unlinkError) {
            // Log but don't throw - the main error is more important
            console.error("Failed to delete temp file:", unlinkError)
        }
        throw error
    }
}
