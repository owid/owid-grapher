export const CountryLatestDataTableName = "country_latest_data"
export interface CountryLatestDataRowForInsert {
    country_code?: string | null
    value?: string | null
    variable_id?: number | null
    year?: number | null
}
export type CountryLatestDataRow = Required<CountryLatestDataRowForInsert>
