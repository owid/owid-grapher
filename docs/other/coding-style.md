# WIP

This document is work in progress. For now please check out the existing code to get a feeling for our coding style.

## package.json style guide

We follow some conventions:

1. **camelCase the command names**. This ensures that these command names are also valid identifiers and consistent with our TypeScript code.
2. **Use longer unique names like `buildSiteCss` instead of `style`**. We have to rely on global string matches for finding uses in code, making them unique helps.
3. Identify what "kind" of command your script is and choose an existing decorator, unless it's of a new kind. Think of the "build" and "start" prefixes as function decorators and choose an appropriate one. For example, if your script starts a long lived process, it should be named something like `startXXXServer`; if it generates output to disk, something like `buildXXX`.
