import sys
import os
import json
import unidecode
import time
import csv
import glob
sys.path.insert(1, os.path.join(sys.path[0], '..'))
import grapher_admin.wsgi
from grapher_admin.models import Entity, DatasetSubcategory, DatasetCategory, Dataset, Source, Variable, VariableType, DataValue
from importer.models import ImportHistory
from country_name_tool.models import CountryName
from django.conf import settings
from django.db import connection, transaction
from django.utils import timezone
from grapher_admin.views import write_dataset_csv
import datetime


oecd_downloads_save_location = settings.BASE_DIR + '/data/oecd/'

source_description = {
    'dataPublishedBy': "OECD.Stat",
    'dataPublisherSource': None,
    'link': "http://stats.oecd.org",
    'retrievedDate': timezone.now().strftime("%d-%B-%y"),
    'additionalInfo': None
}

# Some of the records in the database related to OECD entities had trailing spaces, which resulted in duplicate errors during importing
# for each in Entity.objects.filter(name__icontains='OECD'):
#     each.name = each.name.strip()
#     each.created_at = datetime.datetime.now()
#     each.save()

oecd_category_name_in_db = 'OECD.Stat Datasets'  # set the name of the root category of all data that will be imported by this script

new_datasets_list = []
existing_datasets_list = []

start_time = time.time()
row_number = 0
with transaction.atomic():

    existing_categories = DatasetCategory.objects.values('name')
    existing_categories_list = {item['name'] for item in existing_categories}

    if oecd_category_name_in_db not in existing_categories_list:
        the_category = DatasetCategory(name=oecd_category_name_in_db, fetcher_autocreated=True)
        the_category.save()
    else:
        the_category = DatasetCategory.objects.get(name=oecd_category_name_in_db)

    existing_subcategories = DatasetSubcategory.objects.filter(fk_dst_cat_id=the_category.pk).values('name')
    existing_subcategories_list = {item['name'] for item in existing_subcategories}

    existing_variables = Variable.objects.filter(fk_dst_id__namespace='oecd_stat').values('name')
    existing_variables_list = {item['name'] for item in existing_variables}

    dataset_name_to_object = {}
    source_name_to_object = {}

    variable_name_to_object = {}

    existing_entities = Entity.objects.values('name')
    existing_entities_list = {item['name'].lower() for item in existing_entities}

    country_tool_names = CountryName.objects.all()
    country_tool_names_dict = {}

    for each_country in country_tool_names:
        country_tool_names_dict[each_country.country_name.lower()] = each_country.owid_country

    c_name_entity_ref = {}  # this dict will hold the country names from excel and the appropriate entity object (this is used when saving the variables and their values)

    insert_string = 'INSERT into data_values (value, year, fk_ent_id, fk_var_id) VALUES (%s, %s, %s, %s)'  # this is used for constructing the query for mass inserting to the data_values table

    data_values_tuple_list = []

    for file in glob.glob(oecd_downloads_save_location + "/**/" + "/*.csv", recursive=True):
        duplicate_value_tracker = set()
        columns_to_process = []  # these columns will be considered for building variable names
        col_dict = {}  # temporary dictionary for storing the unique rows of values for each given column in a file
        new_col_dict = {}
        with open(file, 'rt', encoding='utf-8-sig') as f:
            print('Processing: %s' % file)

            reader = csv.DictReader(f)

            for onec in reader.fieldnames:
                if not onec.isupper():  # uppercase column names usually contain codes
                    if onec not in ['Value', 'Time', 'Year', 'Time period', 'Reference year', 'Country',
                                    'Reporting country', 'Flags', 'Flag Codes', 'Unit', 'Reference Period',
                                    'Reference Period Code', 'PowerCode', 'PowerCode Code']:  # we don't use these columns for constructing the variable names
                        columns_to_process.append(onec)

            for onecolumn in columns_to_process:
                col_dict[onecolumn] = []

            for row in reader:
                for onecol in columns_to_process:
                    if row[onecol] not in col_dict[onecol]:
                        col_dict[onecol].append(row[onecol])

            for key, value in col_dict.items():
                if len(value) == 1:
                    pass
                else:
                    new_col_dict[key] = len(value)

            f.seek(0)
            reader = csv.DictReader(f)

            filename = os.path.basename(file).replace('.csv', '')

            for row in reader:
                if row['Value']:
                    country_col = None
                    year_col_name = None

                    row_number += 1

                    thevarname = []
                    for key, value in new_col_dict.items():
                        if row[key]:
                            thevarname.append(row[key])
                    if thevarname:
                        variable_name = ' - '.join(thevarname)
                    else:
                        variable_name = filename

                    if len(variable_name) > 253:
                        variable_name = variable_name[:254]

                    # this variable is present in one of other files and contains the same values
                    if variable_name == 'Labour force - PER' and filename == 'Summary of annual labor statistics':
                        continue

                    if filename not in existing_subcategories_list:
                        the_subcategory = DatasetSubcategory(name=filename, fk_dst_cat_id=the_category)
                        the_subcategory.save()
                        newdataset = Dataset(name=filename,
                                             description='This is a dataset imported by the automated fetcher',
                                             namespace='oecd_stat', fk_dst_cat_id=the_category,
                                             fk_dst_subcat_id=the_subcategory)
                        newdataset.save()
                        dataset_name_to_object[filename] = newdataset
                        new_datasets_list.append(newdataset)
                        newsource = Source(name=filename,
                                           description=json.dumps(source_description),
                                           datasetId=newdataset.pk)
                        newsource.save()
                        source_name_to_object[filename] = newsource
                        existing_subcategories = DatasetSubcategory.objects.filter(fk_dst_cat_id=the_category.pk).values(
                            'name')
                        existing_subcategories_list = {item['name'] for item in existing_subcategories}
                    else:
                        if filename not in dataset_name_to_object:
                            newdataset = Dataset.objects.get(name=filename, fk_dst_cat_id=the_category)
                            dataset_name_to_object[filename] = newdataset
                            existing_datasets_list.append(newdataset)
                            newsource = Source.objects.get(name=filename, datasetId=newdataset.pk)
                            newsource.description = json.dumps(source_description)
                            newsource.save()
                            source_name_to_object[filename] = newsource

                    variable_code = None

                    if 'Unit' in reader.fieldnames:
                        if row['Unit']:
                            varunit = row['Unit']
                        else:
                            varunit = ''

                    if variable_name not in existing_variables_list:
                        newvariable = Variable(name=variable_name,
                                               unit=varunit,
                                               code=variable_code,
                                               fk_dst_id=dataset_name_to_object[filename], fk_var_type_id=VariableType.objects.get(pk=4),
                                               sourceId=source_name_to_object[filename])
                        newvariable.save()
                        variable_name_to_object[variable_name] = newvariable
                        existing_variables_list.add(newvariable.name)
                    else:
                        if variable_name not in variable_name_to_object:
                            newvariable = Variable.objects.get(name=variable_name, fk_dst_id=dataset_name_to_object[filename])
                            while DataValue.objects.filter(fk_var_id__pk=newvariable.pk).first():
                                with connection.cursor() as c:  # if we don't limit the deleted values, the db might just hang
                                    c.execute('DELETE FROM %s WHERE fk_var_id = %s LIMIT 10000;' %
                                              (DataValue._meta.db_table, newvariable.pk))
                            variable_name_to_object[variable_name] = newvariable

                    if 'Country' in reader.fieldnames:
                        country_col = row['Country'].strip()
                    elif 'Reporting country' in reader.fieldnames:
                        country_col = row['Reporting country'].strip()

                    if 'Year' in reader.fieldnames:
                        year_col_name = row['Year']
                    elif 'Time' in reader.fieldnames:
                        year_col_name = row['Time']
                    elif 'Reference year' in reader.fieldnames:
                        year_col_name = row['Reference year']
                    elif 'Time period' in reader.fieldnames:
                        year_col_name = row['Time period']

                    try:
                        year_col_name = int(year_col_name)
                    except:
                        if row['Reference Period'] == '':
                            print('Skipping one row: year column is empty.')
                            continue
                        else:
                            try:
                                year_col_name = int(row['Reference Period'])
                            except:
                                print('Skipping one row: year column is invalid - {}.'.format(row['Reference Period']))
                                continue

                    if country_col not in c_name_entity_ref:
                        if country_col == 'Global':
                            newentity = Entity.objects.get(name='World')
                        elif country_tool_names_dict.get(unidecode.unidecode(country_col.lower()), 0):
                            newentity = Entity.objects.get(
                                name=country_tool_names_dict[unidecode.unidecode(country_col.lower())].owid_name)
                        elif country_col.lower() in existing_entities_list:
                            newentity = Entity.objects.get(name__iexact=country_col)
                        else:
                            newentity = Entity(name=country_col, validated=False)
                            newentity.save()
                        c_name_entity_ref[country_col] = newentity

                    data_value = float(row['Value'])
                    if 'PowerCode' in reader.fieldnames:
                        if row['PowerCode']:
                            if row['PowerCode'] == 'Thousands':
                                data_value *= 1000
                            if row['PowerCode'] == 'Millions':
                                data_value *= 1000000

                    if ((int(year_col_name), c_name_entity_ref[country_col].pk, variable_name_to_object[variable_name].pk)) not in duplicate_value_tracker:
                        duplicate_value_tracker.add((int(year_col_name), c_name_entity_ref[country_col].pk, variable_name_to_object[variable_name].pk))
                        data_values_tuple_list.append((str(data_value), int(year_col_name), c_name_entity_ref[country_col].pk, variable_name_to_object[variable_name].pk))

                    if len(data_values_tuple_list) > 3000:  # insert when the length of the list goes over 3000

                        with connection.cursor() as c:
                            c.executemany(insert_string, data_values_tuple_list)
                        data_values_tuple_list = []

                    if row_number % 100 == 0:
                        time.sleep(0.001)  # this is done in order to not keep the CPU busy all the time, the delay after each 100th row is 1 millisecond

        if len(data_values_tuple_list):  # insert any leftover data_values
            with connection.cursor() as c:
                c.executemany(insert_string, data_values_tuple_list)
            data_values_tuple_list = []

# for dataset in existing_datasets_list:
#     write_dataset_csv(dataset.pk, dataset.name, dataset.name, 'gbd_cause_fetcher', '')
# for dataset in new_datasets_list:
#     write_dataset_csv(dataset.pk, dataset.name, None, 'gbd_cause_fetcher', '')

newimport = ImportHistory(import_type='oecd_stat', import_time=timezone.now().strftime('%Y-%m-%d %H:%M:%S'),
                                  import_notes='An oecd_stat import was performed',
                                  import_state='There are a total of %s oecd_stat variables after the import' % Variable.objects.filter(fk_dst_id__namespace='oecd_stat').count())
newimport.save()

print("--- %s seconds ---" % (time.time() - start_time))
