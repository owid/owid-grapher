## Gdocs cli

This tool is a first stab at a helper to let us interact with gdocs from a cli. It was started to fetch google docs api responses in preparation for API tests. In the future it could be extended to also work with other apis that we use, e.g. google drive.

## Usage

To fetch the gdoc api response by gdoc id and print the result to stdout, run the following:

```bash
yarn run tsx ./devTools/gdocs/fetch-by-id.ts GDOC-ID
```

To compare the default mode with the inline suggestions mode (which annotates insertions and deletions), use:

```bash
yarn run tsx ./devTools/gdocs/fetch-with-suggestions.ts GDOC-ID --outDir ./tmp-downloads
```
