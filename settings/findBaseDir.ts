import path from "path"
import fs from "fs"

/**
 * With our code residing either in some src folder or in the `itsJustJavascript` folder, it's not
 * always straightforward to know where to find a config file like `.env`.
 * Here, we just traverse the directory tree upwards until we find a `package.json` file, which
 * should indicate that we have found the root directory of the `owid-grapher` repo.
 */
export default function findProjectBaseDir(from: string) {
    if (!fs.existsSync) return undefined // if fs.existsSync doesn't exist, we're probably running in the browser

    let dir = path.dirname(from)

    while (dir.length) {
        if (fs.existsSync(path.resolve(dir, "package.json"))) return dir

        const parentDir = path.resolve(dir, "..")
        // break if we have reached the file system root
        if (parentDir === dir) break
        else dir = parentDir
    }

    return undefined
}
