.PHONY: serve build

default: serve

serve: .venv
	cd .. && ./docs/.venv/bin/mkdocs serve

build: .venv
	cd .. && ./docs/.venv/bin/mkdocs build

.venv: pyproject.toml poetry.toml poetry.lock
	poetry install --no-root
	touch $@
