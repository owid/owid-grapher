import { GitCommit } from "gitCms/GitTypes"

export interface SerializedGridProgram {
    slug: string
    program: string
    lastCommit?: GitCommit
}
