import { FunctionalRouter } from "adminSite/server/utils/FunctionalRouter"
import { Request, Response } from "adminSite/server/utils/authentication"
import { GIT_DEFAULT_USERNAME, GIT_DEFAULT_EMAIL, ENV } from "settings"
import simpleGit, { SimpleGit } from "simple-git"
import * as fs from "fs-extra"
import {
    GIT_CMS_DIR,
    GIT_CMS_ROUTE,
    GitCmsResponse,
    GitCmsReadResponse,
    WriteRequest,
    ReadRequest,
    DeleteRequest,
    GIT_CMS_PULL_ROUTE,
    GitPullResponse,
} from "./GitCmsConstants"
const IS_PROD = ENV === "production"

const isFolderOnStagingBranch = async (git: SimpleGit) => {
    const branches = await git.branchLocal()
    const gitCmsBranchName = await branches.current
    return gitCmsBranchName === "staging"
}

// Push if on owid.cloud or staging. Do not push if on a differen branch (so you can set your local dev branch to something else to not push changes automatically)
const shouldPush = async (git: SimpleGit) =>
    IS_PROD ? true : await isFolderOnStagingBranch(git)

const saveFileToGitContentDirectory = async (
    git: SimpleGit,
    filename: string,
    content: string,
    authorName = GIT_DEFAULT_USERNAME,
    authorEmail = GIT_DEFAULT_EMAIL,
    commitMsg?: string
) => {
    const path = GIT_CMS_DIR + "/" + filename
    await fs.writeFile(path, content, "utf8")

    commitMsg = commitMsg
        ? commitMsg
        : fs.existsSync(path)
        ? `Updating ${filename}`
        : `Adding ${filename}`

    return commitFile(git, filename, commitMsg, authorName, authorEmail)
}

const commitFile = async (
    git: SimpleGit,
    filename: string,
    commitMsg: string,
    authorName: string,
    authorEmail: string
) => {
    await git.add(filename)
    return await git.commit(commitMsg, filename, {
        "--author": `${authorName} <${authorEmail}>`,
    })
}

const deleteFileFromGitContentDirectory = async (
    git: SimpleGit,
    filename: string,
    authorName = GIT_DEFAULT_USERNAME,
    authorEmail = GIT_DEFAULT_EMAIL
) => {
    const path = GIT_CMS_DIR + "/" + filename
    await fs.unlink(path)
    return commitFile(
        git,
        filename,
        `Deleted ${filename}`,
        authorName,
        authorEmail
    )
}

export const addGitCmsApiRoutes = (app: FunctionalRouter) => {
    const git = simpleGit({
        baseDir: GIT_CMS_DIR,
        binary: "git",
        maxConcurrentProcesses: 1,
    })

    // Update/create file, commit, and push(unless on local dev brach)
    app.post(
        GIT_CMS_ROUTE,
        async (req: Request, res: Response): Promise<GitCmsResponse> => {
            const request = req.body as WriteRequest
            const filename = request.filepath
            if (filename.includes(".."))
                return {
                    success: false,
                    errorMessage: `Invalid filepath: ${filename}`,
                }
            try {
                await saveFileToGitContentDirectory(
                    git,
                    filename,
                    request.content,
                    res.locals.user.fullName,
                    res.locals.user.email,
                    request.commitMessage
                )

                if (await shouldPush(git)) await git.push()
                return { success: true }
            } catch (err) {
                console.log(err)
                return { success: false, errorMessage: err }
            }
        }
    )

    // Pull latest from remote
    app.post(GIT_CMS_PULL_ROUTE, async () => {
        try {
            const res = await git.pull()
            return {
                success: true,
                stdout: JSON.stringify(res.summary, null, 2),
            } as GitPullResponse
        } catch (err) {
            console.log(err)
            return { success: false, errorMessage: err }
        }
    })

    // Get file contents
    app.get(
        GIT_CMS_ROUTE,
        async (req: Request): Promise<GitCmsReadResponse> => {
            const request = req.query as ReadRequest
            const filepath = `/${request.filepath.replace(/\~/g, "/")}`
            if (filepath.includes(".."))
                return {
                    success: false,
                    errorMessage: `Invalid filepath: ${filepath}`,
                    content: "",
                }
            const path = GIT_CMS_DIR + filepath
            const exists = fs.existsSync(path)
            if (!exists)
                return {
                    success: false,
                    errorMessage: `File '${filepath}' not found`,
                    content: "",
                }
            const content = await fs.readFile(path, "utf8")
            return { success: true, content }
        }
    )

    // Delete file, commit, and and push(unless on local dev brach)
    app.delete(
        GIT_CMS_ROUTE,
        async (req: Request, res: Response): Promise<GitCmsResponse> => {
            const request = req.query as DeleteRequest
            const filepath = request.filepath.replace(/\~/g, "/")
            if (filepath.includes(".."))
                return {
                    success: false,
                    errorMessage: `Invalid filepath: ${filepath}`,
                }
            try {
                await deleteFileFromGitContentDirectory(
                    git,
                    filepath,
                    res.locals.user.fullName,
                    res.locals.user.email
                )
                if (await shouldPush(git)) await git.push()
                return { success: true }
            } catch (err) {
                console.log(err)
                return { success: false, errorMessage: err }
            }
        }
    )
}
