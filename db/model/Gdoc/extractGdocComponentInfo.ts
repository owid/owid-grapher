import {
    DbInsertPostGdocComponent,
    EnrichedBlockKeyInsights,
    EnrichedBlockTable,
    OwidEnrichedGdocBlock,
    serializePostGdocComponentConfig,
} from "@ourworldindata/types"
import { omit, spansToUnformattedPlainText } from "@ourworldindata/utils"
import { match, P } from "ts-pattern"
interface ChildIterationInfo {
    child: OwidEnrichedGdocBlock
    parentPath: string
    path: string
}

interface ComponentInfo {
    content: Record<string, unknown>
    parentPath: string
    path: string
}
function iterateKeyInsights<T extends EnrichedBlockKeyInsights>(
    parent: T,
    parentPath: string,
    prop: keyof T
): ChildIterationInfo[] {
    // Todo: there is a difference between props that are lists and single
    // item props. the default should be the list and then we need to
    // build up the .[0] part of the path
    const items: ChildIterationInfo[] = []
    for (let i = 0; i < parent.insights.length; i++) {
        const slide = parent.insights[i]
        for (let j = 0; j < slide.content.length; j++) {
            items.push({
                child: slide.content[j],
                parentPath: `${parentPath}`,
                path: `${parentPath}.insights[${i}].content[${j}]`,
            })
        }
    }
    return items
}

function iterateTableProp<T extends EnrichedBlockTable>(
    parent: T,
    parentPath: string,
    prop: keyof T
): ChildIterationInfo[] {
    // Todo: there is a difference between props that are lists and single
    // item props. the default should be the list and then we need to
    // build up the .[0] part of the path
    const items: ChildIterationInfo[] = []
    for (let i = 0; i < parent.rows.length; i++) {
        const row = parent.rows[i]
        for (let j = 0; j < row.cells.length; j++) {
            for (let k = 0; k < row.cells[j].content.length; k++) {
                items.push({
                    child: row.cells[j].content[k],
                    parentPath: `${parentPath}`,
                    path: `${parentPath}.rows[${i}].cells[${j}].content[${k}]`,
                })
            }
        }
    }
    return items
}

function iterateArrayProp<T extends OwidEnrichedGdocBlock>(
    parent: T,
    parentPath: string,
    prop: keyof T
): ChildIterationInfo[] {
    // Todo: there is a difference between props that are lists and single
    // item props. the default should be the list and then we need to
    // build up the .[0] part of the path
    return (parent[prop] as OwidEnrichedGdocBlock[]).map((child, index) => ({
        child: child,
        parentPath: `${parentPath}`,
        path: `${parentPath}.${String(prop)}[${index}]`,
    }))
}

function handleComponent<T extends OwidEnrichedGdocBlock, S extends keyof T>(
    component: T,
    childProperties: {
        prop: keyof T
        iterator: (
            parent: T,
            parentPath: string,
            prop: keyof T
        ) => ChildIterationInfo[]
    }[],
    parentPath: string,
    path: string
): ComponentInfo[] {
    const props: (keyof T)[] = childProperties.map(
        (childProp) => childProp.prop
    )
    function convertSpansToPlainText(obj: any): any {
        if (Array.isArray(obj)) {
            if (
                obj.length > 0 &&
                obj.every(
                    (item) =>
                        typeof item === "object" && item && "spanType" in item
                )
            ) {
                return spansToUnformattedPlainText(obj)
            }
            return obj.map((item) => convertSpansToPlainText(item))
        }
        if (typeof obj === "object" && obj !== null) {
            if (typeof obj === "object" && "spanType" in obj) {
                return spansToUnformattedPlainText([obj])
            }
            const result: Record<string, any> = {}
            for (const [key, value] of Object.entries(obj)) {
                result[key] = convertSpansToPlainText(value)
            }
            return result
        }
        return obj
    }

    const item: ComponentInfo = {
        content: convertSpansToPlainText(
            omit({ ...component }, props)
        ) as Record<string, unknown>,
        parentPath: parentPath,
        path: path,
    }

    const components = []

    for (const { prop, iterator } of childProperties) {
        try {
            const children = iterator(component, `${path}`, prop)
            for (const child of children) {
                const childComponents = enumerateGdocComponentsWithoutChildren(
                    child.child,
                    child.parentPath,
                    child.path
                )
                components.push(...childComponents)
            }
        } catch (e) {
            throw new Error(`Error iterating ${String(prop)} for ${path}: ${e}`)
        }
    }

    return [item, ...components]
}

export function enumerateGdocComponentsWithoutChildren(
    node: OwidEnrichedGdocBlock,
    parentPath: string,
    path: string
): ComponentInfo[] {
    return match(node)
        .with(
            { type: P.union("sticky-right", "sticky-left", "side-by-side") },
            (container) =>
                handleComponent(
                    container,
                    [
                        { prop: "left", iterator: iterateArrayProp },
                        { prop: "right", iterator: iterateArrayProp },
                    ],
                    parentPath,
                    path
                )
        )
        .with({ type: "gray-section" }, (graySection) =>
            handleComponent(
                graySection,
                [{ prop: "items", iterator: iterateArrayProp }],
                parentPath,
                path
            )
        )
        .with({ type: "key-insights" }, (keyInsights) =>
            handleComponent(
                keyInsights,
                [{ prop: "insights", iterator: iterateKeyInsights }],
                parentPath,
                path
            )
        )
        .with({ type: "callout" }, (callout) =>
            handleComponent(
                callout,
                [{ prop: "text", iterator: iterateArrayProp }],
                parentPath,
                path
            )
        )
        .with({ type: "list" }, (list) =>
            handleComponent(
                list,
                [{ prop: "items", iterator: iterateArrayProp }],
                parentPath,
                path
            )
        )
        .with({ type: "numbered-list" }, (numberedList) =>
            handleComponent(
                numberedList,
                [{ prop: "items", iterator: iterateArrayProp }],
                parentPath,
                path
            )
        )
        .with({ type: "expandable-paragraph" }, (expandableParagraph) =>
            handleComponent(
                expandableParagraph,
                [{ prop: "items", iterator: iterateArrayProp }],
                parentPath,
                path
            )
        )
        .with({ type: "align" }, (align) =>
            handleComponent(
                align,
                [{ prop: "content", iterator: iterateArrayProp }],
                parentPath,
                path
            )
        )
        .with({ type: "table" }, (table) =>
            handleComponent(
                table,
                [{ prop: "rows", iterator: iterateTableProp }],
                parentPath,
                path
            )
        )
        .with({ type: "blockquote" }, (blockquote) =>
            handleComponent(
                blockquote,
                [{ prop: "text", iterator: iterateArrayProp }],
                parentPath,
                path
            )
        )
        .with({ type: "key-indicator" }, (keyIndicator) =>
            handleComponent(
                keyIndicator,
                [{ prop: "text", iterator: iterateArrayProp }],
                parentPath,
                path
            )
        )
        .with({ type: "key-indicator-collection" }, (keyIndicatorCollection) =>
            handleComponent(
                keyIndicatorCollection,
                [{ prop: "blocks", iterator: iterateArrayProp }],
                parentPath,
                path
            )
        )
        .with(
            {
                type: P.union(
                    "chart-story",
                    "chart",
                    "horizontal-rule",
                    "html",
                    "image",
                    "video",
                    "missing-data",
                    "prominent-link",
                    "pull-quote",
                    "recirc",
                    "research-and-writing",
                    "scroller",
                    "sdg-grid",
                    "sdg-toc",
                    "topic-page-intro",
                    "all-charts",
                    "entry-summary",
                    "explorer-tiles",
                    "pill-row",
                    "homepage-search",
                    "homepage-intro",
                    "latest-data-insights",
                    "socials",
                    "aside",
                    "text",
                    "heading",
                    "additional-charts",
                    "simple-text"
                ),
            },
            (c) => handleComponent(c, [], parentPath, path)
        )
        .exhaustive()
}

export function getGdocComponentsWithoutChildren(
    gdocId: string,
    body: OwidEnrichedGdocBlock[] | undefined
): DbInsertPostGdocComponent[] {
    const startPath = "$.body"
    const componentInfos = []
    if (body)
        for (let i = 0; i < body.length; i++) {
            const components = enumerateGdocComponentsWithoutChildren(
                body[i],
                startPath,
                `${startPath}[${i}]`
            )
            componentInfos.push(...components)
        }
    const gdocComponents = componentInfos.map(
        (componentInfo) =>
            ({
                gdocId,
                path: componentInfo.path,
                parent: componentInfo.parentPath,
                config: serializePostGdocComponentConfig(componentInfo.content),
            }) satisfies DbInsertPostGdocComponent
    )
    return gdocComponents
}
