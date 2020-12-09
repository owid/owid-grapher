import {
    GIT_CMS_READ_ROUTE,
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
    GIT_CMS_DELETE_ROUTE,
    GIT_CMS_WRITE_ROUTE,
} from "./GitCmsConstants"

// todo: clarify what is going on here. i already forget.
const validateFilePath = (path: string) => {
    if (path.includes("~")) throw new Error(`Filenames with ~ not supported`)
}

export class GitCmsClient {
    private basePath: string
    constructor(basePath: string) {
        this.basePath = basePath
    }

    async pullFromGithub() {
        const response = await fetch(`${this.basePath}${GIT_CMS_PULL_ROUTE}`, {
            method: "POST",
        })
        return (await response.json()) as GitPullResponse
    }

    async readRemoteFiles(request: GlobRequest) {
        const response = await fetch(
            `${this.basePath}${GIT_CMS_GLOB_ROUTE}?glob=${request.glob}&folder=${request.folder}`
        )
        return (await response.json()) as GitCmsGlobResponse
    }

    async deleteRemoteFile(request: DeleteRequest) {
        validateFilePath(request.filepath)
        request.filepath = request.filepath.replace(/\//g, "~")
        const response = await fetch(
            `${this.basePath}${GIT_CMS_DELETE_ROUTE}?filepath=${request.filepath}`,
            {
                method: "DELETE",
            }
        )
        return (await response.json()) as GitCmsResponse
    }

    async readRemoteFile(request: ReadRequest) {
        validateFilePath(request.filepath)
        request.filepath = request.filepath.replace(/\//g, "~")
        const response = await fetch(
            `${this.basePath}${GIT_CMS_READ_ROUTE}?filepath=${request.filepath}`
        )

        return (await response.json()) as GitCmsReadResponse
    }

    async writeRemoteFile(request: WriteRequest) {
        validateFilePath(request.filepath)
        const response = await fetch(`${this.basePath}${GIT_CMS_WRITE_ROUTE}`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(request),
        })

        return (await response.json()) as GitCmsResponse
    }
}
