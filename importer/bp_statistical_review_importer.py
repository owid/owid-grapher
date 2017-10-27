import sys
import os
import hashlib
import json
import requests
import unidecode
import shutil
sys.path.insert(1, os.path.join(sys.path[0], '..'))
import owid_grapher.wsgi
from openpyxl import load_workbook
from grapher_admin.models import Entity, DatasetSubcategory, DatasetCategory, Dataset, Source, Variable, VariableType, DataValue
from importer.models import ImportHistory
from country_name_tool.models import CountryName
from django.conf import settings
from django.db import connection, transaction
from django.utils import timezone
from grapher_admin.views import write_dataset_csv

# IMPORTANT: The BP Statistical Review of World Energy dataset is one xlsx file consisting of many worksheets
# Data on the worksheets has different structures. This script contains 8 different functions to parse 8 different structure types
# The data seems to be compiled into the xlsx file manually, so the file initially contained similarly structured worksheets
# but some of them had shifted cells and/or rows. In order to deal with such worksheets, the worksheets were changed
# manually so that we don't write extra functions just to account for 1 or 2 cell/row changes and so that all similar worksheets
# have the same structure. This same approach is recommended when the updated edition of the dataset comes out.


# we will use the file checksum to check if the downloaded file has changed since we last saw it
def file_checksum(filename, blocksize=2**20):
    m = hashlib.md5()
    with open(filename, "rb") as f:
        while True:
            buffer = f.read(blocksize)
            if not buffer:
                break
            m.update(buffer)
    return m.hexdigest()


source_description = {
    'dataPublishedBy': "BP",
    'dataPublisherSource': None,
    'link': 'http://www.bp.com/statisticalreview',
    'retrievedDate': timezone.now().strftime("%d-%B-%y"),
    'additionalInfo': None
}

bp_file_url = 'https://www.bp.com/content/dam/bp/en/corporate/excel/energy-economics/statistical-review-2017/bp-statistical-review-of-world-energy-2017-underpinning-data.xlsx'
bp_downloads_save_location = settings.BASE_DIR + '/data/bp_statistical_review/'

# create a directory for holding the downloads
# if the directory exists, delete it and recreate it

#if not os.path.exists(bp_downloads_save_location):
#    os.makedirs(bp_downloads_save_location)
#else:
#    shutil.rmtree(bp_downloads_save_location)
#    os.makedirs(bp_downloads_save_location)

# request_header = {'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_10_1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/39.0.2171.95 Safari/537.36'}
# r = requests.get(bp_file_url, stream=True, headers=request_header)
# if r.ok:
#     with open(bp_downloads_save_location + 'bp_statistical_review.xlsx', 'wb') as out_file:
#         shutil.copyfileobj(r.raw, out_file)
#         excel_filename = os.path.join(settings.BASE_DIR, bp_downloads_save_location, 'bp_statistical_review.xlsx')
# else:
#     sys.exit("Could not download file.")

worksheets_types = {
    'Primary Energy Consumption': 1,
    'Oil - Proved reserves history': 1,
    'Oil Production - Barrels': 1,
    'Oil Production - Tonnes': 1,
    'Oil Consumption -  Barrels': 1,
    'Oil Consumption - Tonnes': 1,
    'Oil - Refinery throughput': 1,
    'Oil - Refinery capacities': 1,
    'Gas - Proved reserves history ': 1,
    'Gas Production - Bcm': 1,
    'Gas Production - Bcf': 1,
    'Gas Production - Mtoe': 1,
    'Gas Consumption - Bcm': 1,
    'Gas Consumption - Bcf': 1,
    'Gas Consumption - Mtoe': 1,
    'Coal Production - Tonnes': 1,
    'Coal Production - Mtoe': 1,
    'Coal Consumption -  Mtoe': 1,
    'Nuclear Consumption - TWh': 1,
    'Nuclear Consumption - Mtoe': 1,
    'Hydro Consumption - TWh': 1,
    'Hydro Consumption - Mtoe': 1,
    'Other renewables -TWh': 1,
    'Other renewables - Mtoe': 1,
    'Solar Consumption - TWh': 1,
    'Solar Consumption - Mtoe': 1,
    'Wind Consumption - TWh ': 1,
    'Wind Consumption - Mtoe': 1,
    'Geo Biomass Other - TWh': 1,
    'Geo Biomass Other - Mtoe': 1,
    'Biofuels Production - Kboed': 1,
    'Biofuels Production - Ktoe': 1,
    'Electricity Generation ': 1,
    'Carbon Dioxide Emissions': 1,
    'Geothermal capacity': 1,
    'Solar capacity': 1,
    'Wind capacity': 1,
    'Primary Energy - Cons by fuel': 2,
    'Oil - Proved reserves': 3,
    'Gas - Proved reserves': 3,
    'Coal - Reserves': 3,
    'Oil - Regional Consumption ': 4,
    'Oil - Spot crude prices': 5,
    'Gas - Prices ': 5,
    'Coal - Prices': 5,
    'Oil - Crude prices since 1861': 6,
    'Oil - Trade movements': 7,
    'Oil - Trade 2015 - 2016': 8,
    'Gas - Trade 2015-2016': 8
}


def check_var_existence(varname):
    global newdataset

    if Variable.objects.filter(name=varname, fk_dst_id=newdataset):
        return True
    else:
        return False


def process_type1(worksheet, worksheet_name):
    column_number = 0
    row_number = 0
    column_to_year = {}
    notes = ''
    notes_starts_from = 999999
    country_name = None
    values_list = []

    global newdataset
    global newsource
    global update_flag

    for row in worksheet.rows:
        row_number += 1
        for cell in row:
            column_number += 1

            if column_number == 1 and row_number == 1:
                varname = cell.value
                if '*' in varname:
                    varname = varname.replace('*', '')
                varname = varname.strip()
                if update_flag and check_var_existence(worksheet_name.strip()):
                    newvariable = Variable.objects.get(name=worksheet_name.strip(), fk_dst_id=newdataset)
                    newvariable.description = varname
                else:
                    newvariable = Variable(name=worksheet_name.strip(), description=varname)

            if column_number == 1 and row_number == 3:
                varunit = cell.value
                if '*' in varunit:
                    varunit = varunit.replace('*', '')
                varunit = varunit.strip()
                newvariable.unit = varunit

            if row_number == 2:
                if cell.value:
                    exclude_year_columns_marker = column_number
                    break

            if row_number == 3 and column_number >= 2:
                if cell.value:
                    if column_number < exclude_year_columns_marker:
                        column_to_year[column_number] = int(cell.value)

            if row_number >= 5:
                if column_number == 1:
                    if cell.value:
                        country_name = cell.value
                        country_name = country_name.strip()
                if column_number > 1:
                    if column_to_year.get(column_number):
                        if cell.value or cell.value == 0:
                            try:
                                value = float(cell.value)
                                values_list.append({'country_name': country_name, 'year': column_to_year[column_number],
                                                    'value': value, 'variable': newvariable})
                            except ValueError:
                                pass

            if column_number == 1:
                if cell.value:
                    if cell.value.strip().startswith('Notes: ') or row_number > notes_starts_from:
                        notes_starts_from = row_number
                        notes += cell.value

        column_number = 0

    if notes.strip():
        newvariable.description += ' ' + notes
    newvariable.fk_dst_id = newdataset
    newvariable.fk_var_type_id = VariableType.objects.get(pk=4)
    newvariable.sourceId = newsource
    newvariable.save()

    insert_values(values_list, worksheet_name)


def process_type2(worksheet, worksheet_name):
    column_number = 0
    row_number = 0
    column_to_year = {}
    column_to_varname = {}
    notes = ''
    notes_starts_from = 999999
    var_dict = {}
    country_name = None
    values_list = []

    global newdataset
    global newsource
    global update_flag

    for row in worksheet.rows:
        row_number += 1
        for cell in row:
            column_number += 1

            if column_number == 1 and row_number == 1:
                mainvarname = cell.value
                if '*' in mainvarname:
                    mainvarname = mainvarname.replace('*', '')
                mainvarname = mainvarname.strip()

            if column_number == 1 and row_number == 3:
                varunit = cell.value

            if row_number == 2:
                if cell.value:
                    column_to_year[column_number] = int(cell.value)
                    for i in range(1, len(column_to_year)):
                        if column_to_year[i] is None:
                            column_to_year[i] = int(cell.value)
                else:
                    column_to_year[column_number] = None

            if row_number == 3 and column_number >= 2:
                if cell.value:
                    newvarname = mainvarname + ' - ' + cell.value
                    if var_dict.get(newvarname):
                        column_to_varname[column_number] = var_dict[newvarname]
                    else:
                        if update_flag and check_var_existence(worksheet_name.strip() + ': ' + cell.value):
                            var_dict[newvarname] = Variable.objects.get(
                                    name=worksheet_name.strip() + ': ' + cell.value, fk_dst_id=newdataset)
                            var_dict[newvarname].description = newvarname
                        else:
                            var_dict[newvarname] = Variable(name=worksheet_name.strip() + ': ' + cell.value,
                                                                unit=varunit, fk_dst_id=newdataset,
                                                                sourceId=newsource, description=newvarname,
                                                                fk_var_type_id=VariableType.objects.get(pk=4))
                        column_to_varname[column_number] = var_dict[newvarname]

            if row_number >= 5:
                if column_number == 1:
                    if cell.value:
                        country_name = cell.value
                        country_name = country_name.strip()

                if column_number > 1:
                    if column_to_year.get(column_number):
                        if cell.value or cell.value == 0:
                            try:
                                value = float(cell.value)
                                values_list.append({'country_name': country_name, 'year': column_to_year[column_number],
                                                    'value': value, 'variable': column_to_varname[column_number]})
                            except ValueError:
                                pass

            if column_number == 1:
                if cell.value:
                    if cell.value.strip().startswith('Notes: ') or row_number > notes_starts_from:
                        notes_starts_from = row_number
                        notes += cell.value

        column_number = 0

    for key, value in column_to_varname.items():
        if notes.strip():
            value.description += ' ' + notes
        value.save()
    insert_values(values_list, worksheet_name)


def process_type3(worksheet, worksheet_name):
    column_number = 0
    row_number = 0
    column_to_year = {}
    column_to_unit = {}
    notes = ''
    notes_starts_from = 999999
    country_name = None
    values_list = []
    var_dict = {}

    global newdataset
    global newsource
    global update_flag

    for row in worksheet.rows:
        row_number += 1
        for cell in row:
            column_number += 1

            if column_number == 1 and row_number == 1:
                mainvarname = cell.value
                if '*' in mainvarname:
                    mainvarname = mainvarname.replace('*', '')
                mainvarname = mainvarname.strip()

            if column_number == 1 and row_number == 2:
                mainvarname = mainvarname + ' ' + cell.value

            if row_number == 2 and column_number >= 2:
                if cell.value:
                    year = int(''.join(onechar for onechar in cell.value if onechar.isdigit()))
                    column_to_year[column_number] = year
                    for i in range(2, column_number):
                        if column_to_year[i] is None:
                            column_to_year[i] = year
                else:
                    column_to_year[column_number] = None

            if worksheet_name.strip() == 'Coal - Reserves':
                if row_number == 4 and column_number == 1:
                    var_unit = cell.value

            if (row_number == 3 or row_number == 4 or row_number == 5) and column_number >= 2:
                if cell.value:
                    if column_to_year.get(column_number):
                        if column_to_unit.get(column_number):
                            column_to_unit[column_number] = column_to_unit[column_number] + ' ' + cell.value
                        else:
                            column_to_unit[column_number] = cell.value

            if row_number == 6 and column_number == 1:
                for key, value in column_to_unit.items():
                    if column_to_unit[key]:
                        if not var_dict.get(worksheet_name.strip() + ' - ' + column_to_unit[key]):
                            if worksheet_name.strip() == 'Coal - Reserves':
                                if update_flag and check_var_existence(worksheet_name.strip() + ' - ' + column_to_unit[key]):
                                    var_dict[worksheet_name.strip() + ' - ' + column_to_unit[key]] = Variable.objects.get(
                                        name=worksheet_name.strip() + ' - ' + column_to_unit[key],
                                        fk_dst_id=newdataset)
                                    var_dict[worksheet_name.strip() + ' - ' + column_to_unit[key]].description = mainvarname + ' - ' + column_to_unit[key]
                                else:
                                    var_dict[worksheet_name.strip() + ' - ' + column_to_unit[key]] = Variable(
                                            name=worksheet_name.strip() + ' - ' + column_to_unit[key],
                                            unit=var_unit, fk_dst_id=newdataset,
                                            sourceId=newsource, description=mainvarname + ' - ' + column_to_unit[key],
                                            fk_var_type_id=VariableType.objects.get(pk=4)
                                            )
                            else:
                                if update_flag and check_var_existence(worksheet_name.strip() + ' - ' + column_to_unit[key]):
                                    var_dict[worksheet_name.strip() + ' - ' + column_to_unit[key]] = Variable.objects.get(
                                        name=worksheet_name.strip() + ' - ' + column_to_unit[key],
                                        fk_dst_id=newdataset)
                                    var_dict[worksheet_name.strip() + ' - ' + column_to_unit[key]].description = mainvarname + ' - ' + column_to_unit[key]
                                else:
                                    var_dict[worksheet_name.strip() + ' - ' + column_to_unit[key]] = Variable(
                                        name=worksheet_name.strip() + ' - ' + column_to_unit[key],
                                        unit=column_to_unit[key], fk_dst_id=newdataset,
                                        sourceId=newsource, description=mainvarname + ' - ' + column_to_unit[key],
                                        fk_var_type_id=VariableType.objects.get(pk=4)
                                        )

            if row_number >= 7:
                if column_number == 1:
                    if cell.value:
                        country_name = cell.value
                        country_name = country_name.strip()

                if column_number > 1:
                    if column_to_year.get(column_number):
                        if cell.value or cell.value == 0:
                            try:
                                value = float(cell.value)
                                values_list.append({'country_name': country_name, 'year': column_to_year[column_number],
                                                    'value': value, 'variable': var_dict[worksheet_name.strip() + ' - ' + column_to_unit[column_number]]})
                            except ValueError:
                                pass

            if column_number == 1:
                if cell.value:
                    if cell.value.strip().startswith('Notes: ') or row_number > notes_starts_from:
                        notes_starts_from = row_number
                        notes += cell.value

        column_number = 0

    for key, value in var_dict.items():
        if value:
            if notes.strip():
                value.description += ' ' + notes
            value.save()
    insert_values(values_list, worksheet_name)


def process_type4(worksheet, worksheet_name):
    column_number = 0
    row_number = 0
    column_to_year = {}
    notes = ''
    notes_starts_from = 999999
    country_name = None
    var_dict = {}
    values_list = []

    global newdataset
    global newsource
    global update_flag

    for row in worksheet.rows:
        row_number += 1
        for cell in row:
            column_number += 1

            if column_number == 1 and row_number == 1:
                mainvarname = cell.value
                if '*' in mainvarname:
                    mainvarname = mainvarname.replace('*', '')
                mainvarname = mainvarname.strip()

            if column_number == 1 and row_number == 3:
                varunit = cell.value

            if row_number == 2:
                if cell.value:
                    exclude_year_columns_marker = column_number
                    break

            if row_number == 3 and column_number >= 2:
                if cell.value:
                    if column_number < exclude_year_columns_marker:
                        column_to_year[column_number] = int(cell.value)

            if row_number >= 5:
                if column_number == 1:
                    if cell.value:
                        if cell.font.bold:
                            country_name = cell.value
                            if 'Total' in country_name:
                                varname = mainvarname + ' - ' + 'Total'
                                if not var_dict.get(varname):
                                    if update_flag and check_var_existence(worksheet_name.strip() + ' - ' + 'Total'):
                                        var_dict[varname] = Variable.objects.get(
                                            name=worksheet_name.strip() + ' - ' + 'Total',
                                            fk_dst_id=newdataset)
                                        var_dict[varname].description = varname
                                    else:
                                        var_dict[varname] = Variable(
                                            name=worksheet_name.strip() + ' - ' + 'Total',
                                            unit=varunit, fk_dst_id=newdataset,
                                            sourceId=newsource, description=varname,
                                            fk_var_type_id=VariableType.objects.get(pk=4)
                                            )
                            country_name = country_name.strip()
                        else:
                            varname = mainvarname + ' - ' + cell.value.replace('of which:', '').strip()
                            if not var_dict.get(varname):
                                if update_flag and check_var_existence(worksheet_name.strip() + ' - ' + cell.value.replace('of which:', '').strip()):
                                    var_dict[varname] = Variable.objects.get(name=worksheet_name.strip() + ' - ' + cell.value.replace('of which:', '').strip(),
                                                           fk_dst_id=newdataset)
                                    var_dict[varname].description = varname
                                else:
                                    var_dict[varname] = Variable(name=worksheet_name.strip() + ' - ' + cell.value.replace('of which:', '').strip(),
                                                                  unit=varunit, fk_dst_id=newdataset,
                                                                  sourceId=newsource, description=varname,
                                                                  fk_var_type_id=VariableType.objects.get(pk=4)
                                                                  )

                if column_number > 1:
                    if column_to_year.get(column_number):
                        if cell.value or cell.value == 0:
                            try:
                                value = float(cell.value)
                                values_list.append({'country_name': country_name, 'year': column_to_year[column_number],
                                                    'value': value, 'variable': var_dict[varname]})
                            except ValueError:
                                pass

            if column_number == 1:
                if cell.value:
                    if cell.value.strip().startswith('Notes: ') or row_number > notes_starts_from:
                        notes_starts_from = row_number
                        notes += cell.value

        column_number = 0

    for key, value in var_dict.items():
        if value:
            if notes.strip():
                value.description += ' ' + notes
            if value in [item['variable'] for item in values_list]:
                value.save()
    insert_values(values_list, worksheet_name)


def process_type5(worksheet, worksheet_name):
    column_number = 0
    row_number = 0
    notes = ''
    notes_starts_from = 999999
    column_to_entity = {}
    values_list = []

    global newdataset
    global newsource
    global update_flag

    for row in worksheet.rows:
        row_number += 1
        for cell in row:
            column_number += 1

            if column_number == 1 and row_number == 1:
                varname = cell.value
                if '*' in varname:
                    varname = varname.replace('*', '')
                varname = varname.strip()

            if column_number == 1 and row_number == 4:
                varunit = cell.value

            if (row_number == 2 or row_number == 3) and column_number >= 2:
                if cell.value:
                    if column_to_entity.get(column_number):
                        column_to_entity[column_number] += ' ' + cell.value
                    else:
                        column_to_entity[column_number] = cell.value

            if row_number == 5 and column_number == 1:
                if update_flag and check_var_existence(worksheet_name.strip()):
                    newvariable = Variable.objects.get(name=worksheet_name.strip(), fk_dst_id=newdataset)
                    newvariable.description = varname
                else:
                    newvariable = Variable(
                        name=worksheet_name.strip(),
                        unit=varunit, fk_dst_id=newdataset,
                        sourceId=newsource, description=varname,
                        fk_var_type_id=VariableType.objects.get(pk=4)
                    )

            if row_number >= 6:
                if column_number == 1:
                    if cell.value:
                        try:
                            year = int(cell.value)
                        except ValueError:
                            notes += cell.value
                if column_number > 1:
                    if column_to_entity.get(column_number):
                        if cell.value or cell.value == 0:
                            try:
                                value = float(cell.value)
                                values_list.append({'country_name': column_to_entity[column_number], 'year': year,
                                                    'value': value, 'variable': newvariable})
                            except ValueError:
                                pass

            if column_number == 1:
                if cell.value:
                    if str(cell.value).strip().startswith('Notes: ') or row_number > notes_starts_from:
                        notes_starts_from = row_number
                        notes += str(cell.value)

        column_number = 0

    if notes.strip():
        newvariable.description += ' ' + notes
    newvariable.save()
    insert_values(values_list, worksheet_name)


def process_type6(worksheet, worksheet_name):
    column_number = 0
    row_number = 0
    notes = ''
    notes_starts_from = 999999
    column_to_entity = {}
    values_list = []

    global newdataset
    global newsource
    global update_flag

    for row in worksheet.rows:
        row_number += 1
        for cell in row:
            column_number += 1

            if column_number == 1 and row_number == 1:
                varname = cell.value
                if '*' in varname:
                    varname = varname.replace('*', '')
                varname = varname.strip()

            if column_number == 1 and row_number == 3:
                varunit = cell.value

            if row_number == 4 and column_number >= 2:
                if cell.value:
                        column_to_entity[column_number] = cell.value

            if row_number == 4 and column_number == 1:
                if update_flag and check_var_existence(worksheet_name.strip()):
                    newvariable = Variable.objects.get(name=worksheet_name.strip(), fk_dst_id=newdataset)
                    newvariable.description = varname
                else:
                    newvariable = Variable(
                        name=worksheet_name.strip(),
                        unit=varunit, fk_dst_id=newdataset,
                        sourceId=newsource, description=varname,
                        fk_var_type_id=VariableType.objects.get(pk=4)
                    )

            if row_number >= 5:
                if column_number == 1:
                    if cell.value:
                        try:
                            year = int(cell.value)
                        except ValueError:
                            notes += cell.value
                if column_number > 1:
                    if column_to_entity.get(column_number):
                        if cell.value or cell.value == 0:
                            try:
                                value = float(cell.value)
                                values_list.append({'country_name': column_to_entity[column_number], 'year': year,
                                                    'value': value, 'variable': newvariable})
                            except ValueError:
                                pass

            if column_number == 1:
                if cell.value:
                    if str(cell.value).strip().startswith('Notes: ') or row_number > notes_starts_from:
                        notes_starts_from = row_number
                        notes += str(cell.value)

        column_number = 0

    if notes.strip():
        newvariable.description += ' ' + notes
    newvariable.save()
    insert_values(values_list, worksheet_name)


def process_type7(worksheet, worksheet_name):
    column_number = 0
    row_number = 0
    column_to_year = {}
    notes = ''
    notes_starts_from = 999999
    country_name = None
    country_set_for_row = {}
    values_list = []
    var_dict = {}

    global newdataset
    global newsource
    global update_flag

    for row in worksheet.rows:
        row_number += 1
        for cell in row:
            column_number += 1

            if column_number == 1 and row_number == 1:
                mainvarname = cell.value
                if '*' in mainvarname:
                    mainvarname = mainvarname.replace('*', '')
                mainvarname = mainvarname.strip()

            if column_number == 1 and row_number == 3:
                varunit = cell.value

            if row_number == 2:
                if cell.value:
                    exclude_year_columns_marker = column_number
                    break

            if row_number == 3 and column_number >= 2:
                if cell.value:
                    if column_number < exclude_year_columns_marker:
                        column_to_year[column_number] = int(cell.value)

            if row_number >= 4:
                if column_number == 1:
                    if cell.value:
                        if cell.value == 'Imports':
                            varname = mainvarname + ' - ' + cell.value
                        if cell.value == 'Exports':
                            varname = mainvarname + ' - ' + cell.value
                        if not var_dict.get(varname):
                            if update_flag and check_var_existence(worksheet_name.strip() + ' - ' + cell.value):
                                var_dict[varname] = Variable.objects.get(name=worksheet_name.strip() + ' - ' + cell.value,
                                                                         fk_dst_id=newdataset)
                                var_dict[varname].description = varname
                            else:
                                var_dict[varname] = Variable(
                                    name=worksheet_name.strip() + ' - ' + cell.value,
                                    unit=varunit, fk_dst_id=newdataset,
                                    sourceId=newsource, description=varname,
                                    fk_var_type_id=VariableType.objects.get(pk=4)
                                )
                        else:
                            country_name = cell.value
                            country_name = country_name.strip()
                            country_set_for_row[row_number] = True
                if column_number > 1:
                    if column_to_year.get(column_number):
                        if country_set_for_row.get(row_number):
                            if cell.value or cell.value == 0:
                                try:
                                    value = float(cell.value)
                                    values_list.append({'country_name': country_name, 'year': column_to_year[column_number],
                                                        'value': value, 'variable': var_dict[varname]})
                                except ValueError:
                                    pass

            if column_number == 1:
                if cell.value:
                    if cell.value.strip().startswith('Notes: ') or row_number > notes_starts_from:
                        notes_starts_from = row_number
                        notes += cell.value

        column_number = 0

    if notes.strip():
        for key, value in var_dict.items():
            if value:
                value.description += ' ' + notes
    for key, value in var_dict.items():
        if value:
            value.save()
    insert_values(values_list, worksheet_name)


def process_type8(worksheet, worksheet_name):
    column_number = 0
    row_number = 0
    column_to_year = {}
    column_to_varname = {}
    notes = ''
    notes_starts_from = 999999
    current_var_unit = None
    set_flag_for_var_unit = False
    var_dict = {}
    values_list = []

    global newdataset
    global newsource
    global update_flag

    for row in worksheet.rows:
        row_number += 1
        for cell in row:
            column_number += 1

            if column_number == 1 and row_number == 1:
                mainvarname = cell.value
                if '*' in mainvarname:
                    mainvarname = mainvarname.replace('*', '')
                mainvarname = mainvarname.strip()

            if row_number == 2:
                if cell.value:
                    column_to_year[column_number] = int(cell.value)
                    column_to_year[column_number - 1] = int(cell.value)
                    column_to_year[column_number + 1] = int(cell.value)
                    column_to_year[column_number + 2] = int(cell.value)

            if row_number == 4 and column_number == 1:
                if cell.value:
                    current_var_unit = cell.value

            if (row_number == 3 or row_number == 4) and column_number >= 2:
                if cell.value:
                    if column_to_varname.get(column_number):
                        column_to_varname[column_number] += ' ' + cell.value
                    else:
                        column_to_varname[column_number] = cell.value

            if row_number == 5 and column_number == 1:
                for key, value in column_to_varname.items():
                    if not var_dict.get(value + current_var_unit):
                        if update_flag and check_var_existence(worksheet_name.strip() + ' - ' + value + ' - ' + current_var_unit):
                            var_dict[value + current_var_unit] = Variable.objects.get(name=worksheet_name.strip() + ' - ' + value + ' - ' + current_var_unit,
                                                                                      fk_dst_id=newdataset)
                            var_dict[value + current_var_unit].description = mainvarname + ' - ' + value + ' - ' + current_var_unit
                        else:
                            var_dict[value + current_var_unit] = Variable(
                                    name=worksheet_name.strip() + ' - ' + value + ' - ' + current_var_unit,
                                    unit=current_var_unit, fk_dst_id=newdataset,
                                    sourceId=newsource, description=mainvarname + ' - ' + value + ' - ' + current_var_unit,
                                    fk_var_type_id=VariableType.objects.get(pk=4)
                                )

            if row_number >= 5:
                if column_number == 1:
                    if cell.value:
                        country_name = cell.value
                        country_name = country_name.strip()
                        if set_flag_for_var_unit:
                            current_var_unit = cell.value
                            set_flag_for_var_unit = False
                            for key, value in column_to_varname.items():
                                if not var_dict.get(value + current_var_unit):
                                    if update_flag and check_var_existence(worksheet_name.strip() + ' - ' + value + ' - ' + current_var_unit):
                                        var_dict[value + current_var_unit] = Variable.objects.get(name=worksheet_name.strip() + ' - ' + value + ' - ' + current_var_unit,
                                                                                                  fk_dst_id=newdataset)
                                        var_dict[value + current_var_unit].description = mainvarname + ' - ' + value + ' - ' + current_var_unit
                                    else:
                                        var_dict[value + current_var_unit] = Variable(
                                            name=worksheet_name.strip() + ' - ' + value + ' - ' + current_var_unit,
                                            unit=current_var_unit, fk_dst_id=newdataset,
                                            sourceId=newsource,
                                            description=mainvarname + ' - ' + value + ' - ' + current_var_unit,
                                            fk_var_type_id=VariableType.objects.get(pk=4)
                                        )
                        if cell.font.bold:
                            set_flag_for_var_unit = True

                if column_number > 1:
                    if column_to_year.get(column_number):
                        if cell.value or cell.value == 0:
                            try:
                                value = float(cell.value)
                                values_list.append({'country_name': country_name, 'year': column_to_year[column_number],
                                                    'value': value, 'variable': var_dict[column_to_varname[column_number]+current_var_unit]})
                            except ValueError:
                                pass

            if column_number == 1:
                if cell.value:
                    if cell.value.strip().startswith('Notes: ') or row_number > notes_starts_from:
                        notes_starts_from = row_number
                        notes += cell.value

        column_number = 0

    if notes.strip():
        for key, value in var_dict.items():
            if value:
                value.description += ' ' + notes

    for key, value in var_dict.items():
        if value in [item['variable'] for item in values_list]:
            value.save()
    insert_values(values_list, worksheet_name)


def insert_values(valuelist, worksheet_name):

    global country_name_entity_ref
    global existing_entities_list
    global country_tool_names_dict

    chars_to_strip_from_entity_names = ['#', 'of which:', '1', '2', '3', '4', '5', '†', '‡', '*', 'Total', ':']
    change_country_names_from_to = {
        '$ money of the day': 'nominal $',
        'East & S. Africa': 'East & South Africa',
        'Other S. & Cent. America': 'Other South & Central America',
        'S. & Cent. America': 'South & Central America'
    }

    data_values_tuple_list = []

    insert_string = 'INSERT into data_values (value, year, fk_ent_id, fk_var_id) VALUES (%s, %s, %s, %s)'  # this is used for constructing the query for mass inserting to the data_values table

    for onevalue in valuelist:
        countryname = onevalue['country_name']

        for onechar in chars_to_strip_from_entity_names:
            if onechar in countryname and worksheet_name != 'Oil - Crude prices since 1861':
                countryname = countryname.replace(onechar, '')

        countryname = countryname.strip()

        if change_country_names_from_to.get(countryname):
            countryname = change_country_names_from_to[countryname]

        year = onevalue['year']
        value = onevalue['value']
        variable = onevalue['variable']
        if countryname.lower() not in country_name_entity_ref:
            if country_tool_names_dict.get(unidecode.unidecode(countryname.lower()), 0):
                newentity = Entity.objects.get(
                    name=country_tool_names_dict[unidecode.unidecode(countryname.lower())].owid_name)
            elif countryname.lower() in existing_entities_list:
                newentity = Entity.objects.get(name=countryname)
            else:
                newentity = Entity(name=countryname, validated=False)
                newentity.save()
            country_name_entity_ref[countryname.lower()] = newentity

        data_values_tuple_list.append((str(value), int(year),
                                       country_name_entity_ref[countryname.lower()].pk,
                                       variable.pk))

    if update_flag:
        unique_vars = []
        for onevalue in valuelist:
            if onevalue['variable'].pk not in unique_vars:
                unique_vars.append(onevalue['variable'].pk)
        for onevariable in unique_vars:
            while DataValue.objects.filter(fk_var_id__pk=onevariable).first():
                with connection.cursor() as c:  # if we don't limit the deleted values, the db might just hang
                    c.execute('DELETE FROM %s WHERE fk_var_id = %s LIMIT 10000;' %
                              (DataValue._meta.db_table, onevariable))

    with connection.cursor() as c:
        c.executemany(insert_string, data_values_tuple_list)
    del data_values_tuple_list[:]


excel_filename = os.path.join(settings.BASE_DIR, bp_downloads_save_location, 'bp_statistical_review.xlsx')
wb = load_workbook(excel_filename, read_only=True)
all_worksheets = wb.get_sheet_names()

bp_category_name_in_db = 'BP Statistical Review of Global Energy'  # set the name of the root category of all data that will be imported by this script
bp_subcategory_name_in_db = 'Energy'  # set the name of the subcategory of all data that will be imported by this script

existing_categories = DatasetCategory.objects.values('name')
existing_categories_list = {item['name'] for item in existing_categories}

import_history = ImportHistory.objects.filter(import_type='bpstatreview')

update_flag = False

with transaction.atomic():

    if bp_category_name_in_db not in existing_categories_list:
        the_category = DatasetCategory(name=bp_category_name_in_db, fetcher_autocreated=True)
        the_category.save()
    else:
        the_category = DatasetCategory.objects.get(name=bp_category_name_in_db)

    existing_subcategories = DatasetSubcategory.objects.filter(fk_dst_cat_id=the_category.pk).values('name')
    existing_subcategories_list = {item['name'] for item in existing_subcategories}

    if bp_subcategory_name_in_db not in existing_subcategories_list:
        the_subcategory = DatasetSubcategory(name=bp_subcategory_name_in_db, fk_dst_cat_id=the_category)
        the_subcategory.save()
    else:
        the_subcategory = DatasetSubcategory.objects.get(name=bp_subcategory_name_in_db, fk_dst_cat_id=the_category)

    if Dataset.objects.filter(name='BP Statistical Review of Global Energy', namespace='bpstatreview'):
        newdataset = Dataset.objects.get(name='BP Statistical Review of Global Energy', namespace='bpstatreview')
    else:
        newdataset = Dataset(name='BP Statistical Review of Global Energy',
                         description='This is a dataset imported by the automated fetcher',
                         namespace='bpstatreview', fk_dst_cat_id=the_category,
                         fk_dst_subcat_id=the_subcategory)
        newdataset.save()

    if Source.objects.filter(name='BP Statistical Review of Global Energy', datasetId=newdataset.pk):
        newsource = Source.objects.get(name='BP Statistical Review of Global Energy', datasetId=newdataset.pk)
    else:
        newsource = Source(name='BP Statistical Review of Global Energy', description=json.dumps(source_description),
                           datasetId=newdataset.pk)
        newsource.save()

    country_name_entity_ref = {}  # this dict will hold the country names and the appropriate entity object (this is used when saving the variables and their values)

    existing_entities = Entity.objects.values('name')
    existing_entities_list = {item['name'].lower() for item in existing_entities}

    country_tool_names = CountryName.objects.all()
    country_tool_names_dict = {}
    for each in country_tool_names:
        country_tool_names_dict[each.country_name.lower()] = each.owid_country

    if not import_history:
        update_flag = False
    else:
        for oneimport in import_history:
            if json.loads(oneimport.import_state)['file_hash'] != file_checksum(excel_filename):
                update_flag = True
            else:
                update_flag = 'Do nothing'

    if update_flag == 'Do nothing':
        sys.exit('No updates available.')
    else:
        for oneworksheet in all_worksheets:
            if worksheets_types.get(oneworksheet):
                if worksheets_types[oneworksheet] == 1:
                    process_type1(wb[oneworksheet], oneworksheet)
                if worksheets_types[oneworksheet] == 2:
                    process_type2(wb[oneworksheet], oneworksheet)
                if worksheets_types[oneworksheet] == 3:
                    process_type3(wb[oneworksheet], oneworksheet)
                if worksheets_types[oneworksheet] == 4:
                    process_type4(wb[oneworksheet], oneworksheet)
                if worksheets_types[oneworksheet] == 5:
                    process_type5(wb[oneworksheet], oneworksheet)
                if worksheets_types[oneworksheet] == 6:
                    process_type6(wb[oneworksheet], oneworksheet)
                if worksheets_types[oneworksheet] == 7:
                    process_type7(wb[oneworksheet], oneworksheet)
                if worksheets_types[oneworksheet] == 8:
                    process_type8(wb[oneworksheet], oneworksheet)

        newimport = ImportHistory(import_type='bpstatreview',
                                  import_time=timezone.now().strftime('%Y-%m-%d %H:%M:%S'),
                                  import_notes='Importing file %s' % os.path.basename(excel_filename),
                                  import_state=json.dumps(
                                      {'file_hash': file_checksum(excel_filename),
                                       'file_name': os.path.basename(excel_filename)
                                       }))
        newimport.save()
        if update_flag:
            write_dataset_csv(newdataset.pk, newdataset.name, newdataset.name, 'bpstatreview_fetcher', '')
        else:
            write_dataset_csv(newdataset.pk, newdataset.name, None, 'bpstatreview_fetcher', '')
