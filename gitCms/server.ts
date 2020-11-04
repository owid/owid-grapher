import { FunctionalRouter } from "adminSite/server/utils/FunctionalRouter"
import { Request, Response } from "adminSite/server/utils/authentication"
import { GIT_DEFAULT_USERNAME, GIT_DEFAULT_EMAIL, ENV } from "settings"
import * as fs from "fs-extra"
import { execFormatted } from "utils/server/serverUtil"
import {
    GIT_CMS_DIR,
    GIT_CMS_ROUTE,
    GitCmsResponse,
    GitCmsReadResponse,
    WriteRequest,
    ReadRequest,
    DeleteRequest,
    GIT_PULL_ROUTE,
    GitPullResponse,
} from "./constants"
const IS_PROD = ENV === "production"

const isFolderOnStagingBranch = async (dir: string) => {
    const result = await execFormatted(
        `cd %s && git rev-parse --abbrev-ref HEAD`,
        [dir]
    )
    return result.stdout.trim() === "staging"
}

async function saveFileToGitContentDirectory(
    filename: string,
    content: string,
    commitName: string,
    commitEmail: string
) {
    const path = GIT_CMS_DIR + "/" + filename
    await fs.writeFile(path, content, "utf8")

    // Push if on owid.cloud, or if on a development branch
    const shouldPush = IS_PROD
        ? true
        : await isFolderOnStagingBranch(GIT_CMS_DIR)

    const commitMsg = fs.existsSync(path)
        ? `Updating ${filename}`
        : `Adding ${filename}`
    const pushCommand = shouldPush ? `&& git push` : ""

    await execFormatted(
        `cd %s && git add ${filename} && git commit -m %s --quiet --author="${
            commitName || GIT_DEFAULT_USERNAME
        } <${commitEmail || GIT_DEFAULT_EMAIL}>" ${pushCommand}`,
        [GIT_CMS_DIR, commitMsg]
    )
    return ""
}

const pullFromGit = async () =>
    await execFormatted(`cd %s && git pull`, [GIT_CMS_DIR])

async function deleteFileFromGitContentDirectory(
    filename: string,
    commitName: string,
    commitEmail: string,
    shouldPush = IS_PROD
) {
    const path = GIT_CMS_DIR + "/" + filename
    const pushCommand = shouldPush ? `&& git push` : ""
    await fs.unlink(path)
    await execFormatted(
        `cd %s && git add ${filename} && git commit -m %s --quiet --author="${
            commitName || GIT_DEFAULT_USERNAME
        } <${commitEmail || GIT_DEFAULT_EMAIL}>" ${pushCommand}`,
        [GIT_CMS_DIR, `Deleted ${filename}`]
    )
    return ""
}

export const addGitCmsApiRoutes = (app: FunctionalRouter) => {
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
            const errorMessage = await saveFileToGitContentDirectory(
                filename,
                request.content,
                res.locals.user.fullName,
                res.locals.user.email
            )
            return { success: errorMessage ? false : true }
        }
    )

    app.post(GIT_PULL_ROUTE, async (req: Request, res: Response) => {
        const result = await pullFromGit()
        return {
            success: result.stderr ? false : true,
            stdout: result.stdout,
            errorMessage: result.stderr,
        } as GitPullResponse
    })

    app.get(
        GIT_CMS_ROUTE,
        async (req: Request, res: Response): Promise<GitCmsReadResponse> => {
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
            const errorMessage = await deleteFileFromGitContentDirectory(
                filepath,
                res.locals.user.fullName,
                res.locals.user.email
            )
            return { success: errorMessage ? false : true }
        }
    )
}
