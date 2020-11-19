# GridLang

(Note: GridLang name is a placeholder and this readme is a stub)

GridLang is a library for building 2-dimensional domain specific languages designed to be edited in a Spreadsheet UI.

Unlike traditional computer languages that parse tokens in-order, tokens in GridLanguages are parsed in a lazy, non-linear manner, based upon there position in a 2-d matrix.

Our "Explorer"—a DSL for building OWID explorers and Graphers—is a GridLang.

## How it works

1. Extend the base GridProgram class with a class for your new DSL.
2. Create a grammar for your DSL.
3. Load in some "programs" from TSVs.
