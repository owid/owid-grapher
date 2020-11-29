import { GitCommit } from "clientUtils/owidTypes"

export interface SerializedGridProgram {
    slug: string
    program: string
    lastCommit?: GitCommit
}
