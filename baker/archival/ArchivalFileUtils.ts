import fs from "fs-extra"
import path from "path"
import { hashBase36, hashBase36FromStream } from "../../serverUtils/hash.js"

const hashFile = async (file: string) => {
    const stream = await fs.createReadStream(file)
    return await hashBase36FromStream(stream)
}

export const hashAndWriteFile = async (
    filename: string,
    content: string,
    archiveDir: string
) => {
    const hash = hashBase36(content)
    const targetFilename = filename.replace(/^(.*\/)?([^.]+\.)/, `$1$2${hash}.`)
    console.log(`Writing ${targetFilename}`)
    const fullTargetFilename = path.resolve(archiveDir, targetFilename)
    await fs.mkdirp(path.dirname(fullTargetFilename))
    await fs.writeFile(fullTargetFilename, content)
    return path.relative(archiveDir, fullTargetFilename)
}

export const hashAndCopyFile = async (
    srcFile: string,
    targetDir: string,
    archiveDir: string
) => {
    const hash = await hashFile(srcFile)
    const targetFilename = path
        .basename(srcFile)
        .replace(/^(.*\/)?([^.]+\.)/, `$1$2${hash}.`)
    const targetFile = path.resolve(archiveDir, targetDir, targetFilename)
    console.log(`Copying ${srcFile} to ${targetFile}`)
    await fs.copyFile(srcFile, targetFile)
    return path.relative(archiveDir, targetFile)
}
