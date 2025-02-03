import { RcFile } from "antd/es/upload/interface.js"
import { Admin } from "./Admin"
import { DbEnrichedImageWithUserId } from "@ourworldindata/types"
import { CLOUDFLARE_IMAGES_URL } from "../settings/clientSettings"

export type File = string | Blob | RcFile

type FileToBase64Result = {
    filename: string
    content: string
    type: string
}

export type ImageUploadResponse =
    | { success: true; image: DbEnrichedImageWithUserId }
    | { success: false; errorMessage: string }

/**
 * Uploading as base64, because otherwise we'd need multipart/form-data parsing middleware in the server.
 * This seems easier as a one-off.
 **/
export function fileToBase64(file: File): Promise<FileToBase64Result | null> {
    if (typeof file === "string") return Promise.resolve(null)

    return new Promise((resolve) => {
        const reader = new FileReader()
        reader.onload = () => {
            resolve({
                filename: file.name,
                content: reader.result?.toString() ?? "",
                type: file.type,
            })
        }
        reader.readAsDataURL(file)
    })
}

export async function reuploadImageFromSourceUrl({
    admin,
    image,
    sourceUrl,
}: {
    admin: Admin
    image: { id: number; filename: string }
    sourceUrl: string
}): Promise<ImageUploadResponse> {
    const imageResponse = await fetch(sourceUrl)
    const blob = await imageResponse.blob()

    const payload = await fileToBase64(blob)
    if (!payload) {
        return {
            success: false,
            errorMessage: "Failed to convert image to base64",
        }
    }
    payload.filename = image.filename

    const response = await admin.requestJSON<ImageUploadResponse>(
        `/api/images/${image.id}`,
        payload,
        "PUT"
    )

    return response
}

export function makeImageSrc(cloudflareId: string, width: number) {
    return `${CLOUDFLARE_IMAGES_URL}/${encodeURIComponent(cloudflareId)}/w=${width}`
}
