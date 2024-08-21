import { JsonString } from "../domainTypes/Various.js"
import { MultiDimDataPageConfigRaw } from "../siteTypes/MultiDimDataPage.js"

export const MultiDimDataPagesTableName = "multi_dim_data_pages"
export interface DbInsertMultiDimDataPage {
    slug: string
    config: JsonString
    published: boolean
    createdAt?: Date
    updatedAt?: Date
}

export type DbPlainMultiDimDataPage = Required<DbInsertMultiDimDataPage>

export type DbEnrichedMultiDimDataPage = Omit<
    DbPlainMultiDimDataPage,
    "config"
> & {
    config: MultiDimDataPageConfigRaw
}
