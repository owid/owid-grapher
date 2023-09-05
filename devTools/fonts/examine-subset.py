#!./env/bin/python3
"""
This script is called from the makefile with the path of a font from the full-charset version of Lato and
the unicode-range string used for choosing which characters will be included in the subset.

It prints out two listings, the first itemizes the glyphs included in the subset range. The second lists
all the characters that are present in the full version of the font but NOT included in the subset. The
parenthetical hex values can be added to LATIN_RANGES in the Makefile to add characters to the subset.
"""
from subprocess import run
import xml.etree.ElementTree as ET
from os.path import basename
import shutil
import sys

# truncate long glyph names if necessary
MAX_LENGTH = 32

def col_print(lines, term_width=None, indent=0, pad=2):
    """Print list of strings in multiple columns
    Original: https://gist.github.com/critiqjo/2ca84db26daaeb1715e1
    Adjusted: https://gist.github.com/Nachtalb/8a85c0793b4bea0a102b7414be5888d4
    """
    if not term_width:
        size = shutil.get_terminal_size((80, 20))
        term_width = size.columns

    n_lines = len(lines)
    if n_lines == 0:
        return

    col_width = max(len(line) for line in lines)
    n_cols = int((term_width + pad - indent) / (col_width + pad))
    n_cols = min(n_lines, max(1, n_cols))

    col_len = int(n_lines / n_cols) + (0 if n_lines % n_cols == 0 else 1)
    if (n_cols - 1) * col_len >= n_lines:
        n_cols -= 1

    cols = [lines[i * col_len: i * col_len + col_len] for i in range(n_cols)]

    rows = list(zip(*cols))
    rows_missed = zip(*[col[len(rows):] for col in cols[:-1]])
    rows.extend(rows_missed)

    for row in rows:
        print(" " * indent + (" " * pad).join(line.ljust(col_width) for line in row))

def print_charset(title, glyphs):
    print(f"\n{title}:")
    col_print(["%s (%04x) %s" % (chr(code), code, format_name(name)) for [code, name] in glyphs], indent=1)

def format_name(long_glyph_name):
    name = long_glyph_name.lower().strip().replace(' ','-')
    if len(name) > MAX_LENGTH:
        return name[:MAX_LENGTH-1].strip('-') + "…"
    return name

def report(font, subset_ranges):
    # expand the ranges into individual codes
    subset_codes = []
    for chunk in [r.replace('U+','').split('-') for r in subset_ranges.split(',')]:
        nums = [int(c, 16) for c in chunk]
        nums.append(nums[0])
        nums[1] += 1
        subset_codes.extend(range(*nums[:2]))

    ttx_output = run(['.env/bin/ttx', '-t', 'cmap', '-o', '-', font], capture_output=True).stdout
    parser = ET.XMLParser(target=ET.TreeBuilder(insert_comments=True)) # names are in paired comments
    parser.feed(ttx_output)
    root = parser.close()
    cmap = iter(root.findall("./cmap//*[@platformID='0']/")) # use the unicode cmap

    subset = []
    full = []
    for glyph in cmap:
        code = int(glyph.get('code'), 16)
        comment = next(cmap).text
        charset = subset if code in subset_codes else full
        charset.append([code, comment])

    family = basename(font).split('-')[0]
    print_charset(f"The {family}Latin subset contains", subset)
    print_charset(f"The full {family} font additionally contains", full)
    

if __name__ == "__main__":
    report(*sys.argv[1:3])