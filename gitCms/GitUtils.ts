import { execFormatted } from "utils/server/serverUtil"

export const getGitBranchNameForDir = async (dir: string) => {
    const result = await execFormatted(
        `cd %s && git rev-parse --abbrev-ref HEAD`,
        [dir],
        false
    )
    return result.stdout.trim()
}

export const getLastModifiedTime = async (dir: string, filename: string) => {
    const result = await execFormatted(
        `cd %s && git log -1 --format=%s %s`,
        [dir, `%cd`, filename],
        false
    )
    return result.stdout.trim()
}

export const pullFromGit = async (dir: string) =>
    await execFormatted(`cd %s && git pull`, [dir], false)

export const pullAndRebaseFromGit = async (dir: string) =>
    await execFormatted(`cd %s && git pull --rebase`, [dir], false)

export const gitUserInfo = async (dir: string) => {
    const email = await execFormatted(
        "cd %s && git config user.email",
        [dir],
        false
    )
    const name = await execFormatted(
        "cd %s && git config user.name",
        [dir],
        false
    )
    const head = await execFormatted(
        "cd %s && git rev-parse HEAD",
        [dir],
        false
    )
    return {
        email: email.stdout.trim(),
        name: name.stdout.trim(),
        head: head.stdout.trim(),
    }
}
