import { DeployStatus } from "clientUtils/owidTypes"

export interface DeployChange {
    timeISOString?: string
    authorName?: string
    authorEmail?: string
    message?: string
}

export interface Deploy {
    status: DeployStatus
    changes: DeployChange[]
}
