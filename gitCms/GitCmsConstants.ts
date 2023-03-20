export const GIT_CMS_DEFAULT_BRANCH = "master"
export const GIT_CMS_READ_ROUTE = "/git-cms-read"
export const GIT_CMS_WRITE_ROUTE = "/git-cms-write"
export const GIT_CMS_DELETE_ROUTE = "/git-cms-delete"
export const GIT_CMS_PULL_ROUTE = "/git-cms-pull"
export const GIT_CMS_GLOB_ROUTE = "/git-cms-glob"

// todo: refactor GitCmsServer to be a class, and pass this in as a top level param
export const GIT_CMS_DIR =
    typeof __dirname !== "undefined" ? __dirname + "/../../../owid-content" : ""
export const GIT_CMS_REPO_URL = `https://github.com/owid/owid-content`
export const GIT_CMS_BASE_ROUTE = "/admin/"

export interface GitCmsFile {
    filename: string
    content: string
}

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
    error?: any
}

export interface GitCmsReadResponse extends GitCmsResponse {
    content: string
}

export interface GitCmsGlobResponse extends GitCmsResponse {
    files: GitCmsFile[]
}

export interface GitPullResponse extends GitCmsResponse {
    stdout?: string
}
