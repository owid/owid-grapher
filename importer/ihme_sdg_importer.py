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


ihme_sdg_downloads_save_location = settings.BASE_DIR + '/data/ihme_sdg/'

source_description = {
    'dataPublishedBy': "Global Burden of Disease Collaborative Network. Global Burden of Disease Study 2016 (GBD 2016) Health-related Sustainable Development Goals (SDG) Indicators 1990-2030. Seattle, United States: Institute for Health Metrics and Evaluation (IHME), 2017.",
    'dataPublisherSource': None,
    'link': "http://ghdx.healthdata.org/record/global-burden-disease-study-2016-gbd-2016-health-related-sustainable-development-goals-sdg",
    'retrievedDate': timezone.now().strftime("%d-%B-%y"),
    'additionalInfo': None
}

ihme_sdg_category_name_in_db = 'IHME SDG Datasets'  # set the name of the root category of all data that will be imported by this script

new_datasets_list = []
existing_datasets_list = []

start_time = time.time()
row_number = 0
with transaction.atomic():

    existing_categories = DatasetCategory.objects.values('name')
    existing_categories_list = {item['name'] for item in existing_categories}

    if ihme_sdg_category_name_in_db not in existing_categories_list:
        the_category = DatasetCategory(name=ihme_sdg_category_name_in_db, fetcher_autocreated=True)
        the_category.save()
    else:
        the_category = DatasetCategory.objects.get(name=ihme_sdg_category_name_in_db)

    existing_subcategories = DatasetSubcategory.objects.filter(categoryId=the_category.pk).values('name')
    existing_subcategories_list = {item['name'] for item in existing_subcategories}

    existing_variables = Variable.objects.filter(datasetId__namespace='ihme_sdg').values('name')
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

    insert_string = 'INSERT into data_values (value, year, entityId, variableId) VALUES (%s, %s, %s, %s)'  # this is used for constructing the query for mass inserting to the data_values table

    data_values_tuple_list = []

    subcategory_name = 'IHME SDG'

    if subcategory_name not in existing_subcategories_list:
        the_subcategory = DatasetSubcategory(name=subcategory_name, categoryId=the_category)
        the_subcategory.save()
        newdataset = Dataset(name=subcategory_name,
                             description='This is a dataset imported by the automated fetcher',
                             namespace='ihme_sdg', categoryId=the_category,
                             subcategoryId=the_subcategory)
        newdataset.save()
        dataset_name_to_object[subcategory_name] = newdataset
        new_datasets_list.append(newdataset)
        newsource = Source(name=subcategory_name,
                           description=json.dumps(source_description),
                           datasetId=newdataset.pk)
        newsource.save()
        source_name_to_object[subcategory_name] = newsource
        existing_subcategories = DatasetSubcategory.objects.filter(categoryId=the_category.pk).values(
            'name')
        existing_subcategories_list = {item['name'] for item in existing_subcategories}
    else:
        if subcategory_name not in dataset_name_to_object:
            newdataset = Dataset.objects.get(name=subcategory_name, categoryId=the_category)
            dataset_name_to_object[subcategory_name] = newdataset
            existing_datasets_list.append(newdataset)
            newsource = Source.objects.get(name=subcategory_name, datasetId=newdataset.pk)
            newsource.description = json.dumps(source_description)
            newsource.save()
            source_name_to_object[subcategory_name] = newsource

    for file in glob.glob(ihme_sdg_downloads_save_location + "/*.CSV"):
        with open(file, 'r', encoding='utf8') as f:
            print('Processing: %s' % file)
            reader = csv.DictReader(f)
            for row in reader:
                row_number += 1

                variable_name = '%s - %s' % (row['ihme_indicator_description'], row['estimate_type'])
                if row.get('unscaled_value'):
                    variable_name += ' - Unscaled'
                else:
                    variable_name += ' - Scaled'

                if variable_name not in existing_variables_list:
                    newvariable = Variable(name=variable_name,
                                           unit=row['indicator_unit'],
                                           code=None,
                                           datasetId=newdataset, variableTypeId=VariableType.objects.get(pk=4),
                                           sourceId=newsource)
                    newvariable.save()
                    variable_name_to_object[variable_name] = newvariable
                    existing_variables_list.add(newvariable.name)
                else:
                    if variable_name not in variable_name_to_object:
                        newvariable = Variable.objects.get(name=variable_name, datasetId=newdataset)
                        while DataValue.objects.filter(variableId__pk=newvariable.pk).first():
                            with connection.cursor() as c:  # if we don't limit the deleted values, the db might just hang
                                c.execute('DELETE FROM %s WHERE variableId = %s LIMIT 10000;' %
                                          (DataValue._meta.db_table, newvariable.pk))
                        variable_name_to_object[variable_name] = newvariable

                if row['location_name'] not in c_name_entity_ref:
                    if row['location_name'] == 'Global':
                        newentity = Entity.objects.get(name='World')
                    elif row['location_name'] == 'High-income North America':
                        newentity = Entity.objects.get(name='North America')
                    elif country_tool_names_dict.get(unidecode.unidecode(row['location_name'].lower()), 0):
                        newentity = Entity.objects.get(
                            name=country_tool_names_dict[unidecode.unidecode(row['location_name'].lower())].owid_name)
                    elif row['location_name'].lower() in existing_entities_list:
                        newentity = Entity.objects.get(name__iexact=row['location_name'])
                    else:
                        newentity = Entity(name=row['location_name'], validated=False)
                        newentity.save()
                    c_name_entity_ref[row['location_name']] = newentity

                if row.get('unscaled_value'):
                    data_value = row.get('unscaled_value')
                else:
                    data_value = row.get('scaled_value')

                data_values_tuple_list.append((str(float(data_value)), int(row['year_id']),
                                               c_name_entity_ref[row['location_name']].pk, variable_name_to_object[variable_name].pk))

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

newimport = ImportHistory(import_type='ihme_sdg', import_time=timezone.now().strftime('%Y-%m-%d %H:%M:%S'),
                                  import_notes='A ihme_sdg import was performed',
                                  import_state='There are a total of %s ihme_sdg variables after the import' % Variable.objects.filter(datasetId__namespace='ihme_sdg').count())
newimport.save()

print("--- %s seconds ---" % (time.time() - start_time))
