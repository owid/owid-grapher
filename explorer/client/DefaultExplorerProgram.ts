// Note: the following sample program was actually made in a spreadsheet and copy/pasted. Easier that way.

export const DefaultExplorerProgram = `title	New Data Explorer Template
defaultView	?country=Canada~France
isPublished	false
switcher
	chartId	Examples Radio	title	subtitle	table	type	ySlugs	hasMapTab
	35	Load A Grapher Demo
		Create A Grapher Demo	Hello world	This is a subtitle	demo	DiscreteBar	gdp	true
		Data from CSV Demo	Healthy Life Expectancy		lifeExpectancy	LineChart	Healthy-Life-Expectancy-IHME

table	demo
	entityName	year	gdp
	Canada	2020	100
	France	2020	110
columns	demo
	slug	name	type
	gdp	Gross Domestic Product	Currency

table	lifeExpectancy	https://raw.githubusercontent.com/owid/owid-datasets/master/datasets/Healthy%20Life%20Expectancy%20-%20IHME/Healthy%20Life%20Expectancy%20-%20IHME.csv
columns	lifeExpectancy
	slug	type
	Entity	EntityName
	Year	Year`
