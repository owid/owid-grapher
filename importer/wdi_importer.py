import io
import sys
import os
import hashlib
import json
import logging
import requests
import unidecode
import shutil
import time
import zipfile
sys.path.insert(1, os.path.join(sys.path[0], '..'))
import owid_grapher.wsgi
from openpyxl import load_workbook
from grapher_admin.models import Entity, DatasetSubcategory, DatasetCategory, Dataset, Source, Variable, VariableType, DataValue
from importer.models import ImportHistory
from country_name_tool.models import CountryName
from django.db import connection, transaction
from django.utils import timezone


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


source_template = '<table>' \
                    '<tr>' \
                        '<td>Variable category</td>' \
                        '<td>%s</td>' \
                    '</tr>' \
                    '<tr>' \
                        '<td>Unit of measure</td>' \
                        '<td>%s</td>' \
                    '</tr>' \
                    '<tr>' \
                        '<td>Variable code in original source</td>' \
                        '<td>%s</td>' \
                    '</tr>' \
                    '<tr>' \
                        '<td>Data published by</td>' \
                        '<td>%s</td>' \
                    '</tr>' \
                    '<tr>' \
                        '<td>Data publisher\'s source</td>' \
                        '<td>%s</td>' \
                    '</tr>' \
                    '<tr>' \
                        '<td>Link</td>' \
                        '<td>http://data.worldbank.org/data-catalog/world-development-indicators</td>' \
                    '</tr>' \
                    '<tr>' \
                        '<td>Retrieved</td>' \
                        '<td>' + timezone.now().strftime("%d-%B-%y") +'</td>' \
                    '</tr>' \
                  '</table>' \
                  '<div class="datasource-additional">' \
                    '<p>%s</p>' \
                  '</div>'


wdi_zip_file_url = 'http://databank.worldbank.org/data/download/WDI_excel.zip'
wdi_downloads_save_location = os.path.dirname(os.path.realpath(__file__)) + '/wdi_downloads/'
wdi_backups_location = os.path.dirname(os.path.realpath(__file__)) + '/backups/wdi/'

# create a directory for holding the downloads
# if the directory exists, delete it and recreate it

if not os.path.exists(wdi_downloads_save_location):
    os.makedirs(wdi_downloads_save_location)
else:
    shutil.rmtree(wdi_downloads_save_location)
    os.makedirs(wdi_downloads_save_location)

# create a directory for holding the backup sql files
if not os.path.exists(wdi_backups_location):
    os.makedirs(wdi_backups_location)

logger = logging.getLogger('importer')
start_time = time.time()

logger.info("Getting the zip file")
r = requests.get(wdi_zip_file_url, stream=True)
if r.ok:
    with open(wdi_downloads_save_location + 'wdi.zip', 'wb') as out_file:
        shutil.copyfileobj(r.raw, out_file)
    z = zipfile.ZipFile(wdi_downloads_save_location + 'wdi.zip')
    excel_filename = wdi_downloads_save_location + z.namelist()[0]  # there should be only one file inside the zipfile, so we will load that one
    z.extractall(wdi_downloads_save_location)
    r = None  # we do not need the request anymore
    logger.info("Successfully extracted the zip file")
else:
    logger.error("The file could not be downloaded. Stopping the script...")
    sys.exit("Could not download file.")

wdi_category_name_in_db = 'World Development Indicators'  # set the name of the root category of all data that will be imported by this script


import_history = ImportHistory.objects.filter(import_type='wdi')


# if wdi imports were never performed
if not import_history:
    backup_sql_file = open(os.path.join(wdi_backups_location, '%s.sql' %
                           timezone.now().strftime("%Y-%m-%d %H:%M:%S")), 'w', encoding='utf-8')

    wb = load_workbook(excel_filename, read_only=True)

    series_ws = wb['Series']
    data_ws = wb['Data']
    country_ws = wb['Country']

    column_number = 0  # this will be reset to 0 on each new row
    row_number = 0   # this will be reset to 0 if we switch to another worksheet, or start reading the worksheet from the beginning one more time

    global_cat = {}  # global catalog of indicators

    # data in the worksheets is not loaded into memory at once, that causes RAM to quickly fill up
    # instead, we go through each row and cell one-by-one, looking at each piece of data separately
    # this has the disadvantage of needing to traverse the worksheet several times, if we need to look up some rows/cells again

    for row in series_ws.rows:
        row_number += 1
        indicator = None
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
                if column_number == 6:
                    if cell.value:  # often this column is empty, which will result in nonetype value
                        global_cat[indicator]['unitofmeasure'] = cell.value
                    else:
                        global_cat[indicator]['unitofmeasure'] = ''
                if column_number == 11:
                    if cell.value:
                        global_cat[indicator]['limitations'] = cell.value
                    else:
                        global_cat[indicator]['limitations'] = ''
                if column_number == 12:
                    if cell.value:
                        global_cat[indicator]['sourcenotes'] = cell.value
                    else:
                        global_cat[indicator]['sourcenotes'] = ''
                if column_number == 13:
                    if cell.value:
                        global_cat[indicator]['comments'] = cell.value
                    else:
                        global_cat[indicator]['comments'] = ''
                if column_number == 14:
                    global_cat[indicator]['source'] = cell.value
                if column_number == 15:
                    if cell.value:
                        global_cat[indicator]['concept'] = cell.value
                    else:
                        global_cat[indicator]['concept'] = ''
                if column_number == 17:
                    if cell.value:
                        global_cat[indicator]['sourcelinks'] = cell.value
                    else:
                        global_cat[indicator]['sourcelinks'] = ''
                if column_number == 18:
                    if cell.value:
                        global_cat[indicator]['weblinks'] = cell.value
                    else:
                        global_cat[indicator]['weblinks'] = ''
                global_cat[indicator]['saved'] = False

        column_number = 0

    category_vars = {}  # categories and their corresponding variables

    for key, value in global_cat.items():
        if category_vars.get(value['category'], 0):
            category_vars[value['category']].append(key)
        else:
            category_vars[value['category']] = []
            category_vars[value['category']].append(key)

    existing_categories = DatasetCategory.objects.values('name')
    existing_categories_list = []

    for each in existing_categories:
        existing_categories_list.append(each['name'])

    if wdi_category_name_in_db not in existing_categories_list:
        the_category = DatasetCategory(name=wdi_category_name_in_db)
        the_category.save()
        backup_sql_file.write("INSERT INTO %s (name, created_at, updated_at) VALUES ('%s', '%s', '%s');\n" %
                              (DatasetCategory._meta.db_table, wdi_category_name_in_db.replace("'", "\\'"),
                               the_category.created_at.strftime('%Y-%m-%d %H:%M:%S'),
                               the_category.updated_at.strftime('%Y-%m-%d %H:%M:%S')))

    else:
        the_category = DatasetCategory.objects.get(name=wdi_category_name_in_db)

    existing_subcategories = DatasetSubcategory.objects.filter(fk_dst_cat_id=the_category.pk).values('name')
    existing_subcategories_list = []

    for each in existing_subcategories:
        existing_subcategories_list.append(each['name'])

    wdi_categories_list = []

    for key, value in category_vars.items():
        wdi_categories_list.append(key)
        if key not in existing_subcategories_list:
            the_subcategory = DatasetSubcategory(name=key, fk_dst_cat_id=the_category)
            the_subcategory.save()
            backup_sql_file.write(
                "INSERT INTO %s (name, fk_dst_cat_id, created_at, updated_at) VALUES ('%s', %s, '%s', '%s');\n" %
                (DatasetSubcategory._meta.db_table, key.replace("'", "\\'"), the_category.pk,
                 the_subcategory.created_at.strftime('%Y-%m-%d %H:%M:%S'),
                 the_subcategory.updated_at.strftime('%Y-%m-%d %H:%M:%S')))

    existing_entities = Entity.objects.values('name')
    existing_entities_list = []
    for each in existing_entities:
        existing_entities_list.append(each['name'])

    country_tool_names = CountryName.objects.all()
    country_tool_names_dict = {}
    for each in country_tool_names:
        country_tool_names_dict[each.country_name.lower()] = each.owid_country

    country_name_entity_ref = {}  # this dict will hold the country names from excel and the appropriate entity object (this is used when saving the variables and their values)

    row_number = 0
    for row in country_ws.rows:
        row_number += 1
        for cell in row:
            if row_number > 1:
                column_number += 1
                if column_number == 1:
                    country_code = cell.value
                if column_number == 3:
                    country_name = unidecode.unidecode(cell.value)
                if column_number == 7:
                    country_special_notes = cell.value
                if column_number == 8:
                    country_region = cell.value
                if column_number == 9:
                    country_income_group = cell.value
                if column_number == 24:
                    country_latest_census = cell.value
                if column_number == 25:
                    country_latest_survey = cell.value
                if column_number == 26:
                    country_recent_income_source = cell.value
                if column_number == 31:
                    entity_info = {'code': country_code, 'special_notes': country_special_notes,
                                   'region': country_region, 'income_group': country_income_group,
                                   'latest_census': country_latest_census, 'latest_survey': country_latest_survey,
                                   'recent_income_source': country_recent_income_source
                                  }
                    if not country_region:
                        if country_name + '_WDI' not in existing_entities_list:  # _WDI separator applies only to region names
                            newentity = Entity(name=country_name + '_WDI', entity_info=json.dumps(entity_info), validated=False)
                            newentity.save()
                            backup_sql_file.write("INSERT INTO %s (name, validated, displayName, entity_info, created_at, "
                                                  "updated_at) VALUES ('%s', %s, '%s', '%s', '%s', '%s');\n" %
                                                  (Entity._meta.db_table, newentity.name.replace("'", "\\'"), 0, '',
                                                   newentity.entity_info.replace("\\", "\\\\").replace("'", "\\'"),
                                                   newentity.created_at.strftime('%Y-%m-%d %H:%M:%S'),
                                                   newentity.updated_at.strftime('%Y-%m-%d %H:%M:%S')))
                        else:
                            newentity = Entity.objects.get(name=country_name + '_WDI')
                            newentity.entity_info = json.dumps(entity_info)
                            newentity.save()
                            backup_sql_file.write("UPDATE %s set entity_info = '%s', updated_at = '%s' WHERE name = '%s';\n" %
                                                  (Entity._meta.db_table,
                                                   newentity.entity_info.replace("\\", "\\\\").replace("'", "\\'"),
                                                   newentity.updated_at.strftime('%Y-%m-%d %H:%M:%S'),
                                                   newentity.name.replace("'", "\\'")))
                    else:
                        if country_tool_names_dict.get(country_name.lower(), 0):
                            newentity = Entity.objects.get(name=country_tool_names_dict[country_name.lower()].owid_name)
                            newentity.entity_info = json.dumps(entity_info)
                            newentity.save()
                            backup_sql_file.write(
                                "UPDATE %s set entity_info = '%s', updated_at = '%s' WHERE name = '%s';\n" %
                                (Entity._meta.db_table,
                                 newentity.entity_info.replace("\\", "\\\\").replace("'", "\\'"),
                                 newentity.updated_at.strftime('%Y-%m-%d %H:%M:%S'),
                                 newentity.name.replace("'", "\\'")))
                        else:
                            newentity = Entity(name=country_name, entity_info=json.dumps(entity_info), validated=False)
                            newentity.save()
                            backup_sql_file.write(
                                "INSERT INTO %s (name, validated, displayName, entity_info, created_at, "
                                "updated_at) VALUES ('%s', %s, '%s', '%s', '%s', '%s');\n" %
                                (Entity._meta.db_table, newentity.name.replace("'", "\\'"), 0, '',
                                 newentity.entity_info.replace("\\", "\\\\").replace("'", "\\'"),
                                 newentity.created_at.strftime('%Y-%m-%d %H:%M:%S'),
                                 newentity.updated_at.strftime('%Y-%m-%d %H:%M:%S')))
                    country_name_entity_ref[country_code] = newentity

        column_number = 0

    insert_string = 'INSERT into data_values (value, year, fk_ent_id, fk_var_id) VALUES (%s, %s, %s, %s)'  # this is used for constructing the query for mass inserting to the data_values table
    data_values_tuple_list = []

    for category in wdi_categories_list:
        newdataset = Dataset(name='World Development Indicators - ' + category,
                             description='This is a dataset imported by the automated fetcher',
                             namespace='wdi', fk_dst_cat_id=DatasetCategory.objects.get(name=wdi_category_name_in_db),
                             fk_dst_subcat_id=DatasetSubcategory.objects.get(name=category, fk_dst_cat_id=DatasetCategory.objects.get(name=wdi_category_name_in_db)))
        newdataset.save()
        backup_sql_file.write("INSERT INTO %s (name, description, namespace, fk_dst_cat_id, fk_dst_subcat_id,"
                              "created_at, updated_at) VALUES ('%s', '%s', '%s', %s, %s, '%s', '%s');\n" %
                              (Dataset._meta.db_table, newdataset.name.replace("'", "\\'"), newdataset.description.replace("'", "\\'"), newdataset.namespace,
                               newdataset.fk_dst_cat_id.pk, newdataset.fk_dst_subcat_id.pk,
                               newdataset.created_at.strftime('%Y-%m-%d %H:%M:%S'),
                               newdataset.updated_at.strftime('%Y-%m-%d %H:%M:%S')))
        row_number = 0
        for row in data_ws.rows:
            row_number += 1
            data_values = []
            for cell in row:
                if row_number == 1:
                    if cell.value:
                        try:
                            last_available_year = int(cell.value)
                        except:
                            pass
                if row_number > 1:
                    column_number += 1
                    if column_number == 1:
                        country_name = unidecode.unidecode(cell.value)
                    if column_number == 2:
                        country_code = cell.value
                    if column_number == 3:
                        indicator_name = cell.value
                    if column_number == 4:
                        indicator_code = cell.value
                    if column_number > 4 and column_number < last_available_year - 1960 + 5:
                        if cell.value:
                            data_values.append({'value': cell.value, 'year': 1960 - 5 + column_number})
                    if column_number > 4 and column_number == last_available_year - 1960 + 5:
                        if len(data_values):
                            if indicator_code in category_vars[category]:
                                if not global_cat[indicator_code]['saved']:
                                    newsource = Source(name='World Bank – WDI: ' + global_cat[indicator_code]['name'],
                                                       description=source_template %
                                                       (global_cat[indicator_code]['category'],
                                                        global_cat[indicator_code]['unitofmeasure'],
                                                        indicator_code,
                                                        'World Bank – World Development Indicators',
                                                        global_cat[indicator_code]['source'],
                                                        '\n'.join([global_cat[indicator_code]['limitations'], global_cat[indicator_code]['sourcenotes'], global_cat[indicator_code]['comments'], global_cat[indicator_code]['concept'], global_cat[indicator_code]['sourcelinks'], global_cat[indicator_code]['weblinks']])
                                                        ),
                                                       datasetId=newdataset.pk)
                                    newsource.save()
                                    backup_sql_file.write("INSERT INTO %s (name, description, datasetId, created_at, updated_at) "
                                                          "VALUES ('%s', '%s', %s, '%s', '%s');\n" %
                                                          (Source._meta.db_table, newsource.name.replace("'", "\\'"),
                                                           newsource.description.replace("'", "\\'"),
                                                           newsource.datasetId,
                                                           newsource.created_at.strftime('%Y-%m-%d %H:%M:%S'),
                                                           newsource.updated_at.strftime('%Y-%m-%d %H:%M:%S')))
                                    global_cat[indicator_code]['source_object'] = newsource
                                    newvariable = Variable(name=global_cat[indicator_code]['name'], unit=global_cat[indicator_code]['unitofmeasure'] if global_cat[indicator_code]['unitofmeasure'] else '', description=global_cat[indicator_code]['description'],
                                                           code=indicator_code, timespan='1960-' + str(last_available_year), fk_dst_id=newdataset, fk_var_type_id=VariableType.objects.get(pk=4), sourceId=newsource)
                                    newvariable.save()
                                    backup_sql_file.write("INSERT INTO %s (name, unit, description, code, coverage, "
                                                          "timespan, fk_dst_id, fk_var_type_id, sourceId, created_at, "
                                                          "updated_at, uploaded_at) VALUES ('%s', '%s', '%s', '%s', '%s', '%s', %s, %s, %s, '%s', '%s', '%s');\n" %
                                                          (Variable._meta.db_table, newvariable.name.replace("'", "\\'"),
                                                           newvariable.unit, newvariable.description.replace("'", "\\'"),
                                                           newvariable.code, newvariable.coverage, newvariable.timespan,
                                                           newvariable.fk_dst_id.pk, newvariable.fk_var_type_id.pk,
                                                           newvariable.sourceId.pk, newvariable.created_at.strftime('%Y-%m-%d %H:%M:%S'),
                                                           newvariable.updated_at.strftime('%Y-%m-%d %H:%M:%S'),
                                                           newvariable.uploaded_at.strftime('%Y-%m-%d %H:%M:%S')))
                                    global_cat[indicator_code]['variable_object'] = newvariable
                                    global_cat[indicator_code]['saved'] = True
                                else:
                                    newvariable = global_cat[indicator_code]['variable_object']
                                for i in range(0, len(data_values)):
                                    data_values_tuple_list.append((data_values[i]['value'], data_values[i]['year'], country_name_entity_ref[country_code].pk, newvariable.pk))
                                if len(data_values_tuple_list) > 3000:  # insert when the length of the list goes over 3000
                                    with connection.cursor() as c:
                                        c.executemany(insert_string, data_values_tuple_list)
                                    backup_sql_file.write('INSERT INTO %s (value, year, fk_ent_id, fk_var_id) VALUES ' % DataValue._meta.db_table + ','.join(['("%s", %s, %s, %s)' % x for x in data_values_tuple_list]) + ';\n')
                                    data_values_tuple_list = []

            column_number = 0
            #if row_number % 10 == 0:
            #    time.sleep(0.001)  # this is done in order to not keep the CPU busy all the time, the delay after each 10th row is 1 millisecond

    newimport = ImportHistory(import_type='wdi', import_time=timezone.now().strftime('%Y-%m-%d %H:%M:%S'),
                              import_notes='Initial import of WDI',
                              import_state=json.dumps({'file_hash': file_checksum(wdi_downloads_save_location + 'wdi.zip')}))
    newimport.save()

    backup_sql_file.close()

else:
    last_import = import_history.last()

    if json.loads(last_import.import_state)['file_hash'] == file_checksum(wdi_downloads_save_location + 'wdi.zip'):
        logger.info('No updates available.')
        sys.exit('No updates available.')



print("--- %s seconds ---" % (time.time() - start_time))
