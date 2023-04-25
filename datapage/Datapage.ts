import * as fs from "fs-extra"
import { GIT_CMS_DIR } from "../gitCms/GitCmsConstants.js"
import { Static, Type } from "@sinclair/typebox"
import { Value } from "@sinclair/typebox/value"
import { gdocUrlRegex } from "@ourworldindata/utils"

// This gives us an typed object we can use to validate datapage JSON files at runtime (see
// Value.Check() and Value.Errors() below), as well as a type that we can use
// for typechecking at compile time (see "type DataPage" below).
const DataPage = Type.Object(
    {
        showDataPageOnChartIds: Type.Array(Type.Number()),
        status: Type.Union([Type.Literal("published"), Type.Literal("draft")]),
        title: Type.String(),
        googleDocEditLink: Type.RegEx(gdocUrlRegex),
        topicTagsLinks: Type.Array(
            Type.Object({ title: Type.String(), url: Type.String() })
        ),
        variantDescription1: Type.String(),
        variantDescription2: Type.String(),
        nameOfSource: Type.String(),
        owidProcessingLevel: Type.String(),
        dateRange: Type.String(),
        lastUpdated: Type.String(),
        nextUpdate: Type.String(),
        subtitle: Type.String(),
        descriptionFromSource: Type.Object({
            title: Type.String(),
        }),
        relatedResearch: Type.Array(
            Type.Object({
                title: Type.String(),
                url: Type.String(),
                authors: Type.Array(Type.String()),
                imageUrl: Type.String(),
            })
        ),
        relatedData: Type.Array(
            Type.Object({
                type: Type.Optional(Type.String()),
                imageUrl: Type.Optional(Type.String()),
                title: Type.String(),
                source: Type.String(),
                url: Type.String(),
                content: Type.Optional(Type.String()),
            })
        ),
        relatedCharts: Type.Object({
            items: Type.Array(
                Type.Object({
                    title: Type.String(),
                    slug: Type.String(),
                })
            ),
        }),
        datasetName: Type.String(),
        datasetFeaturedVariables: Type.Array(
            Type.Object({
                variableName: Type.String(),
                variableSubtitle: Type.Optional(Type.String()),
            })
        ),
        datasetCodeUrl: Type.String(),
        datasetLicenseLink: Type.Object({
            title: Type.String(),
            url: Type.String(),
        }),
        sources: Type.Array(
            Type.Object({
                sourceName: Type.String(),
                sourceRetrievedOn: Type.Optional(Type.String()),
                sourceRetrievedFromUrl: Type.Optional(Type.String()),
                sourceCodeUrl: Type.Optional(Type.String()),
            })
        ),
    },
    // see rationale for this property in GrapherBaker >
    // renderDataPageOrGrapherPage()
    { additionalProperties: false }
)

type DataPage = Static<typeof DataPage>

export const getDatapageJson = async (
    variableId: number
): Promise<{
    datapageJson: DataPage | null
    parseErrors: { message: string; path?: string }[]
}> => {
    let datapageJson: DataPage | null = null
    try {
        const fullPath = `${GIT_CMS_DIR}/datapages/${variableId}.json`
        const datapageJsonFile = await fs.readFile(fullPath, "utf8")
        datapageJson = JSON.parse(datapageJsonFile)
    } catch (err: any) {
        // An error has been thrown either because:
        // - the file doesn't exist: it simply means we don't have a datapage
        //   yet, and we just render a regular grapher page instead by returning
        //   neither a datapage, nor parsing errors
        // - the file exists but fails to parse because it contains invalid
        //   JSON. In this case, we return parsing errors.
        if (err.code === "ENOENT") {
            return {
                datapageJson: null,
                parseErrors: [],
            }
        } else {
            return {
                datapageJson: null,
                parseErrors: [
                    {
                        message: err.message,
                    },
                ],
            }
        }
    }

    if (Value.Check(DataPage, datapageJson)) {
        return { datapageJson, parseErrors: [] }
    } else {
        return {
            datapageJson,
            parseErrors: [...Value.Errors(DataPage, datapageJson)].map(
                ({ message, path }) => ({ message, path })
            ),
        }
    }
}
