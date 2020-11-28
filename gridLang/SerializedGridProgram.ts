import { GitCommit } from "./GridImports"

export interface SerializedGridProgram {
    slug: string
    program: string
    lastCommit?: GitCommit
}
