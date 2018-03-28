import sys
import os
import json
import unidecode
import time
import glob
import csv
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


unaids_downloads = settings.BASE_DIR + '/data/unaids'

source_description = {
    'dataPublishedBy': "AIDSinfo GAM DB",
    'dataPublisherSource': 'UNAIDS',
    'link': 'http://www.aidsinfoonline.org/gam/libraries/aspx/home.aspx',
    'retrievedDate': timezone.now().strftime("%d-%B-%y"),
    'additionalInfo': None
}

unaids_category_name_in_db = 'UNAIDS Datasets'  # set the name of the root category of all data that will be imported by this script

new_datasets_list = []
existing_datasets_list = []

start_time = time.time()
row_number = 0

duplicate_tracker = set()
with transaction.atomic():

    existing_categories = DatasetCategory.objects.values('name')
    existing_categories_list = {item['name'] for item in existing_categories}

    if unaids_category_name_in_db not in existing_categories_list:
        the_category = DatasetCategory(name=unaids_category_name_in_db, fetcher_autocreated=True)
        the_category.save()
    else:
        the_category = DatasetCategory.objects.get(name=unaids_category_name_in_db)

    existing_subcategories = DatasetSubcategory.objects.filter(categoryId=the_category.pk).values('name')
    existing_subcategories_list = {item['name'] for item in existing_subcategories}

    existing_variables = Variable.objects.filter(datasetId__namespace='unaids').values('name')
    existing_variables_list = {item['name'].lower() for item in existing_variables}

    dataset_name_to_object = {item.name: item for item in Dataset.objects.filter(namespace='unaids')}
    source_name_to_object = {item.name: item for item in Source.objects.filter(datasetId__in=[x.pk for x in Dataset.objects.filter(namespace='unaids')])}

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

    row_number = 0

    subcategory_name = 'UNAIDS'

    if subcategory_name not in existing_subcategories_list:
        the_subcategory = DatasetSubcategory(name=subcategory_name,
                                             categoryId=the_category)
        the_subcategory.save()

        existing_subcategories = DatasetSubcategory.objects.filter(categoryId=the_category.pk).values(
            'name')
        existing_subcategories_list = {item['name'] for item in existing_subcategories}
    else:
        the_subcategory = DatasetSubcategory.objects.get(name=subcategory_name,
                                                         categoryId=the_category)

    if subcategory_name not in dataset_name_to_object:
        newdataset = Dataset(name=subcategory_name,
                             description='This is a dataset imported by the automated fetcher',
                             namespace='unaids', categoryId=the_category,
                             subcategoryId=the_subcategory)
        newdataset.save()
        dataset_name_to_object[subcategory_name] = newdataset
        new_datasets_list.append(newdataset)
    else:
        newdataset = Dataset.objects.get(name=subcategory_name, categoryId=the_category)

    source_name = 'UNAIDS'
    if source_name not in source_name_to_object:
        newsource = Source(name=source_name,
                           description=json.dumps(source_description),
                           datasetId=newdataset.pk)
        newsource.save()
        source_name_to_object[source_name] = newsource
    else:
        newsource = Source.objects.get(name=source_name, datasetId=newdataset.pk)
        newsource.description = json.dumps(source_description)
        newsource.save()
        source_name_to_object[source_name] = newsource

    for eachfile in glob.glob(unaids_downloads + '/*.csv'):
        print("Processing: {}".format(eachfile))
        with open(eachfile, mode='rt', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)

            for row in reader:
                row_number += 1

                variable_name = "{} - {}".format(row['Indicator'].strip(), row['Subgroup'].strip())
                if variable_name.lower() not in existing_variables_list:
                    newvariable = Variable(name=variable_name,
                                           unit=row['Unit'],
                                           code=None,
                                           datasetId=newdataset, variableTypeId=VariableType.objects.get(pk=4),
                                           sourceId=source_name_to_object[source_name])
                    newvariable.save()
                    variable_name_to_object[variable_name.lower()] = newvariable
                    existing_variables_list.add(newvariable.name.lower())
                else:
                    if variable_name.lower() not in variable_name_to_object:
                        newvariable = Variable.objects.get(name=variable_name, datasetId=newdataset)
                        while DataValue.objects.filter(variableId__pk=newvariable.pk).first():
                            with connection.cursor() as c:  # if we don't limit the deleted values, the db might just hang
                                c.execute('DELETE FROM %s WHERE variableId = %s LIMIT 10000;' %
                                          (DataValue._meta.db_table, newvariable.pk))
                        variable_name_to_object[variable_name.lower()] = newvariable

                country_col = row['Area'].strip()

                if country_col not in c_name_entity_ref:
                    if country_col == 'All countries':
                        newentity = Entity.objects.get(name='World')
                    elif country_col == 'C√¥te d\'Ivoire':
                        newentity = Entity.objects.get(name='Cote d\'Ivoire')
                    elif country_tool_names_dict.get(unidecode.unidecode(country_col.lower()), 0):
                        newentity = Entity.objects.get(
                            name=country_tool_names_dict[unidecode.unidecode(country_col.lower())].owid_name)
                    elif country_col.lower() in existing_entities_list:
                        newentity = Entity.objects.get(name__iexact=country_col)
                    else:
                        newentity = Entity(name=country_col, validated=False)
                        newentity.save()
                    c_name_entity_ref[country_col] = newentity
                try:
                    if (int(row['Time Period']), c_name_entity_ref[country_col].pk, variable_name_to_object[variable_name.lower()].pk) not in duplicate_tracker:
                        data_values_tuple_list.append((str(float(row['Data Value'])), int(row['Time Period']),
                                                       c_name_entity_ref[country_col].pk,
                                                       variable_name_to_object[variable_name.lower()].pk))
                        duplicate_tracker.add((int(row['Time Period']),
                                                   c_name_entity_ref[country_col].pk,
                                                   variable_name_to_object[variable_name.lower()].pk))
                    else:
                        print(variable_name, country_col, row['Time Period'])
                except ValueError:
                    pass

                if len(data_values_tuple_list) > 3000:  # insert when the length of the list goes over 3000

                    with connection.cursor() as c:
                        c.executemany(insert_string, data_values_tuple_list)
                    data_values_tuple_list = []

    if len(data_values_tuple_list):  # insert any leftover data_values
        with connection.cursor() as c:
            c.executemany(insert_string, data_values_tuple_list)
        data_values_tuple_list = []

# for dataset in existing_datasets_list:
#     write_dataset_csv(dataset.pk, dataset.name, dataset.name, 'gbd_cause_fetcher', '')
# for dataset in new_datasets_list:
#     write_dataset_csv(dataset.pk, dataset.name, None, 'gbd_cause_fetcher', '')

newimport = ImportHistory(import_type='unaids', import_time=timezone.now().strftime('%Y-%m-%d %H:%M:%S'),
                                  import_notes='A unaids import was performed',
                                  import_state='There are a total of %s unaids variables after the import' % Variable.objects.filter(datasetId__namespace='unaids').count())
newimport.save()

print("--- %s seconds ---" % (time.time() - start_time))
