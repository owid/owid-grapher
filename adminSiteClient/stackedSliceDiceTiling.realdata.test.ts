import { describe, it, expect, beforeAll } from "vitest"
import * as d3 from "d3"
import * as R from "remeda"
import { fetchJson } from "@ourworldindata/utils"
import { stackedSliceDiceTiling } from "./stackedSliceDiceTiling.js"
import { CausesOfDeathMetadata } from "./CausesOfDeathMetadata.js"
import {
    DataJson,
    DataRow,
    EnrichedDataItem,
    MetadataJson,
} from "./CausesOfDeathConstants.js"

const BASE_URL =
    "https://owid-public.owid.io/sophia-bespoke-data-viz-demo-11-2025"
const METADATA_PATH = BASE_URL + "/causes-of-death.metadata.json"
const DATA_PATH = BASE_URL + "/causes-of-death.{entityId}.data.json"

describe("stackedSliceDiceTiling with real Causes of Death data", () => {
    let metadata: CausesOfDeathMetadata
    let allEntityData: Map<string, DataRow[]>

    beforeAll(async () => {
        // Fetch metadata
        const metadataJson = await fetchJson<MetadataJson>(METADATA_PATH)
        metadata = new CausesOfDeathMetadata(metadataJson)

        // Fetch data for all entities
        allEntityData = new Map()
        const entities = metadata.availableEntities

        for (const entity of entities) {
            const entityId = metadata.entityNameToId.get(entity.name)
            if (!entityId) continue

            const dataPath = DATA_PATH.replace(
                "{entityId}",
                entityId.toString()
            )
            const dataJson = await fetchJson<DataJson>(dataPath)

            const parsedData = parseEntityData({
                entityName: entity.name,
                entityData: dataJson,
                metadata,
            })
            allEntityData.set(entity.name, parsedData)
        }
    })

    // Test all combinations of entities, age groups, and sexes
    const entityNames = [
        "World",
        "United States",
        "China",
        "France",
        "South Africa",
        "Papua New Guinea",
        "Central African Republic",
    ]
    const ageGroups = [
        "All ages",
        "Children under 5",
        "Children aged 5 to 14",
        "Adults aged 15 to 49",
        "Adults aged 50 to 69",
        "Adults aged 70+",
    ]
    const sexes = ["Both sexes", "Female", "Male"]
    const years = [1980, 2021]

    entityNames.forEach((entityName) => {
        describe(`Entity: ${entityName}`, () => {
            years.forEach((year) => {
                describe(`Year: ${year}`, () => {
                    ageGroups.forEach((ageGroup) => {
                        describe(`Age Group: ${ageGroup}`, () => {
                            sexes.forEach((sex) => {
                                it(`should maintain proportional areas for ${sex}`, () => {
                                    const entityData =
                                        allEntityData.get(entityName)
                                    if (!entityData) {
                                        throw new Error(
                                            `No data found for entity: ${entityName}`
                                        )
                                    }

                                    testTreemapProportionality({
                                        entityName,
                                        year,
                                        ageGroup,
                                        sex,
                                        entityData,
                                        metadata,
                                    })
                                })
                            })
                        })
                    })
                })
            })
        })
    })
})

/**
 * Parse entity data (same logic as in CausesOfDeathDataFetching.ts)
 */
function parseEntityData({
    entityData,
    entityName,
    metadata,
}: {
    entityName: string
    entityData: DataJson
    metadata: CausesOfDeathMetadata
}): DataRow[] {
    return entityData.values
        .map((value, index) => {
            const variableId = entityData.variables[index]
            const year = entityData.years[index]
            const ageGroupId = entityData.ageGroups[index]
            const sexId = entityData.sexes[index]

            const ageGroupMetadata = metadata.ageGroupById.get(ageGroupId)
            if (!ageGroupMetadata) {
                console.warn(`Unknown age group ID: ${ageGroupId}`)
                return null
            }

            const sexMetadata = metadata.sexById.get(sexId)
            if (!sexMetadata) {
                console.warn(`Unknown sex ID: ${sexId}`)
                return null
            }

            const variableMetadata = metadata.variableById.get(variableId)
            if (!variableMetadata) {
                console.warn(`Unknown variable ID: ${variableId}`)
                return null
            }

            const categoryId = variableMetadata.category
            const categoryMetadata = metadata.categoryById.get(categoryId)
            if (!categoryMetadata) {
                console.warn(`Unknown category ID: ${categoryId}`)
                return null
            }

            return {
                entityName,
                year,
                variable: variableMetadata.name,
                description: variableMetadata.description,
                ageGroup: ageGroupMetadata.name,
                sex: sexMetadata.name,
                category: categoryMetadata.name,
                value,
            }
        })
        .filter((item) => item !== null)
}

/**
 * Test that the treemap maintains proportional areas for a given set of parameters
 */
function testTreemapProportionality({
    entityName,
    year,
    ageGroup,
    sex,
    entityData,
    metadata,
}: {
    entityName: string
    year: number
    ageGroup: string
    sex: string
    entityData: DataRow[]
    metadata: CausesOfDeathMetadata
}): void {
    // Filter data for specific year, age group, and sex
    const filteredData = entityData.filter(
        (row) =>
            row.year === year && row.ageGroup === ageGroup && row.sex === sex
    )

    expect(filteredData.length).toBeGreaterThan(0)

    // Calculate total deaths
    const numAllDeaths = d3.sum(filteredData, (d) => d.value) || 0
    expect(numAllDeaths).toBeGreaterThan(0)

    // Build enriched data structure (same as in CausesOfDeathTreemap.tsx)
    const enrichedData: EnrichedDataItem[] = [
        // Root node
        { entityName, year, variable: "All" },

        // Category nodes
        ...metadata.categoriesForAgeGroup(ageGroup).map((category) => ({
            entityName,
            year,
            variable: category.name,
            parentId: "All",
        })),

        // Data nodes
        ...filteredData.map((row) => ({
            ...row,
            share: row.value / numAllDeaths,
            category: row.category,
            parentId: row.category,
        })),
    ]

    // Create hierarchy
    const stratify = d3
        .stratify<EnrichedDataItem>()
        .id((d) => d.variable)
        .parentId((d) => d.parentId)

    const treeData = stratify(enrichedData)

    const hierarchy = d3
        .hierarchy(treeData)
        .sum((d) => d.data.value || 0)
        .sort((a, b) => (b.value || 0) - (a.value || 0))

    // Apply stacked slice-dice tiling
    const width = 900
    const height = 600
    const tilingMethod = stackedSliceDiceTiling<
        d3.HierarchyNode<EnrichedDataItem>
    >({
        minColumnWidth: 100,
        minRowHeight: 30,
    })

    const treemapLayout = d3
        .treemap<d3.HierarchyNode<EnrichedDataItem>>()
        .tile(tilingMethod as any)
        .size([width, height])
        .padding(0) // Differs from real setup for easier testing
        .round(false) // Differs from real setup for easier testing

    const root = treemapLayout(hierarchy)
    const categoryNodes = root.children || []

    // Verify we have data
    expect(root.children).toBeDefined()
    expect(categoryNodes.length).toBeGreaterThan(0)

    // Main test: Check that all nodes maintain proportional areas
    // This is the key property we care about - the tiling algorithm
    // should preserve the proportional relationship between values and areas
    expectChildrenToHaveProportionalAreas(root)

    // Also check each category maintains proportionality
    categoryNodes.forEach((categoryNode) => {
        if (categoryNode.children && categoryNode.children.length > 0) {
            expectChildrenToHaveProportionalAreas(categoryNode)
        }
    })
}

/** Calculate the area of a node */
function calculateArea(node: d3.HierarchyRectangularNode<any>): number {
    return (node.x1 - node.x0) * (node.y1 - node.y0)
}

/** Check if a child's area is proportional to its value */
function expectProportionalArea(
    child: d3.HierarchyRectangularNode<any>,
    totalValue: number,
    totalArea: number
): void {
    const childValue = child.value || 0
    const childArea = calculateArea(child)
    const expectedArea = (childValue / totalValue) * totalArea

    expect(childArea).toBeCloseTo(expectedArea)
}

/** Check if all children of a parent node have proportional areas */
function expectChildrenToHaveProportionalAreas(
    parent: d3.HierarchyRectangularNode<any>
): void {
    const children = parent.children!
    const totalArea = calculateArea(parent)

    const totalValue = R.sumBy(children, (child) => child.value || 0)

    children.forEach((child) => {
        expectProportionalArea(child, totalValue, totalArea)
    })
}
