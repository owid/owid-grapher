import * as Figma from "figma-api"
import { RcFile } from "antd/es/upload/interface.js"
import { Admin } from "./Admin"
import { DbEnrichedImageWithUserId } from "@ourworldindata/types"
import {
    CLOUDFLARE_IMAGES_URL,
    FIGMA_API_KEY,
} from "../settings/clientSettings"

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

    const payload = await fileToBase64(blob)
    if (!payload) {
        return {
            success: false,
            errorMessage: "Failed to convert image to base64",
        }
    }
    payload.filename = image.filename

    const response = await admin.requestJSON<ImageUploadResponse>(
        image.id ? `/api/images/${image.id}` : `/api/images`,
        payload,
        image.id ? "PUT" : "POST"
    )

    return response
}

export async function fetchFigmaProvidedImageUrl(
    figmaUrl: string
): Promise<FigmaResponse> {
    const figmaApi = new Figma.Api({
        personalAccessToken: FIGMA_API_KEY,
    })

    const { fileId, nodeId } = extractIdsFromFigmaUrl(figmaUrl) ?? {}
    if (!fileId || !nodeId)
        return {
            success: false,
            errorMessage:
                "Invalid Figma URL. The provided URL should point to a Figma node.",
        }

    // Request the image URL from Figma
    const imageMap = await figmaApi.getImages(
        { file_key: fileId },
        { ids: [nodeId], scale: 3 }
    )
    if (!imageMap || imageMap.err !== null)
        return {
            success: false,
            errorMessage: "Failed to fetch image map from Figma",
        }

    // Grab the image URL from the image map
    const imageUrl = imageMap.images[nodeId]
    if (!imageUrl) {
        return {
            success: false,
            errorMessage: "Figma's image map does not contain the image",
        }
    }

    return {
        success: true,
        imageUrl: imageUrl,
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
