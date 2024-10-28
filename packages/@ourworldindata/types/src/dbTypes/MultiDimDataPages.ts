import { Base64String, JsonString } from "../domainTypes/Various.js"
import { MultiDimDataPageConfigEnriched } from "../siteTypes/MultiDimDataPage.js"

export const MultiDimDataPagesTableName = "multi_dim_data_pages"
export interface DbInsertMultiDimDataPage {
    slug: string
    config: JsonString
    published?: boolean
    createdAt?: Date
    updatedAt?: Date
}

export type DbPlainMultiDimDataPage = Required<DbInsertMultiDimDataPage> & {
    id: number
    configMd5: Base64String
}

export type DbEnrichedMultiDimDataPage = Omit<
    DbPlainMultiDimDataPage,
    "config"
> & {
    config: MultiDimDataPageConfigEnriched
}
