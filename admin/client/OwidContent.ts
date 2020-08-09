const validateFilePath = (path: string) => {
    if (path.includes("~")) throw new Error(`Filenames with ~ not supported`)
}

const owidContentPath = "/admin/api/owid-content"

export const deleteRemoteFile = async (filepath: string) => {
    validateFilePath(filepath)
    filepath = filepath.replace(/\//g, "~")
    await fetch(`${owidContentPath}?path=${filepath}`, {
        method: "DELETE"
    })
}
export const readRemoteFile = async (filepath: string) => {
    validateFilePath(filepath)
    filepath = filepath.replace(/\//g, "~")
    const response = await fetch(`${owidContentPath}?path=${filepath}`)
    const file = await response.json()
    return file.content
}

export const writeRemoteFile = async (filename: string, content: string) => {
    validateFilePath(filename)
    const response = await fetch(owidContentPath, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            filename,
            content
        })
    })

    const result = await response.json()
    return result
}
