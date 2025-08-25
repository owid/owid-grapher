import { execSync } from "child_process"
import * as fs from "fs-extra"
import * as path from "path"
import { stringify as yamlStringify } from "yaml"

interface PrComment {
    created_at: string
    diff_hunk: string | null
    line: number | null
    start_line: number | null
    body: string
}

async function getCurrentBranchPrNumber(): Promise<number> {
    try {
        const output = execSync("gh pr view --json number --jq '.number'", {
            encoding: "utf8",
            stdio: "pipe",
        })
        return parseInt(output.trim(), 10)
    } catch {
        throw new Error(
            "No PR found for current branch. Make sure you're on a branch with an open PR."
        )
    }
}

async function fetchPrComments(prNumber: number): Promise<PrComment[]> {
    try {
        const output = execSync(
            `gh api repos/:owner/:repo/pulls/${prNumber}/comments`,
            {
                encoding: "utf8",
                stdio: "pipe",
            }
        )

        const allComments = JSON.parse(output)

        // Filter to only user comments and extract the required fields
        const userComments: PrComment[] = allComments
            .filter((comment: any) => comment.user.type === "User")
            .map((comment: any) => ({
                body: comment.body,
                user: comment.user.login,
                path: comment.path,
                created_at: comment.created_at,
                diff_hunk: comment.diff_hunk,
                line: comment.line,
                start_line: comment.start_line,
            }))

        return userComments
    } catch (error) {
        throw new Error(`Failed to fetch PR comments: ${error}`)
    }
}

async function createPrFeedbackDirectory(): Promise<string> {
    const feedbackDir = path.join(process.cwd(), "pr-feedback")

    // Remove existing directory if it exists
    if (await fs.pathExists(feedbackDir)) {
        await fs.remove(feedbackDir)
    }

    // Create fresh directory
    await fs.ensureDir(feedbackDir)

    return feedbackDir
}

async function writeCommentFiles(
    comments: PrComment[],
    feedbackDir: string
): Promise<string[]> {
    const filenames: string[] = []

    for (let i = 0; i < comments.length; i++) {
        const filename = `comment-${i + 1}.yml`
        const filepath = path.join(feedbackDir, filename)

        // Create YAML with proper formatting similar to yq output
        const yamlContent = yamlStringify(comments[i], {
            defaultStringType: "PLAIN",
            defaultKeyType: null,
            blockQuote: "literal",
            lineWidth: 0,
        })

        await fs.writeFile(filepath, yamlContent)
        filenames.push(filename)
    }

    return filenames
}

async function createReadmeWithTaskList(
    filenames: string[],
    feedbackDir: string
): Promise<void> {
    const readmePath = path.join(feedbackDir, "README.md")

    let content = "# PR Feedback Tasks\n\n"
    content +=
        "This directory contains individual PR comments that need to be addressed.\n\n"
    content += "## Task List\n\n"

    for (const filename of filenames) {
        content += `- [ ] Review and address feedback in \`${filename}\`\n`
    }

    if (filenames.length === 0) {
        content += "No PR comments found.\n"
    }

    await fs.writeFile(readmePath, content)
}

async function main(): Promise<void> {
    try {
        console.log("==> Getting PR comments for current branch")

        const prNumber = await getCurrentBranchPrNumber()
        console.log(`Found PR #${prNumber}`)

        const comments = await fetchPrComments(prNumber)
        console.log(`Found ${comments.length} user comments`)

        const feedbackDir = await createPrFeedbackDirectory()
        console.log(`Created feedback directory: ${feedbackDir}`)

        const filenames = await writeCommentFiles(comments, feedbackDir)
        console.log(`Created ${filenames.length} comment files`)

        await createReadmeWithTaskList(filenames, feedbackDir)
        console.log("Created README.md with task list")

        console.log(
            "\nPR feedback has been organized in the pr-feedback/ directory"
        )
    } catch (error) {
        console.error(
            "ERROR:",
            error instanceof Error ? error.message : String(error)
        )
        process.exit(1)
    }
}

if (require.main === module) {
    await main()
}
