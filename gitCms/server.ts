import { FunctionalRouter } from "admin/server/FunctionalRouter"
import { Request, Response } from "admin/server/authentication"
import { GIT_DEFAULT_USERNAME, GIT_DEFAULT_EMAIL } from "settings"
import * as fs from "fs-extra"
import { execFormatted } from "utils/server/serverUtil"
import {
    GIT_CMS_DIR,
    gitCmsRoute,
    GitCmsResponse,
    GitCmsReadResponse,
    WriteRequest,
    ReadRequest,
    DeleteRequest
} from "./constants"

async function saveFileToGitContentDirectory(
    filename: string,
    content: string,
    commitName: string,
    commitEmail: string
) {
    const path = GIT_CMS_DIR + "/" + filename
    await fs.writeFile(path, content, "utf8")

    const commitMsg = fs.existsSync(path)
        ? `Adding ${filename}`
        : `Updating ${filename}`

    await execFormatted(
        `cd %s && git add ${filename} && git commit -m %s --quiet --author="${commitName ||
            GIT_DEFAULT_USERNAME} <${commitEmail ||
            GIT_DEFAULT_EMAIL}>" && git push`,
        [GIT_CMS_DIR, commitMsg]
    )
    return ""
}

async function deleteFileFromGitContentDirectory(
    filename: string,
    commitName: string,
    commitEmail: string
) {
    const path = GIT_CMS_DIR + "/" + filename
    await fs.unlink(path)
    await execFormatted(
        `cd %s && git add ${filename} && git commit -m %s --quiet --author="${commitName ||
            GIT_DEFAULT_USERNAME} <${commitEmail ||
            GIT_DEFAULT_EMAIL}>" && git push`,
        [GIT_CMS_DIR, `Deleted ${filename}`]
    )
    return ""
}

export const addGitCmsApiRoutes = (app: FunctionalRouter) => {
    app.post(
        gitCmsRoute,
        async (req: Request, res: Response): Promise<GitCmsResponse> => {
            const request = req.body as WriteRequest
            const filename = request.filepath
            if (filename.includes(".."))
                return {
                    success: false,
                    errorMessage: `Invalid filepath: ${filename}`
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

    app.get(
        gitCmsRoute,
        async (req: Request, res: Response): Promise<GitCmsReadResponse> => {
            const request = req.query as ReadRequest
            const filepath = `/${request.filepath.replace(/\~/g, "/")}`
            if (filepath.includes(".."))
                return {
                    success: false,
                    errorMessage: `Invalid filepath: ${filepath}`,
                    content: ""
                }
            const content = await fs.readFile(GIT_CMS_DIR + filepath, "utf8")
            return { success: true, content }
        }
    )

    app.delete(
        gitCmsRoute,
        async (req: Request, res: Response): Promise<GitCmsResponse> => {
            const request = req.query as DeleteRequest
            const filepath = request.filepath.replace(/\~/g, "/")
            if (filepath.includes(".."))
                return {
                    success: false,
                    errorMessage: `Invalid filepath: ${filepath}`
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
