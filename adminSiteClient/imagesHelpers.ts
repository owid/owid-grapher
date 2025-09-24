import { RcFile } from "antd/es/upload/interface.js"
import { Admin } from "./Admin"
import { DbEnrichedImageWithUserId } from "@ourworldindata/types"
import { CLOUDFLARE_IMAGES_URL } from "../settings/clientSettings"

export type File = string | Blob | RcFile

type FigmaResponse =
    | { success: true; imageUrl: string }
    | { success: false; errorMessage: string }

type FileToBase64Result = {
    filename: string
    content: string
    type: string
}

export type ImageUploadResponse =
    | { success: true; image: DbEnrichedImageWithUserId }
    | { success: false; errorMessage: string }

export const ACCEPTED_IMG_TYPES = [
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/avif",
    "image/gif",
]

/**
 * Uploading as base64, because otherwise we'd need multipart/form-data parsing middleware in the server.
 * This seems easier as a one-off.
 **/
export function fileToBase64(
    file: File,
    /** If you use the antd Upload component, file has a name
     * but if you're getting this blob online (e.g. via Figma) it might not have a name
     * so we need to pass it in manually
     */
    manualFilename?: string
): Promise<FileToBase64Result | null> {
    if (typeof file === "string") return Promise.resolve(null)

    // Awkward solution to union type shenanigans
    function getFilename(
        file: Blob | RcFile,
        filename?: string
    ): string | undefined {
        if ("name" in file) return file.name as string
        return filename
    }

    const filename = getFilename(file, manualFilename)

    // We absolutely need a filename, so we can't process a Blob which doesn't have one
    if (!filename) return Promise.resolve(null)

    return new Promise((resolve) => {
        const reader = new FileReader()
        reader.onload = () => {
            resolve({
                filename,
                content: reader.result?.toString() ?? "",
                type: file.type,
            })
        }
        reader.readAsDataURL(file)
    })
}

export async function uploadImageFromSourceUrl({
    admin,
    image,
    sourceUrl,
}: {
    admin: Admin
    image: { id?: number; filename: string }
    sourceUrl: string
}): Promise<ImageUploadResponse> {
    const imageResponse = await fetch(sourceUrl)
    const blob = await imageResponse.blob()

    const payload = await fileToBase64(blob, image.filename)
    if (!payload) {
        return {
            success: false,
            errorMessage: "Failed to convert image to base64",
        }
    }

    if (image.id) {
        return admin.requestJSON(`/api/images/${image.id}`, payload, "PUT")
    } else {
        return admin.requestJSON(`/api/images`, payload, "POST")
    }
}

export async function fetchFigmaProvidedImageUrl(
    admin: Admin,
    figmaUrl: string
): Promise<FigmaResponse> {
    const { fileId, nodeId } = extractIdsFromFigmaUrl(figmaUrl) ?? {}
    if (!fileId || !nodeId)
        return {
            success: false,
            errorMessage:
                "Invalid Figma URL. The provided URL should point to a Figma node.",
        }

    try {
        return admin.getJSON("/api/figma/image", { fileId, nodeId })
    } catch (error) {
        const errorMessage =
            error instanceof Error ? error.message : String(error)
        return { success: false, errorMessage }
    }
}

export function makeImageSrc(cloudflareId: string, width: number) {
    return `${CLOUDFLARE_IMAGES_URL}/${encodeURIComponent(cloudflareId)}/w=${width}`
}

function extractIdsFromFigmaUrl(
    figmaUrl: string
): { fileId: string; nodeId: string } | undefined {
    const regex =
        /figma\.com\/design\/(?<fileId>[^/]+).*[?&]node-id=(?<nodeId>[^&]+)/
    const { groups } = figmaUrl.match(regex) ?? {}
    if (groups) {
        const fileId = groups.fileId
        const nodeId = groups.nodeId.replace("-", ":")
        return { fileId, nodeId }
    }
    return undefined
}
