import {
    gitCmsRoute,
    WriteRequest,
    ReadRequest,
    DeleteRequest
} from "./constants"
const gitCmsApiPath = `/admin/api${gitCmsRoute}`

const validateFilePath = (path: string) => {
    if (path.includes("~")) throw new Error(`Filenames with ~ not supported`)
}

export const deleteRemoteFile = async (request: DeleteRequest) => {
    validateFilePath(request.filepath)
    request.filepath = request.filepath.replace(/\//g, "~")
    await fetch(`${gitCmsApiPath}?filepath=${request.filepath}`, {
        method: "DELETE"
    })
}
export const readRemoteFile = async (request: ReadRequest) => {
    validateFilePath(request.filepath)
    request.filepath = request.filepath.replace(/\//g, "~")
    const response = await fetch(
        `${gitCmsApiPath}?filepath=${request.filepath}`
    )
    const file = await response.json()
    return file.content
}

export const writeRemoteFile = async (request: WriteRequest) => {
    validateFilePath(request.filepath)
    const response = await fetch(gitCmsApiPath, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(request)
    })

    const result = await response.json()
    return result
}
