#!./env/bin/python3
"""
This script performs an in-place modification of the specified font file to insert missing
character-map entries for superscript and subscript numerals. It's intended to be used on the
PlayfairDisplay TTFs downloaded from google fonts since they lack those mappings. If invoked with
the filename "-" it will read from stdin and write the modified font to stdout.
"""
from subprocess import run
from os.path import exists, dirname, abspath
import sys
import re

TTX = f'{dirname(abspath(__file__))}/.env/bin/ttx'

# unicode codepoint -> glyph name mappings
scripts = {
    # subscripts
    0x2080: "zero.subs",
    0x2081: "one.subs",
    0x2082: "two.subs",
    0x2083: "three.subs",
    0x2084: "four.subs",
    0x2085: "five.subs",
    0x2086: "six.subs",
    0x2087: "seven.subs",
    0x2088: "eight.subs",
    0x2089: "nine.subs",

    # superscripts
    0x2070: "zero.sups",
    0x00B9: "uni00B9", # one
    0x00B2: "uni00B2", # two
    0x00B3: "uni00B3", # three
    0x2074: "four.sups",
    0x2075: "five.sups",
    0x2076: "six.sups",
    0x2077: "seven.sups",
    0x2078: "eight.sups",
    0x2079: "nine.sups",
}

def update_cmap(path):
    pipe_input = sys.stdin.buffer.read() if path=="-" else None
    if not exists(path) and not pipe_input:
        print("No such file:", path, file=sys.stderr)
        sys.exit(1)

    # decompile the TTF
    print(f"Updating character tables in {path}...", end=' ', flush=True, file=sys.stderr)
    ttx_orig = run([TTX, '-o', '-', path], capture_output=True, input=pipe_input).stdout.decode('utf-8')

    # bail out if this font has already been modified
    for m in re.findall(r'<cmap_format_\d.*?</cmap_format_\d>', ttx_orig, re.DOTALL):
        if 'zero.subs' in m:
            print("(already contains super/subscript definitions)", file=sys.stderr)
            sys.exit(0)

    # add missing definitions to all cmap tables in the font
    cmap_additions = "".join([
        f'<map code="{uni:#x}" name="{name}"/>' for uni, name in scripts.items()
    ])
    ttx_modified = re.sub(r'(</cmap_format_\d>)', cmap_additions + r'\1', ttx_orig).encode('utf-8')

    # compile the updated font and overwrite the existing file
    run([TTX, '-q', '-o', path, '-'], input=ttx_modified)
    print("(done)", file=sys.stderr)

if __name__ == "__main__":
    try:
        update_cmap(*sys.argv[1:2])
    except TypeError:
        print("Usage: fix-numerals.py <path-to-font>")
