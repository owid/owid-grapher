import _ from "lodash"

import { JSONPrimitive, JSONType } from "./JSONType"

type AggregateType = {
    keys?: Record<string, AggregateType>
    list?: AggregateType
    values?: { value: JSONPrimitive; occurs: number }[]
    too_many_values?: true
    occurs: number
}

const VALUE_COUNT_LIMIT = 200

export class JSONAggregator {
    result: AggregateType

    constructor() {
        this.result = { occurs: 0 }
    }

    aggregateSingle(contents: any): void {
        aggregateItemInto(this.result, contents)
    }

    toJSON(): AggregateType {
        return this.result
    }
}

function aggregateItemInto(context: AggregateType, item: JSONType): void {
    occurred(context)

    if (typeof item === "string") {
        item = silentJSONParser(item)
    }

    if (Array.isArray(item)) {
        const array = (context.list = context.list ?? { occurs: 1 })
        for (const i of item) {
            aggregateItemInto(array, i)
        }
    } else if (_.isObject(item)) {
        const object = (context.keys = context.keys ?? {})
        _.each(item, (value, key) => {
            object[key] = object[key] ?? ({} as AggregateType)
            aggregateItemInto(object[key]!, value)
        })
    } else {
        aggregateValueInto(context, item)
    }
}

function aggregateValueInto(
    context: AggregateType,
    value: JSONPrimitive
): void {
    // If there are too many values, pre-emptively stop filling in
    if (context.too_many_values) return
    // Otherwise continue
    const values = (context.values = context.values ?? [])
    const result = _.find(values, (d) => d.value === value)

    if (result === undefined) {
        values.push({ value, occurs: 1 })
    } else {
        occurred(result)
    }

    if (values.length >= VALUE_COUNT_LIMIT) {
        context.too_many_values = true
    }
}

function silentJSONParser(json: string): JSONType | string {
    try {
        return JSON.parse(json)
    } catch (e) {
        return json
    }
}

function occurred<Obj extends { occurs?: number }>(obj: Obj): Obj {
    if (_.isNumber(obj.occurs)) {
        obj.occurs += 1
    } else {
        obj.occurs = 1
    }
    return obj
}
