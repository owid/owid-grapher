// At the moment, this code is _only_ used in the Webpack build, to provide clientSettings
// (from clientSettings.json) to the code bundle at compile time

import fs from "fs-extra"
import path from "path"

export const readClientSettings = async (baseDir: string) => {
    const absoluteSettingsPath = path.resolve(baseDir, "clientSettings.json")

    if (await fs.pathExists(absoluteSettingsPath))
        return await fs.readJson(absoluteSettingsPath)
    return {}
}
