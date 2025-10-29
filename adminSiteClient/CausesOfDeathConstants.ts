import { EntityName, Time } from "@ourworldindata/types"

export const CAUSE_OF_DEATH_INDICATOR_NAMES = [
    "Total number of deaths from cancers",
    "Total number of deaths from chronic respiratory diseases",
    "Total number of deaths from diabetes and kidney diseases",
    "Total number of deaths from diarrheal diseases",
    "Total number of deaths from digestive diseases",
    "Total number of deaths from heart diseases",
    "Total number of deaths from HIV/AIDS",
    "Total number of deaths from interpersonal violence",
    "Total number of deaths from malaria",
    "Total number of deaths from maternal disorders",
    "Total number of deaths from neonatal disorders",
    "Total number of deaths from neurological disorders",
    "Total number of deaths from nutritional deficiencies",
    "Total number of deaths from other infectious diseases",
    "Total number of deaths from other injuries",
    "Total number of deaths from other non-communicable diseases",
    "Total number of deaths from pneumonia",
    "Total number of deaths from suicide",
    "Total number of deaths from transport injuries",
    "Total number of deaths from tuberculosis",
] as const

export const CAUSE_OF_DEATH_CATEGORIES = [
    "Noncommunicable diseases",
    "Infectious diseases",
    "Maternal, neonatal, and nutritional disorders",
    "Injuries",
] as const

export const CAUSE_OF_DEATH_CATEGORY_COLORS: Record<
    CauseOfDeathCategory,
    string
> = {
    "Noncommunicable diseases": "#074964",
    "Infectious diseases": "#A5184D",
    "Maternal, neonatal, and nutritional disorders": "#B73696",
    Injuries: "#0B9D75",
}

export type CauseOfDeathIndicatorName =
    (typeof CAUSE_OF_DEATH_INDICATOR_NAMES)[number]
export type CauseOfDeathCategory = (typeof CAUSE_OF_DEATH_CATEGORIES)[number]

export const CAUSE_OF_DEATH_CATEGORY_MAPPING: Record<
    CauseOfDeathIndicatorName,
    CauseOfDeathCategory
> = {
    "Total number of deaths from cancers": "Noncommunicable diseases",
    "Total number of deaths from chronic respiratory diseases":
        "Noncommunicable diseases",
    "Total number of deaths from diabetes and kidney diseases":
        "Noncommunicable diseases",
    "Total number of deaths from diarrheal diseases": "Infectious diseases",
    "Total number of deaths from digestive diseases":
        "Noncommunicable diseases",
    "Total number of deaths from heart diseases": "Noncommunicable diseases",
    "Total number of deaths from HIV/AIDS": "Infectious diseases",
    "Total number of deaths from interpersonal violence": "Injuries",
    "Total number of deaths from malaria": "Infectious diseases",
    "Total number of deaths from maternal disorders":
        "Maternal, neonatal, and nutritional disorders",
    "Total number of deaths from neonatal disorders":
        "Maternal, neonatal, and nutritional disorders",
    "Total number of deaths from neurological disorders":
        "Noncommunicable diseases",
    "Total number of deaths from nutritional deficiencies":
        "Maternal, neonatal, and nutritional disorders",
    "Total number of deaths from other infectious diseases":
        "Infectious diseases",
    "Total number of deaths from other injuries": "Injuries",
    "Total number of deaths from other non-communicable diseases":
        "Noncommunicable diseases",
    "Total number of deaths from pneumonia": "Infectious diseases",
    "Total number of deaths from suicide": "Injuries",
    "Total number of deaths from transport injuries": "Injuries",
    "Total number of deaths from tuberculosis": "Infectious diseases",
}

export const CAUSE_OF_DEATH_DESCRIPTIONS: Partial<
    Record<CauseOfDeathIndicatorName, string>
> = {
    "Total number of deaths from heart diseases":
        "Heart attacks, strokes, and other cardiovascular diseases",
    "Total number of deaths from chronic respiratory diseases":
        "COPD, Asthma, and others",
    "Total number of deaths from digestive diseases": "Cirrhosis and others",
    "Total number of deaths from neurological disorders":
        "Alzheimer's, Parkinson's, epilepsy, and others",
    "Total number of deaths from neonatal disorders":
        "Babies who died within the first 28 days of life",
}

export type FetchedDataRow = {
    Entity: EntityName
    Year: Time
} & Record<CauseOfDeathIndicatorName, number>

export interface DataRow {
    entityName: EntityName
    year: Time
    variable: CauseOfDeathIndicatorName
    value: number
}

export interface EnrichedDataRow extends DataRow {
    category: CauseOfDeathCategory
}

export const COUNTRIES_WITH_DEFINITE_ARTICLE = [
    "Bahamas",
    "Gambia",
    "Maldives",
    "Netherlands",
    "Philippines",
    "Seychelles",
    "Marshall Islands",
    "Solomon Islands",
    "Comoros",
    "United Arab Emirates",
    "United States",
    "United Kingdom",
    "Czech Republic",
    "Central African Republic",
    "Dominican Republic",
    "Democratic Republic of Congo",
    "Congo",
    "Micronesia (country)",
]
