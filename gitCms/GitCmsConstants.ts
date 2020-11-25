export const GIT_CMS_FILE_ROUTE = "/git-cms"
export const GIT_CMS_DEFAULT_BRANCH = "master"
export const GIT_CMS_REPO_URL = `https://github.com/owid/owid-content`
export const GIT_CMS_DIR = __dirname + "/../../owid-content"
export const GIT_CMS_PULL_ROUTE = `${GIT_CMS_FILE_ROUTE}/pull`
export const GIT_CMS_GLOB_ROUTE = `${GIT_CMS_FILE_ROUTE}/glob`

export interface WriteRequest {
    filepath: string
    content: string
    commitMessage: string
}

export interface ReadRequest {
    filepath: string
}

export interface GlobRequest {
    folder: string
    glob: string
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

export interface GitCmsFile {
    filename: string
    content: string
}

export interface GitCmsGlobResponse extends GitCmsResponse {
    files: GitCmsFile[]
}

export interface GitPullResponse extends GitCmsResponse {
    stdout: string
}
