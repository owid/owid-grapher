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

/** Specialized iteration function for the key-insights block */
function iterateKeyInsights<T extends EnrichedBlockKeyInsights>(
    parent: T,
    parentPath: string,
    _prop: keyof T
): ChildIterationInfo[] {
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

/** Specialized iteration function for the table block */
function iterateTableProp<T extends EnrichedBlockTable>(
    parent: T,
    parentPath: string,
    _prop: keyof T
): ChildIterationInfo[] {
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

/** The default iteration function for the common case where a property on an
    OwidEnrichedGdocBlock contains an array of OwidEnrichedGdocBlocks */
function iterateArrayProp<T extends OwidEnrichedGdocBlock>(
    parent: T,
    parentPath: string,
    prop: keyof T
): ChildIterationInfo[] {
    if (parent[prop])
        return (parent[prop] as OwidEnrichedGdocBlock[]).map(
            (child, index) => ({
                child: child,
                parentPath: `${parentPath}`,
                path: `${parentPath}.${String(prop)}[${index}]`,
            })
        )
    else return []
}

/** Convert the spans in a gdoc component to plain text.

    The function does this by checking if the given value is an object
    with a "spanType" property. If it is, it is assumed to be a span and
    the text is extracted. If the value is an array that contains objects
    with a "spanType" property, the value is turned into a string. For
    other cases we recurse and copy the value as is.
*/
function convertSpansToPlainText(obj: any): any {
    if (Array.isArray(obj)) {
        if (
            obj.length > 0 &&
            obj.every(
                (item) => typeof item === "object" && item && "spanType" in item
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

function handleComponent<T extends OwidEnrichedGdocBlock>(
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

    // This function is the workhorse of turning a gdoc component with children in
    // the component tree into a flat list of components.

    // For the component itself we want to omit the children and convert the spans to plain text.
    const item: ComponentInfo = {
        content: convertSpansToPlainText(
            omit({ ...component }, props)
        ) as Record<string, unknown>,
        parentPath: parentPath,
        path: path,
    }

    const components = []
    // Now we iterate over the children (using the provided iterator function since the structure of the children can vary)
    // and recursively call this function on each child.
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
    // Our gdoc components fall into three groups:
    // 1. components that do not have Block children, e.g. "heading".
    //      These are handled at the bottom of this match block.
    // 2. components that have direct block children, e.g. "sticky-right"
    //      These have one or more props that are arrays of blocks (OwidEnrichedGdocBlocks)
    //      These blocks use the standard `iterateArrayProp` enumeration function below
    // 3. components that have children that are not blocks, e.g. "key-insights"
    //      These have one or more props that have a structure that is not simply OwidEnrichedGdocBlocks
    //      Key insights have "insight-slide" children for example that have a title and so on
    //      and then also have a "content" prop that is an array of blocks.
    //      These are handled by custom enumeration functions like `iterateKeyInsights`
    return (
        match(node)
            .with(
                {
                    type: P.union(
                        "sticky-right",
                        "sticky-left",
                        "side-by-side"
                    ),
                },
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
            .with(
                { type: "key-indicator-collection" },
                (keyIndicatorCollection) =>
                    handleComponent(
                        keyIndicatorCollection,
                        [{ prop: "blocks", iterator: iterateArrayProp }],
                        parentPath,
                        path
                    )
            )
            .with({ type: "person" }, (person) =>
                handleComponent(
                    person,
                    [
                        { prop: "text", iterator: iterateArrayProp },
                        { prop: "socials", iterator: iterateArrayProp },
                    ],
                    parentPath,
                    path
                )
            )
            .with({ type: "people" }, (people) =>
                handleComponent(
                    people,
                    [{ prop: "items", iterator: iterateArrayProp }],
                    parentPath,
                    path
                )
            )
            .with({ type: "people-rows" }, (peopleRows) =>
                handleComponent(
                    peopleRows,
                    [{ prop: "people", iterator: iterateArrayProp }],
                    parentPath,
                    path
                )
            )
            .with({ type: "code" }, (code) =>
                handleComponent(
                    code,
                    [{ prop: "text", iterator: iterateArrayProp }],
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
                        "simple-text",
                        "donors",
                        "socials"
                        // "narrative-chart" should go here once it's done
                    ),
                },
                (c) => handleComponent(c, [], parentPath, path)
            )
            // Hey dev! If you get here because you add a new component,
            // read the comment at the top of the match block for some
            // guidance on how to handle new components.
            .exhaustive()
    )
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
