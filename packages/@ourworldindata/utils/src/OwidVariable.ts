// todo: remove file

import { observable } from "mobx"
import {
    Persistable,
    updatePersistables,
    objectWithPersistablesToObject,
    deleteRuntimeAndUnchangedProps,
} from "./persistable/Persistable.js"
import { OwidSource } from "./OwidSource.js"
import { OwidOrigin } from "./OwidOrigin.js"
import {
    OwidVariableDataTableConfigInteface,
    OwidVariableDisplayConfigInterface,
} from "./OwidVariableDisplayConfigInterface.js"

class OwidVariableDisplayConfigDefaults {
    @observable name?: string = undefined
    @observable unit?: string = undefined
    @observable shortUnit?: string = undefined
    @observable isProjection?: boolean = undefined
    @observable conversionFactor?: number = undefined
    @observable numDecimalPlaces?: number = undefined
    @observable tolerance?: number = undefined
    @observable yearIsDay?: boolean = undefined
    @observable zeroDay?: string = undefined
    @observable entityAnnotationsMap?: string = undefined
    @observable includeInTable? = true
    @observable tableDisplay?: OwidVariableDataTableConfigInteface
    @observable color?: string = undefined
}

export class OwidVariableDisplayConfig
    extends OwidVariableDisplayConfigDefaults
    implements Persistable
{
    updateFromObject(obj?: Partial<OwidVariableDisplayConfigInterface>): void {
        if (obj) updatePersistables(this, obj)
    }

    toObject(): OwidVariableDisplayConfigDefaults {
        return deleteRuntimeAndUnchangedProps(
            objectWithPersistablesToObject(this),
            new OwidVariableDisplayConfigDefaults()
        )
    }

    constructor(obj?: Partial<OwidVariableDisplayConfigInterface>) {
        super()
        if (obj) this.updateFromObject(obj)
    }
}

export interface OwidVariableWithSource {
    id: number
    name?: string
    description?: string
    descriptionShort?: string
    descriptionFromProducer?: string
    descriptionKey?: string[]
    descriptionProcessing?: string
    unit?: string
    display?: OwidVariableDisplayConfigInterface
    shortUnit?: string
    datasetName?: string
    datasetId?: number
    coverage?: string
    nonRedistributable?: boolean
    source?: OwidSource
    origins?: OwidOrigin[]
    schemaVersion?: number
    processingLevel?: OwidProcessingLevel
    presentation?: OwidVariablePresentation
    shortName?: string
    timespan?: string
    catalogPath?: string
    license?: OwidLicense
    updatePeriodDays?: number
    datasetVersion?: string
    licenses?: OwidLicense[]

    // omitted:
    // code
    // coverage
    // dataPath
    // metadataPath
}

export interface IndicatorTitleWithFragments {
    title: string
    attributionShort?: string
    titleVariant?: string
}

export function joinTitleFragments(
    attributionShort: string | undefined,
    titleVariant: string | undefined
): string {
    if (attributionShort && titleVariant) {
        return `${attributionShort} – ${titleVariant}`
    }
    if (attributionShort) {
        return attributionShort
    }
    if (titleVariant) {
        return titleVariant
    }
    return ""
}

export interface OwidLicense {
    name: string
    url: string
}

export interface OwidVariablePresentation {
    titlePublic?: string
    titleVariant?: string
    attributionShort?: string
    attribution?: string
    topicTagsLinks?: string[]
    faqs?: FaqLink[]
    grapherConfigETL?: string
}

export type OwidProcessingLevel = "minor" | "major"

export interface FaqLink {
    gdocId: string
    fragmentId: string
}

export type OwidVariableWithSourceAndDimension = OwidVariableWithSource & {
    dimensions: OwidVariableDimensions
}

export type OwidVariableWithSourceAndDimensionWithoutId = Omit<
    OwidVariableWithSourceAndDimension,
    "id"
>

export interface OwidVariableMixedData {
    years: number[]
    entities: number[]
    values: (string | number)[]
}

export type OwidVariableWithDataAndSource = OwidVariableWithSource &
    OwidVariableMixedData

export interface OwidVariableDimension {
    values: OwidVariableDimensionValuePartial[]
}

export interface OwidVariableDimensions {
    years: OwidVariableDimension
    entities: OwidVariableDimension
}

export type OwidVariableDataMetadataDimensions = {
    data: OwidVariableMixedData
    metadata: OwidVariableWithSourceAndDimension
}
export type MultipleOwidVariableDataDimensionsMap = Map<
    number,
    OwidVariableDataMetadataDimensions
>

export interface OwidVariableDimensionValuePartial {
    id: number
    name?: string
    code?: string
}
export type OwidVariableDimensionValueFull =
    Required<OwidVariableDimensionValuePartial>

export interface OwidEntityKey {
    [id: string]: OwidVariableDimensionValuePartial
}

// export interface OwidVariablesAndEntityKey {
//     variables: {
//         [id: string]: OwidVariableWithDataAndSource
//     }
//     entityKey: OwidEntityKey
// }
