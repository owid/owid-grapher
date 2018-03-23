import sys
import os
import json
import unidecode
import time
import csv
import glob
sys.path.insert(1, os.path.join(sys.path[0], '..'))
import grapher_admin.wsgi
from grapher_admin.models import Entity, DatasetSubcategory, DatasetCategory, Dataset, Source, Variable, VariableType,\
    DataValue
from importer.models import ImportHistory
from country_name_tool.models import CountryName
from django.conf import settings
from django.db import connection, transaction
from django.utils import timezone
from grapher_admin.views import write_dataset_csv
import requests
import lxml.html
from lxml import etree as ET

####################################################################################################
# the files for WHO GHO datasets should be downloaded before running this script,
# and should be put in appropriate directories as shown in code below
# the link for downloading the csv files (replace {} with dataset name) - http://apps.who.int/gho/athena/data/data-text.csv?target=GHO/{}&profile=text&filter=COUNTRY:*;REGION:*
# list of datasets is available at http://apps.who.int/gho/athena/data/GHO/
# and the link for metadata files is http://apps.who.int/gho/indicators/imr.jsp?id={}
# you will also need to create a who_data_selection.csv file and put it in the root data directory
# the file should contain three columns - code, name, category for each dataset csv file
####################################################################################################


who_save_location = settings.BASE_DIR + '/data/who_csv'
who_metadata_location = settings.BASE_DIR + '/data/who_metadata'
who_dataset_list_location = settings.BASE_DIR + '/data/who_data_selection.csv'

source_description = {
    'dataPublishedBy': "World Health Organization Global Health Observatory (GHO)",
    'dataPublisherSource': None,
    'link': "http://apps.who.int/gho/data/node.home",
    'retrievedDate': timezone.now().strftime("%d-%B-%y"),
    'additionalInfo': None
}

who_gho_category_name_in_db = 'WHO GHO Datasets'  # set the name of the root category of all data that will be imported by this script

new_datasets_list = []
existing_datasets_list = []

start_time = time.time()
dataset_list_dict = {}
duplicate_tracker = set()
standard_fields = ['Data Source', 'LOCATION', 'PUBLISH STATES', 'Year', 'WHO region', 'World Bank income group',
                   'Country', 'Display Value', 'Numeric', 'Low', 'High', 'Comments']

with open(who_dataset_list_location, 'rt', encoding='utf-8-sig') as f:
    reader = csv.DictReader(f)
    for row in reader:
        dataset_list_dict[row['code']] = {'category': row['category']}

with transaction.atomic():

    existing_categories = DatasetCategory.objects.values('name')
    existing_categories_list = {item['name'] for item in existing_categories}

    if who_gho_category_name_in_db not in existing_categories_list:
        the_category = DatasetCategory(name=who_gho_category_name_in_db, fetcher_autocreated=True)
        the_category.save()
    else:
        the_category = DatasetCategory.objects.get(name=who_gho_category_name_in_db)

    existing_subcategories = DatasetSubcategory.objects.filter(categoryId=the_category.pk).values('name')
    existing_subcategories_list = {item['name'] for item in existing_subcategories}

    existing_variables = Variable.objects.filter(datasetId__namespace='who_gho').values('name')
    existing_variables_list = {item['name'].lower() for item in existing_variables}

    dataset_name_to_object = {}
    source_name_to_object = {x.name.lower(): x for x in Source.objects.filter(
        datasetId__in=[dst.pk for dst in Dataset.objects.filter(namespace='who_gho')])}

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

    for file in glob.glob(who_save_location + "/*.csv"):
        row_number = 0
        columns_to_process = []  # these columns will be considered for building variable names

        file_name = os.path.basename(file).replace('.csv', '')

        if file_name in dataset_list_dict:
            print('Processing: %s' % file)
            # now we are going to read the metadata files
            metadata_string = ''
            if os.path.exists(who_metadata_location + '/' + file_name + '.xml'):
                with open(who_metadata_location + '/' + file_name + '.xml', mode='rb') as f:
                    list_of_links = ET.fromstring(f.read()).xpath('//*[@name]')
                    for onelink in list_of_links:
                        if onelink.xpath('./text()'):
                            metadata_string += onelink.xpath('./@name')[0] + '\n'
                            metadata_string += onelink.xpath('./text()')[0] + '\n\n' if onelink.xpath('./text()') else ''
            else:
                source_description['additionalInfo'] = None

            source_description['additionalInfo'] = metadata_string if metadata_string else None
            with open(file, 'r', encoding='utf8') as f:

                reader = csv.DictReader(f)

                for eachone in reader.fieldnames:
                    if eachone not in standard_fields:
                        columns_to_process.append(eachone)

                for row in reader:
                    row_number += 1

                    subcategory_name = dataset_list_dict[file_name]['category']
                    if subcategory_name not in existing_subcategories_list:
                        the_subcategory = DatasetSubcategory(name=subcategory_name, categoryId=the_category)
                        the_subcategory.save()
                        newdataset = Dataset(name=subcategory_name,
                                             description='This is a dataset imported by the automated fetcher',
                                             namespace='who_gho', categoryId=the_category,
                                             subcategoryId=the_subcategory)
                        newdataset.save()
                        dataset_name_to_object[subcategory_name] = newdataset
                        new_datasets_list.append(newdataset)
                        existing_subcategories = DatasetSubcategory.objects.filter(categoryId=the_category.pk).values(
                            'name')
                        existing_subcategories_list = {item['name'] for item in existing_subcategories}
                    else:
                        if subcategory_name not in dataset_name_to_object:
                            newdataset = Dataset.objects.get(name=subcategory_name, categoryId=the_category)
                            dataset_name_to_object[subcategory_name] = newdataset
                            existing_datasets_list.append(newdataset)

                    if row_number == 1:
                        source_name = row['Indicator']
                        if source_name.lower() not in source_name_to_object:
                            newsource = Source(name=source_name,
                                               description=json.dumps(source_description),
                                               datasetId=dataset_name_to_object[subcategory_name].pk)
                            newsource.save()
                            source_name_to_object[source_name.lower()] = newsource
                        else:
                            newsource = Source.objects.get(name=source_name, datasetId__in=[x.pk for x in
                                                                                            Dataset.objects.filter(
                                                                                                namespace='who_gho')])
                            newsource.description = json.dumps(source_description)
                            newsource.save()
                    # discarding values for subnational regions
                    if row.get('Subnational region'):
                        continue

                    thevarname = []
                    for key in columns_to_process:
                        if row[key]:
                            thevarname.append("{}:{}".format(key, row[key]))
                    variable_name = ' - '.join(thevarname)

                    if variable_name.lower() not in existing_variables_list:

                        newvariable = Variable(name=variable_name,
                                               unit='',
                                               datasetId=dataset_name_to_object[subcategory_name],
                                               variableTypeId=VariableType.objects.get(pk=4),
                                               sourceId=source_name_to_object[source_name.lower()])
                        newvariable.save()
                        variable_name_to_object[variable_name.lower()] = newvariable
                        existing_variables_list.add(newvariable.name.lower())
                    else:
                        if variable_name.lower() not in variable_name_to_object:
                            newvariable = Variable.objects.get(name=variable_name,
                                                               datasetId=dataset_name_to_object[subcategory_name])
                            newvariable.sourceId = source_name_to_object[source_name.lower()]
                            newvariable.save()
                            while DataValue.objects.filter(variableId__pk=newvariable.pk).first():
                                with connection.cursor() as c:  # if we don't limit the deleted values, the db might just hang
                                    c.execute('DELETE FROM %s WHERE variableId = %s LIMIT 10000;' %
                                              (DataValue._meta.db_table, newvariable.pk))
                            variable_name_to_object[variable_name.lower()] = newvariable

                    country_name = row['Country']
                    if 'LIFE' in file_name:
                        if row['Country'] == 'Bolivia (Plurinational State of)Bolivia (Plurinational State of)':
                            country_name = 'Bolivia (Plurinational State of)'
                        elif row['Country'] == 'Micronesia (Federated States of)Micronesia (Federated States of)':
                            country_name = 'Micronesia (Federated States of)'
                        elif row['Country'] == 'Iran (Islamic Republic of)Iran (Islamic Republic of)':
                            country_name = 'Iran (Islamic Republic of)'
                        elif row['Country'] == 'Venezuela (Bolivarian Republic of)Venezuela (Bolivarian Republic of)':
                            country_name = 'Venezuela (Bolivarian Republic of)'
                        else:
                            xx = 0
                            # the files with the code LIFE had errors in their Country column
                            # below code fixes the country names for those files
                            for eachch in row['Country']:
                                if eachch.isupper():
                                    if row['Country'][xx-1].islower():
                                        country_name = row['Country'][:xx]
                                xx += 1

                    if country_name not in c_name_entity_ref:
                        if country_name == 'Global':
                            newentity = Entity.objects.get(name='World')
                        elif country_tool_names_dict.get(unidecode.unidecode(country_name.lower()), 0):
                            newentity = Entity.objects.get(
                                    name=country_tool_names_dict[unidecode.unidecode(country_name.lower())].owid_name)
                        elif country_name.lower() in existing_entities_list:
                            newentity = Entity.objects.get(name__iexact=country_name)
                        else:
                            newentity = Entity(name=country_name, validated=False)
                            newentity.save()
                        c_name_entity_ref[country_name] = newentity

                    if row['Numeric']:
                        try:
                            if (int(row['Year']), c_name_entity_ref[country_name].pk, variable_name_to_object[variable_name.lower()].pk) not in duplicate_tracker:
                                duplicate_tracker.add((int(row['Year']), c_name_entity_ref[country_name].pk, variable_name_to_object[variable_name.lower()].pk))
                                data_values_tuple_list.append((str(float(row['Numeric'])), int(row['Year']),
                                                           c_name_entity_ref[country_name].pk, variable_name_to_object[variable_name.lower()].pk))
                            else:
                                print("Duplicate value for {}: {}".format(variable_name, unidecode.unidecode(row['Year'] + ' ' + country_name)))
                        except:
                            print('Couldn\'t parse year: {}'.format(unidecode.unidecode(row.get('Year'))) if row.get('Year') else ' ')

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
#     write_dataset_csv(dataset.pk, dataset.name, dataset.name, 'un_sdg_fetcher', '')
# for dataset in new_datasets_list:
#     write_dataset_csv(dataset.pk, dataset.name, None, 'un_sdg_fetcher', '')

newimport = ImportHistory(import_type='who_gho', import_time=timezone.now().strftime('%Y-%m-%d %H:%M:%S'),
                                  import_notes='A who_gho import was performed',
                                  import_state='There are a total of %s who_gho variables after the import' % Variable.objects.filter(datasetId__namespace='who_gho').count())
newimport.save()

print("--- %s seconds ---" % (time.time() - start_time))
