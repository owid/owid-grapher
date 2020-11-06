export interface OwidSource {
    id?: number

    /**
     * Source name displayed on charts using this dataset. For academic papers, the name of the source should be "Authors (year)" e.g.
     * Arroyo-Abad and Lindert (2016). For institutional projects or reports, the name should be "Institution, Project (year or vintage)"
     * e.g. U.S. Bureau of Labor Statistics, Consumer Expenditure Survey (2015 release). For data that we have modified extensively, the
     * name should be "Our World in Data based on Author (year)" e.g. Our World in Data based on Atkinson (2002) and Sen (2000).
     */
    name: string

    /**
     * For academic papers this should be a complete reference. For institutional projects, detail the project or report. For data we
     * have modified extensively, list OWID as the publishers and provide the name of the person in charge of the calculation.
     */
    dataPublishedBy: string

    /**
     * Basic indication of how the publisher collected this data e.g. surveys data. Anything longer than a line should go in the dataset description.
     */
    dataPublisherSource: string

    /**
     * Link to the publication from which we retrieved this data
     */
    link: string

    /**
     * Date when this data was obtained by us
     */
    retrievedDate: string

    /**
     * Describe the dataset and the methodology used in its construction. This can be as long and detailed as you like.
     */
    additionalInfo: string
}

export enum OwidSourceProps {
    name = "name",
    dataPublishedBy = "dataPublishedBy",
    dataPublisherSource = "dataPublisherSource",
    link = "link",
    retrievedDate = "retrievedDate",
    additionalInfo = "additionalInfo",
}
