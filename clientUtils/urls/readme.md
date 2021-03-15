# `Url` a utility class to parse & manupulate URLs

There are tons of existing URL parsing libraries.

We created this utility because most existing URL parsing libraries assume you pass a whole URL – in many cases in our code, we need to parse query strings only.

Keeping query strings and full URLs in one class makes it easier to write URL migrations.

## Creating a `Url`

### `Url.fromURL(url: string)`

```ts
let url = Url.fromURL(
    "https://ourworldindata.org/grapher/test?stackMode=relative#heading"
)

console.log(url.base) // "https://ourworldindata.org"
console.log(url.pathname) // "/grapher/test"
console.log(url.queryStr) // "?stackMode=relative"
console.log(url.hash) // "#heading"

console.log(url.queryParams) // { stackMode: "relative" }
```

### `Url.fromQueryStr(queryStr: string)`

```ts
let url = Url.fromQueryStr("stackMode=relative&country=USA~DEU")

console.log(url.base) // undefined
console.log(url.pathname) // undefined
console.log(url.queryStr) // "?stackMode=relative&country=USA~DEU"
console.log(url.hash) // ""

console.log(url.queryParams) // { stackMode: "relative", country: "USA~DEU" }
```

## Updating a `Url`

### `Url.update(props)`

A **`Url`** object is **immutable** – updating it returns a different `Url` object, the original is left unchanged.

```ts
let url = Url.fromURL(
    "https://ourworldindata.org/grapher/test?stackMode=relative#heading"
)

console.log(url.pathname) // "/grapher/test"
url = url.update({
    pathname: "/abc",
})
console.log(url.pathname) // "/abc"
url = url.update({
    pathname: undefined,
})
console.log(url.pathname) // ""
```

### `Url.updateQueryParams()`

```ts
let url = Url.fromQueryStr("stackMode=relative&country=USA~DEU")

console.log(url.queryParams) // { stackMode: "relative", country: "USA~DEU" }
url = url.updateQueryParams({
    stackMode: "absolute",
})
console.log(url.queryParams) // { stackMode: "absolute", country: "USA~DEU" }
url = url.updateQueryParams({
    // setting `undefined` deletes the query param
    stackMode: undefined,
})
console.log(url.pathname) // { country: "USA~DEU" }
```

### `Url.setQueryParams()`

Wipes all query params before setting them:

```ts
let url = Url.fromQueryStr("stackMode=relative&country=USA~DEU")

console.log(url.queryParams) // { stackMode: "relative", country: "USA~DEU" }
url = url.setQueryParams({
    selection: "~USA",
})
console.log(url.queryParams) // { selection: "~USA" }
```
