import * as fs from "fs-extra"
import { logErrorAndMaybeSendToSlack } from "../serverUtils/slackLog.js"
import { GIT_CMS_DIR } from "../gitCms/GitCmsConstants.js"

export const getDatapageJson = async (variableId: number) => {
    try {
        const fullPath = `${GIT_CMS_DIR}/datapages/${variableId}.json`
        const datapageJsonFile = await fs.readFile(fullPath, "utf8")
        return JSON.parse(datapageJsonFile)
    } catch (err: any) {
        // Do not throw an error if the datapage JSON does not exist, but rather
        // if it does and it fails to parse or render.
        if (err.code !== "ENOENT") {
            logErrorAndMaybeSendToSlack(err)
        }
    }
}
