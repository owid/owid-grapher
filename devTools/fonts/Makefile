PRETTIER := node ../../node_modules/prettier/bin-prettier.js
WOFF2 := woff2_compress
PYTHON := ./.env/bin/python3
PIP := ./.env/bin/pip3
.PHONY := all

all: .env .env/lato .env/playfair
	$(MAKE) $(FACES)
	@-diff -u --color=auto ../../public/fonts.css $(FACES) || true
	@printf '\nInspect `$(FACES)` then run `make install` to update `public/fonts/*.woff2` and `public/fonts.css`'

LATO_URL := https://www.latofonts.com/download/lato2oflweb-zip
.env/lato.zip:
	curl $(LATO_URL) -o .env/lato.zip
.env/lato: .env/lato.zip
	unzip -jo .env/lato.zip -d .env/lato '*/*/*/*.woff2'
LATO_WOFFS = $(wildcard .env/lato/*.woff2)

PLAYFAIR_URL := https://www.fontsquirrel.com/fonts/download/playfair-display
.env/playfair.zip:
	curl -L $(PLAYFAIR_URL) -o .env/playfair.zip
.env/playfair: .env/playfair.zip
	unzip -jo .env/playfair.zip -d .env/playfair 'PlayfairDisplay-*'
PLAYFAIR_OTFS = $(wildcard .env/playfair/*.otf)
PLAYFAIR_WOFFS = $(patsubst %.otf,%.woff2,$(PLAYFAIR_OTFS))

FONTS_DIR := ../../public/fonts
FONTS_CSS := ../../public/fonts.css
FONTS = $(LATO_WOFFS) $(PLAYFAIR_WOFFS)
FACES = .env/fonts.css

%.woff2: %.otf
	$(WOFF2) $<

.env:
	python3 -m venv .env
	$(PIP) install -r requirements.txt

$(FACES): .env $(FONTS)
	@$(PYTHON) make-faces.py $(FONTS) | $(PRETTIER) --parser css > $(FACES)

install: $(FONTS) $(FACES)
	cp $(FONTS) $(FONTS_DIR)
	cp $(FACES) $(FONTS_CSS)

clean:
	rm -rf .env 