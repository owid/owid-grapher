export const GIT_CMS_ROUTE = "/git-cms"
export const GIT_CMS_REPO = `https://github.com/owid/owid-content`
export const GIT_CMS_DIR = __dirname + "/../../owid-content"
export const GIT_PULL_ROUTE = `${GIT_CMS_ROUTE}/pull`

export interface WriteRequest {
    filepath: string
    content: string
}

export interface ReadRequest {
    filepath: string
}

export interface DeleteRequest {
    filepath: string
}

export interface GitCmsResponse {
    success: boolean
    errorMessage?: string
}

export interface GitCmsReadResponse extends GitCmsResponse {
    content: string
}

export interface GitPullResponse extends GitCmsResponse {
    stdout: string
}
