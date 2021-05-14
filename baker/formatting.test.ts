#! /usr/bin/env jest

import {
    extractDataValuesConfiguration,
    parseFormattingOptions,
} from "./formatting"

it("parses formatting options", () => {
    const formattingOptions =
        "subnavId:coronavirus isTrue isAlsoTrue:true isFalse:false"
    expect(parseFormattingOptions(formattingOptions)).toStrictEqual({
        subnavId: "coronavirus",
        isTrue: true,
        isAlsoTrue: true,
        isFalse: false,
    })
})

it("extracts DataValue tags configurations", async () => {
    const queryArgs = { year: 2001, variableId: 146684, entityId: 12 }
    const template = "%value %unit in %year in %entity"
    const dataValueConfigurationString = `year:${queryArgs.year} variableId:${queryArgs.variableId} entityId:${queryArgs.entityId} | ${template}`
    const dataValueTag = `{{DataValue ${dataValueConfigurationString}}}`

    const queryArgs2 = { year: 1990, variableId: 146, entityId: 13 }
    const template2 = "%unit in %year in %entity"
    const dataValueConfigurationString2 = `year:${queryArgs2.year}  variableId:${queryArgs2.variableId}  entityId:${queryArgs2.entityId}  |   ${template2}`
    const dataValueTag2 = `{{  DataValue  ${dataValueConfigurationString2}    }}`

    const html = `Lorem ipsum dolor ${dataValueTag}. <span>sit amet</span>
                  Fusce eu vestibulum ${dataValueTag2} urna, at laoreet ${dataValueTag2} purus.`

    const dataValuesConfigurationsMap = new Map()
    dataValuesConfigurationsMap.set(dataValueConfigurationString, {
        queryArgs,
        template,
    })
    dataValuesConfigurationsMap.set(dataValueConfigurationString2, {
        queryArgs: queryArgs2,
        template: template2,
    })
    expect(await extractDataValuesConfiguration(html)).toEqual(
        dataValuesConfigurationsMap
    )
})
