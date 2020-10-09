# CoreTable

This is our core tabular data structure class which parses JSON or delimited data and makes it available for charts. This class performs core transformations like filtering, grouping, etc.

Tables are immutable, so all transformations generate a new lightweight table. Changes made to a parent table flow down to child tables.

CoreTable is a generic class operating on generic tabular structures.

OwidTable is a subset of CoreTable, with the distinction that every OwidTable has an entity (aka country) column, a time integer ( year, day, quarter, etc) column, and one or more any columns ("values"). OwidTable also includes additional meta data like Source info, needed by our charts.

Most of our charts are built for country changes over time, so take an OwidTable specifically.

## Context

TypeScript/Javascript does not have a builtin tabular data structure, nor does it have a "standard" data table package like Pandas in Python or Data.Tables/Tibbles in R.

A library like that is essential for powering common data transformations including grouping, filtering, joining, pivots (group and reduce) and computed columns.

In order to allow our users to interact with our charts and allow our authors to easily create computed columns for charts, we need a library like this.

## Alternatives

One alternative is to only do transforms server side, in Python or R. Previously nearly all transforms were done by authors on their machines and the results uploaded to our backend. This can be time consuming, error prone, opaque, and does not allow for rich data exploration for the reader.

Another alternative is to use someone else's package. Most commerical web data studios likely have their own internal or ad hoc data table library. AFAIK there isn't a compelling open source one yet supported by a major organization. Two interesting open source projects to watch are [Data Forge](http://github.com/data-forge/data-forge-ts) and [DataFrame-js](https://github.com/Gmousse/dataframe-js). Over the past decade, a number of "data frames in JS" packages have started but not continued (like https://github.com/StratoDem/pandas-js, https://github.com/osdat/jsdataframe, https://github.com/nickslevine/zebras and https://github.com/davidguttman/node-dataframe). As we develop this package we should keep in mind that at some point we will likely migrate to someone else's effort.

Update: Arquero (https://github.com/uwdata/arquero) looks like a promising new alternative

## Design Notes

-   The split between CoreTable and OwidTable is to ensure we minimize the delta between our data model and the common model in data science, with the bet that this may require use to maintain a lot less code in the long run.
-   Consolidating our transform code and switching from a variable model to a table model is a work-in-progress so currently there is still a fair amount of legacy code yet to be ported over.
-   This library should treat Node and the Browser both as first class targets. Even though our primary usage will be in the browser, ensuring a great Node experience will ensure a fast headless testing experience. We may also use this in a headless environment for running the same transform code on bigger datasets.
-   Because our clients are reactive, we are using Mobx in this library. No reason that needs to be a hard dependency here if we remove that.
-   At some point we may want to look into integrating with Apache Arrow JS (https://github.com/apache/arrow/tree/master/js).
-   Similarly for speed we may want to look into integrating/learning from CrossFilter (https://github.com/crossfilter/crossfilter).
-   Table "Sythensizers" are also included for rapid testing. The word Synthesis is used as in "Program Synthesis".
