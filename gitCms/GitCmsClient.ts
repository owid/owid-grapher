import {
    GIT_CMS_FILE_ROUTE,
    WriteRequest,
    ReadRequest,
    GitCmsResponse,
    GitCmsReadResponse,
    DeleteRequest,
    GIT_CMS_PULL_ROUTE,
    GitPullResponse,
    GlobRequest,
    GitCmsGlobResponse,
    GIT_CMS_GLOB_ROUTE,
} from "./GitCmsConstants"
const adminPath = `/admin/api`
const gitCmsApiPath = `${adminPath}${GIT_CMS_FILE_ROUTE}`

const validateFilePath = (path: string) => {
    if (path.includes("~")) throw new Error(`Filenames with ~ not supported`)
}

export const pullFromGithub = async () => {
    const response = await fetch(`${adminPath}${GIT_CMS_PULL_ROUTE}`, {
        method: "POST",
    })
    const parsed: GitPullResponse = await response.json()
    return parsed
}

export const deleteRemoteFile = async (request: DeleteRequest) => {
    validateFilePath(request.filepath)
    request.filepath = request.filepath.replace(/\//g, "~")
    const response = await fetch(
        `${gitCmsApiPath}?filepath=${request.filepath}`,
        {
            method: "DELETE",
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

export const readRemoteFiles = async (request: GlobRequest) => {
    const response = await fetch(
        `${adminPath}${GIT_CMS_GLOB_ROUTE}?glob=${request.glob}&folder=${request.folder}`
    )
    const parsed: GitCmsGlobResponse = await response.json()
    return parsed
}

export const writeRemoteFile = async (request: WriteRequest) => {
    validateFilePath(request.filepath)
    const response = await fetch(gitCmsApiPath, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(request),
    })

    const parsed: GitCmsResponse = await response.json()
    return parsed
}
