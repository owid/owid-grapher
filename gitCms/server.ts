import { FunctionalRouter } from "adminSite/server/utils/FunctionalRouter"
import { Request, Response } from "adminSite/server/utils/authentication"
import { GIT_DEFAULT_USERNAME, GIT_DEFAULT_EMAIL, ENV } from "settings"
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
const IS_PROD = ENV === "production"

async function saveFileToGitContentDirectory(
    filename: string,
    content: string,
    commitName: string,
    commitEmail: string,
    shouldPush = IS_PROD
) {
    const path = GIT_CMS_DIR + "/" + filename
    await fs.writeFile(path, content, "utf8")

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
