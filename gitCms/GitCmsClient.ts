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
} from "./GitCmsConstants.js"

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
        return (await this.post(
            GIT_CMS_GLOB_ROUTE,
            request
        )) as GitCmsGlobResponse
    }

    private async post(route: string, request: any) {
        const response = await fetch(`${this.basePath}${route}`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(request),
        })
        return await response.json()
    }

    async deleteRemoteFile(request: DeleteRequest) {
        validateFilePath(request.filepath)
        return (await this.post(
            GIT_CMS_DELETE_ROUTE,
            request
        )) as GitCmsResponse
    }

    async readRemoteFile(request: ReadRequest) {
        validateFilePath(request.filepath)
        return (await this.post(
            GIT_CMS_READ_ROUTE,
            request
        )) as GitCmsReadResponse
    }

    async writeRemoteFile(request: WriteRequest) {
        validateFilePath(request.filepath)
        return (await this.post(GIT_CMS_WRITE_ROUTE, request)) as GitCmsResponse
    }
}
