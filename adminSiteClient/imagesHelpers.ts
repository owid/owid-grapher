import { RcFile } from "antd/es/upload/interface.js"

export type File = string | Blob | RcFile

type FileToBase64Result = {
    filename: string
    content: string
    type: string
}

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
