import {
    lazy,
    omit,
    convertToArchivalDateStringIfNecessary,
} from "@ourworldindata/utils"
import { AssetMap } from "@ourworldindata/types"
import {
    GrapherChecksums,
    GrapherChecksumsObjectWithHash,
    MultiDimChecksums,
    MultiDimChecksumsObjectWithHash,
} from "./archivalChecksum.js"
import { simpleGit } from "simple-git"
import { ARCHIVE_BASE_URL } from "../../settings/serverSettings.js"

export interface GrapherArchivalManifest {
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

export interface MultiDimArchivalManifest {
    assets: {
        static: AssetMap
        runtime: AssetMap
    }
    archivalDate: string
    multiDimId: number
    multiDimSlug: string
    checksums: MultiDimChecksums
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
    chartSlug: string,
    { relative }: { relative: boolean }
) => {
    const formattedDate = convertToArchivalDateStringIfNecessary(archivalDate)

    const path = `/${formattedDate}/grapher/${chartSlug}.html`
    if (relative) return path
    else {
        if (!ARCHIVE_BASE_URL) {
            throw new Error("ARCHIVE_BASE_URL is not defined")
        }
        return `${ARCHIVE_BASE_URL}${path}`
    }
}

export const assembleGrapherManifest = async (manifestInfo: {
    staticAssetMap: AssetMap
    runtimeAssetMap: AssetMap
    checksumsObj: GrapherChecksumsObjectWithHash
    archivalDate: string
    chartConfigId: string
}): Promise<GrapherArchivalManifest> => {
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

export const assembleMultiDimArchivalUrl = (
    archivalDate: Parameters<typeof convertToArchivalDateStringIfNecessary>[0],
    slug: string,
    { relative }: { relative: boolean }
) => {
    const formattedDate = convertToArchivalDateStringIfNecessary(archivalDate)

    const path = `/${formattedDate}/grapher/${slug}.html`
    if (relative) return path
    else {
        if (!ARCHIVE_BASE_URL) {
            throw new Error("ARCHIVE_BASE_URL is not defined")
        }
        return `${ARCHIVE_BASE_URL}${path}`
    }
}

export const assembleMultiDimManifest = async (manifestInfo: {
    staticAssetMap: AssetMap
    runtimeAssetMap: AssetMap
    checksumsObj: MultiDimChecksumsObjectWithHash
    archivalDate: string
}): Promise<MultiDimArchivalManifest> => {
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
