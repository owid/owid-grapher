import {
    gitCmsRoute,
    WriteRequest,
    ReadRequest,
    GitCmsResponse,
    GitCmsReadResponse,
    DeleteRequest
} from "./constants"
const gitCmsApiPath = `/admin/api${gitCmsRoute}`

const validateFilePath = (path: string) => {
    if (path.includes("~")) throw new Error(`Filenames with ~ not supported`)
}

export const deleteRemoteFile = async (request: DeleteRequest) => {
    validateFilePath(request.filepath)
    request.filepath = request.filepath.replace(/\//g, "~")
    const response = await fetch(
        `${gitCmsApiPath}?filepath=${request.filepath}`,
        {
            method: "DELETE"
        }
    )
    const parsed: GitCmsResponse = await response.json()
    return parsed
}

export const readRemoteFile = async (request: ReadRequest) => {
    validateFilePath(request.filepath)
    request.filepath = request.filepath.replace(/\//g, "~")
    const response = await fetch(
        `${gitCmsApiPath}?filepath=${request.filepath}`
    )

    const parsed: GitCmsReadResponse = await response.json()
    return parsed
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

    const parsed: GitCmsResponse = await response.json()
    return parsed
}
