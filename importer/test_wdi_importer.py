from openpyxl import load_workbook
import sys
import os
import json
import requests
sys.path.insert(1, os.path.join(sys.path[0], '..'))
import owid_grapher.wsgi
from grapher_admin.models import Entity, DatasetSubcategory, DatasetCategory, Dataset, Source, Variable

wb = load_workbook('WDIEXCEL.xlsx', read_only=True)

series_ws = wb['Series']

column_number = 0
row_number = 0
global_cat = {}

# for row in series_ws.rows:
#     row_number += 1
#     for cell in row:
#         categories = global_cat
#         column_number += 1
#         if column_number == 2:
#             if row_number > 1:
#                 cat = cell.value.split(':')
#                 for category in cat[:-1]:
#                     if not categories.get(category, 0):
#                         categories[category] = {}
#                     categories = categories[category]
#                 else:
#                     if categories.get(cat[-1], 0):
#                         categories[cat[-1]] += 1
#                     else:
#                         categories[cat[-1]] = 1
#             column_number = 0
#             break

sources_dict = {}

for row in series_ws.rows:
    row_number += 1
    indicator = None
    definition = None
    for cell in row:
        if row_number > 1:
            column_number += 1
            if column_number == 1:
                indicator = cell.value
                global_cat[cell.value] = {}
            if column_number == 2:
                global_cat[indicator]['category'] = cell.value.split(':')[0]
            if column_number == 3:
                global_cat[indicator]['name'] = cell.value
            if column_number == 5:
                global_cat[indicator]['description'] = cell.value
                definition = cell.value
            if column_number == 14:
                global_cat[indicator]['source'] = cell.value
                sources_dict[cell.value] = definition

    column_number = 0

print(json.dumps(global_cat))
