// Todo: make these fed dynamically from GitCMS so authors can make their own templates

const ExplorerTemplate = `explorerTitle	My New Explorer
explorerSubtitle	This is the subtitle
selection	Canada~India
graphers
	title	ySlugs	subtitle	Statistic Radio	type	hasMapTab
	Population of different countries	Population	How many people live in each country?	Population	DiscreteBar	true
	Flag Properties	MapleleafsInFlag	How many leaves are on their flag?	Flag	WorldMap	true
table
	Country	Population	Year	MapleleafsInFlag
	Canada	32000000	2020	1
	India	1000000000	2020	0
	France	50000000	2020	0
columns
	slug	type	name	notes
	Country	EntityName	Country	Unreviewed
	Population	Numeric	Population	Unreviewed
	Year	Year	Year	Unreviewed
	MapleleafsInFlag	Numeric	MapleleafsInFlag	Unreviewed`

const GrapherTemplate = `selection	Canada~India
title	Population of different countries
subtitle	How many people live in each country?
type	DiscreteBar
hasMapTab	true
hideControls	true
ySlugs	Population
table
	Country	Population	Year	MapleleafsInFlag
	Canada	32000000	2020	1
	India	1000000000	2020	0
	France	50000000	2020	0
columns
	slug	type	name	notes
	Country	EntityName	Country	Unreviewed
	Population	Numeric	Population	Unreviewed
	Year	Year	Year	Unreviewed
	MapleleafsInFlag	Numeric	MapleleafsInFlag	Unreviewed`

export const ExplorerTemplates = [
    {
        slug: "Explorer",
        code: ExplorerTemplate,
        thumb: `/explorer-template.png`,
    },
    { slug: "Grapher", code: GrapherTemplate, thumb: `/grapher-template.png` },
]
