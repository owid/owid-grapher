import { createReadStream } from "fs"
import { google } from "googleapis"
import fs from "fs/promises"
import path from "path"
import parseArgs from "minimist"

import { GdocPost, OwidGoogleAuth } from "../../db/model/Gdoc/GdocPost.js"
import { GDOCS_IMAGES_BACKPORTING_TARGET_FOLDER } from "../../settings/serverSettings.js"

const args = parseArgs(process.argv.slice(2))
const UPLOAD_PATH = args._[0]
const isDryRun: boolean | undefined = args["dry-run"]

if (typeof UPLOAD_PATH === "string") {
    console.log(`Uploading images from ${UPLOAD_PATH} to Google Drive`)
} else {
    throw new Error("Upload path must be set as a positional parameter")
}

const MIME_TYPES: Record<string, string> = {
    [".png"]: "image/png",
    [".jpg"]: "image/jpeg",
    [".jpeg"]: "image/jpeg",
    [".gif"]: "image/gif",
    // The following files also exist in the uploads directory
    // We currently don't have any plans for what to do with them
    // 'csv': 'text/csv',
    // 'DS_Store': 'application/octet-stream',
    // 'gitkeep': 'application/octet-stream',
    // 'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    // 'pdf': 'application/pdf',
    // 'zip': 'application/zip',
    // 'xls': 'application/vnd.ms-excel'
}

// We'll use this as a password to skip throwing an error when validating images during Gdoc.validate()
const WP_ALT_TEXT_BYPASS = "legacy-wordpress-upload"

const RESIZED_IMAGE_REGEX = /\d+x\d+\.(png|gif|jpg|jpeg)$/

const UPLOAD_BATCH_SIZE = 15

const auth = OwidGoogleAuth.getGoogleReadWriteAuth()

const driveClient = google.drive({
    version: "v3",
    auth,
})

function chunkArray<T>(arr: T[], chunkSize: number): T[][] {
    const groups = []
    for (let i = 0; i < arr.length; i += chunkSize) {
        groups.push(arr.slice(i, i + chunkSize))
    }
    return groups
}

function checkIsSupportedFileType(filePath: string) {
    const fileExtension = path.extname(filePath)
    return Object.keys(MIME_TYPES).includes(fileExtension)
}

// Call this to get a list of all the file extensions that exist in the uploads directory
async function getFileExtensions() {
    const fileExtensions: Set<string> = new Set()

    await readFilesRecursively(UPLOAD_PATH, (filePath) => {
        const fileExtension = path.extname(filePath)
        if (fileExtension && !fileExtensions.has(fileExtension)) {
            fileExtensions.add(fileExtension)
        }
    })

    console.log("fileExtensions", fileExtensions)
}

async function readFilesRecursively(
    directoryPath: string,
    callback: (filePath: string) => void
) {
    const files = await fs.readdir(directoryPath)

    await Promise.all(
        files.map(async (file) => {
            const filePath = path.join(directoryPath, file)
            const stats = await fs.stat(filePath)
            if (stats.isDirectory()) {
                return readFilesRecursively(filePath, callback)
            } else {
                callback(filePath)
                return
            }
        })
    )
}

async function getUniqueImageFilePaths(): Promise<string[]> {
    const filePaths: string[] = []
    await readFilesRecursively(UPLOAD_PATH, (filePath) => {
        if (
            checkIsSupportedFileType(filePath) &&
            !RESIZED_IMAGE_REGEX.test(filePath)
        ) {
            filePaths.push(filePath)
        }
    })

    return filePaths
}

async function uploadFileToGoogleDrive(filePath: string): Promise<boolean> {
    try {
        console.log(`Uploading ${filePath}`)
        const file = createReadStream(filePath)
        const fileExtension = path.extname(filePath)
        const mimeType = MIME_TYPES[fileExtension]
        await driveClient.files.create({
            supportsAllDrives: true,
            requestBody: {
                parents: [GDOCS_IMAGES_BACKPORTING_TARGET_FOLDER],
                mimeType,
                name: path.basename(filePath),
                description: WP_ALT_TEXT_BYPASS,
            },
            media: {
                mimeType,
                body: file,
            },
        })
        return true
    } catch (e) {
        console.error(e)
        return false
    }
}
let numberOfChunks = 0
async function uploadWordpressImagesToObjStorage() {
    const filePaths = await getUniqueImageFilePaths()
    const filePathChunks = chunkArray(filePaths, UPLOAD_BATCH_SIZE)
    for (const [index, filePathChunk] of filePathChunks.entries()) {
        numberOfChunks++
        if (isDryRun) {
            console.log("Dry run chunk:", filePathChunk)
        } else {
            console.log("Uploading chunk: ", index)
            await Promise.all(filePathChunk.map(uploadFileToGoogleDrive))
            console.log("Successfully uploaded chunk: ", index)
        }
    }
    console.log("Image backup complete! 🎉")
    console.log("Chunks uploaded: ", numberOfChunks)
    console.log("Images uploaded: ", filePathChunks.flat().length)
}

// Usage: node upload-wordpress-images-to-obj-storage.js ~/owid/wordpress/web/app/uploads/ [--dry-run]
uploadWordpressImagesToObjStorage()
