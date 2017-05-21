from openpyxl import load_workbook
import sys
import os
sys.path.insert(1, os.path.join(sys.path[0], '..'))
import owid_grapher.wsgi
from grapher_admin.models import Entity

wb = load_workbook('WDIEXCEL.xlsx', read_only=True)

series_ws = wb['Series']

