import { Router, Request, Response } from "express"
import {
    GIT_DEFAULT_USERNAME,
    GIT_DEFAULT_EMAIL,
    ENV,
} from "../settings/clientSettings"
import simpleGit, { SimpleGit } from "simple-git"
import * as fs from "fs-extra"
import {
    GIT_CMS_DIR,
    GIT_CMS_FILE_ROUTE,
    GitCmsResponse,
    GitCmsReadResponse,
    WriteRequest,
    ReadRequest,
    DeleteRequest,
    GIT_CMS_PULL_ROUTE,
    GitPullResponse,
    GlobRequest,
    GIT_CMS_GLOB_ROUTE,
    GitCmsGlobResponse,
} from "./GitCmsConstants"
import * as glob from "glob"

// todo: cleanup typings
interface ResponseWithUserInfo extends Response {
    locals: { user: any; session: any }
}

export class GitCmsServer {
    private git: SimpleGit
    constructor(baseDir: string) {
        this.git = simpleGit({
            baseDir,
            binary: "git",
            maxConcurrentProcesses: 1,
        })
    }

    async saveFileToGitContentDirectory(
        filename: string,
        content: string,
        authorName = GIT_DEFAULT_USERNAME,
        authorEmail = GIT_DEFAULT_EMAIL,
        commitMsg?: string
    ) {
        const path = GIT_CMS_DIR + "/" + filename
        await fs.writeFile(path, content, "utf8")

        commitMsg = commitMsg
            ? commitMsg
            : fs.existsSync(path)
            ? `Updating ${filename}`
            : `Adding ${filename}`

        return this.commitFile(filename, commitMsg, authorName, authorEmail)
    }

    async deleteFileFromGitContentDirectory(
        filename: string,
        authorName = GIT_DEFAULT_USERNAME,
        authorEmail = GIT_DEFAULT_EMAIL
    ) {
        const path = GIT_CMS_DIR + "/" + filename
        await fs.unlink(path)
        return this.commitFile(
            filename,
            `Deleted ${filename}`,
            authorName,
            authorEmail
        )
    }

    async pull() {
        return await this.git.pull()
    }

    private async commitFile(
        filename: string,
        commitMsg: string,
        authorName: string,
        authorEmail: string
    ) {
        await this.git.add(filename)
        return await this.git.commit(commitMsg, filename, {
            "--author": `${authorName} <${authorEmail}>`,
        })
    }

    async autopush() {
        if (await this.shouldAutoPush()) this.git.push()
    }

    private async shouldAutoPush() {
        const branches = await this.git.branchLocal()
        const gitCmsBranchName = await branches.current
        return this.branchesToAutoPush.has(gitCmsBranchName)
    }

    // Push if on owid.cloud or staging. Do not push if on a differen branch (so you can set your local dev branch to something else to not push changes automatically)
    // todo: probably want a better stragegy?
    private branchesToAutoPush = new Set(["master", "staging"])
}

const validateFilePath = (filename: string) => {
    if (filename.includes(".."))
        throw new Error(`Invalid filepath: ${filename}`)
}

export const addGitCmsApiRoutes = (app: Router) => {
    const server = new GitCmsServer(GIT_CMS_DIR)

    // Update/create file, commit, and push(unless on local dev brach)
    app.post(
        GIT_CMS_FILE_ROUTE,
        async (
            req: Request,
            res: ResponseWithUserInfo
        ): Promise<GitCmsResponse> => {
            const request = req.body as WriteRequest
            const { filepath } = request
            try {
                validateFilePath(filepath)
                await server.saveFileToGitContentDirectory(
                    filepath,
                    request.content,
                    res.locals.user.fullName,
                    res.locals.user.email,
                    request.commitMessage
                )

                await server.autopush()
                return { success: true }
            } catch (error) {
                console.log(error)
                return { success: false, error }
            }
        }
    )

    // Pull latest from remote
    app.post(GIT_CMS_PULL_ROUTE, async () => {
        try {
            const res = await server.pull()
            return {
                success: true,
                stdout: JSON.stringify(res.summary, null, 2),
            } as GitPullResponse
        } catch (error) {
            console.log(error)
            return { success: false, error }
        }
    })

    // Get file contents
    app.get(
        GIT_CMS_FILE_ROUTE,
        async (req: Request): Promise<GitCmsReadResponse> => {
            const request = req.query as ReadRequest
            const filepath = `/${request.filepath.replace(/\~/g, "/")}`
            try {
                validateFilePath(filepath)

                const path = GIT_CMS_DIR + filepath
                const exists = fs.existsSync(path)
                if (!exists) throw new Error(`File '${filepath}' not found`)
                const content = await fs.readFile(path, "utf8")
                return { success: true, content }
            } catch (error) {
                console.log(error)
                return {
                    success: false,
                    error,
                    content: "",
                }
            }
        }
    )

    // Get file contents
    app.get(
        GIT_CMS_GLOB_ROUTE,
        async (req: Request): Promise<GitCmsGlobResponse> => {
            const request = req.query as GlobRequest
            const query = request.glob.replace(/[^a-zA-Z\*]/, "")
            const cwd = GIT_CMS_DIR + "/" + request.folder
            const results = glob.sync(query, {
                cwd,
            })

            const files = results.map((filename) => {
                return {
                    filename,
                    content: fs.readFileSync(cwd + "/" + filename, "utf8"),
                }
            })

            return { success: true, files }
        }
    )

    // Delete file, commit, and and push(unless on local dev brach)
    app.delete(
        GIT_CMS_FILE_ROUTE,
        async (
            req: Request,
            res: ResponseWithUserInfo
        ): Promise<GitCmsResponse> => {
            const request = req.query as DeleteRequest
            const filepath = request.filepath.replace(/\~/g, "/")
            try {
                validateFilePath(filepath)
                await server.deleteFileFromGitContentDirectory(
                    filepath,
                    res.locals.user.fullName,
                    res.locals.user.email
                )
                await server.autopush()
                return { success: true }
            } catch (error) {
                console.log(error)
                return { success: false, error }
            }
        }
    )
}
