import {
    lazy,
    omit,
    convertToArchivalDateStringIfNecessary,
} from "@ourworldindata/utils"
import { AssetMap } from "@ourworldindata/types"
import {
    GrapherChecksums,
    GrapherChecksumsObjectWithHash,
} from "./archivalChecksum.js"
import { simpleGit } from "simple-git"

export interface ArchivalManifest {
    assets: {
        static: AssetMap
        runtime: AssetMap
    }
    archivalDate: string
    chartId: number
    chartConfigId: string
    chartSlug: string
    checksums: GrapherChecksums
    checksumsHashed: string
    commitShas: {
        "owid-grapher"?: string
    }
}

const getOwidGrapherCommitSha = lazy(async () => {
    try {
        return await simpleGit().revparse(["HEAD"])
    } catch {
        return undefined
    }
})

export const assembleGrapherArchivalUrl = (
    archivalDate: Parameters<typeof convertToArchivalDateStringIfNecessary>[0],
    chartSlug: string
) => {
    const formattedDate = convertToArchivalDateStringIfNecessary(archivalDate)

    return `/${formattedDate}/grapher/${chartSlug}.html`
}

export const assembleManifest = async (manifestInfo: {
    staticAssetMap: AssetMap
    runtimeAssetMap: AssetMap
    checksumsObj: GrapherChecksumsObjectWithHash
    archivalDate: string
    chartConfigId: string
}): Promise<ArchivalManifest> => {
    const commitShas = { "owid-grapher": await getOwidGrapherCommitSha() }

    const manifest = {
        ...omit(manifestInfo, [
            "staticAssetMap",
            "runtimeAssetMap",
            "checksumsObj",
        ]),
        ...manifestInfo.checksumsObj,
        assets: {
            static: manifestInfo.staticAssetMap,
            runtime: manifestInfo.runtimeAssetMap,
        },
        commitShas,
    }

    return manifest
}
