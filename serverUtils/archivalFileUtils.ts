import fs from "fs-extra"
import path from "path"
import { hashBase36, hashBase36FromStream } from "./hash.js"

const hashFile = async (file: string) => {
    const stream = await fs.createReadStream(file)
    return await hashBase36FromStream(stream)
}

export const hashAndWriteFile = async (targetPath: string, content: string) => {
    const hash = hashBase36(content)
    const targetPathWithHash = targetPath.replace(
        /^(.*\/)?([^.]+\.)/,
        `$1$2${hash}.`
    )

    console.log(`Writing ${targetPathWithHash}`)
    await fs.mkdirp(path.dirname(targetPathWithHash))
    await fs.writeFile(targetPathWithHash, content)
    return targetPathWithHash
}

export const hashAndCopyFile = async (srcFile: string, targetDir: string) => {
    const hash = await hashFile(srcFile)
    const targetFilename = path
        .basename(srcFile)
        .replace(/^(.*\/)?([^.]+\.)/, `$1$2${hash}.`)
    const targetFile = path.resolve(targetDir, targetFilename)

    console.log(`Copying ${srcFile} to ${targetFile}`)
    await fs.copyFile(srcFile, targetFile)
    return targetFile
}
