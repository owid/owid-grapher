import sys
import os
import json
import unidecode
import time
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
from openpyxl import load_workbook


penn_world_downloads_file = settings.BASE_DIR + '/data/penn_world/pwt_edited.xlsx'

source_description = {
    'dataPublishedBy': "University of Groningen",
    'dataPublisherSource': 'Feenstra, Robert C., Robert Inklaar and Marcel P. Timmer (2015), "The Next Generation of the Penn World Table" American Economic Review, 105(10), 3150-3182, available for download at www.ggdc.net/pwt',
    'link': 'https://www.rug.nl/ggdc/productivity/pwt/',
    'retrievedDate': timezone.now().strftime("%d-%B-%y"),
    'additionalInfo': None
}

penn_world_category_name_in_db = 'Penn World Table Datasets'  # set the name of the root category of all data that will be imported by this script

new_datasets_list = []
existing_datasets_list = []

start_time = time.time()
row_number = 0


with transaction.atomic():

    existing_categories = DatasetCategory.objects.values('name')
    existing_categories_list = {item['name'] for item in existing_categories}

    if penn_world_category_name_in_db not in existing_categories_list:
        the_category = DatasetCategory(name=penn_world_category_name_in_db, fetcher_autocreated=True)
        the_category.save()
    else:
        the_category = DatasetCategory.objects.get(name=penn_world_category_name_in_db)

    existing_subcategories = DatasetSubcategory.objects.filter(categoryId=the_category.pk).values('name')
    existing_subcategories_list = {item['name'] for item in existing_subcategories}

    existing_variables = Variable.objects.filter(datasetId__namespace='penn_world').values('name')
    existing_variables_list = {item['name'].lower() for item in existing_variables}

    dataset_name_to_object = {item.name: item for item in Dataset.objects.filter(namespace='penn_world')}
    source_name_to_object = {item.name: item for item in Source.objects.filter(datasetId__in=[x.pk for x in Dataset.objects.filter(namespace='penn_world')])}

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

    wb = load_workbook(filename=penn_world_downloads_file, read_only=True)
    ws = wb['Data']

    row_number = 0
    column_number = 0
    col_number_to_var = {}

    subcategory_name = 'Penn World Table'

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
                             namespace='penn_world', categoryId=the_category,
                             subcategoryId=the_subcategory)
        newdataset.save()
        dataset_name_to_object[subcategory_name] = newdataset
        new_datasets_list.append(newdataset)
    else:
        newdataset = Dataset.objects.get(name=subcategory_name, categoryId=the_category)

    for row in ws.rows:
        row_number += 1
        for cell in row:
            column_number += 1

            if row_number == 2 and column_number > 3:
                if cell.value:
                    col_number_to_var[column_number] = {
                        "varname": cell.value,
                        "unit": ''
                    }

            if row_number == 3 and column_number > 3:
                if cell.value:
                    col_number_to_var[column_number]['unit'] = cell.value

            if row_number == 4 and column_number == 1:
                for key, value in col_number_to_var.items():
                    source_name = value['varname']
                    if source_name == 'Productivity (GDP per hour worked)':
                        source_description['additionalInfo'] = 'This variable has been calculated by Our World in Data, using Penn metrics for total GDP, the number of the given population engaged in work, and the average hours per worker engaged'
                    else:
                        source_description['additionalInfo'] = None
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

                    variable_name = value['varname']
                    if variable_name.lower() not in existing_variables_list:
                        newvariable = Variable(name=variable_name,
                                               unit=value['unit'],
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

            if row_number > 3:
                if column_number == 2:
                    country_col = cell.value
                if column_number == 3:
                    year = cell.value
                if column_number > 3:
                    if cell.value:
                        data_value = float(cell.value)
                        if country_col not in c_name_entity_ref:
                            if country_col == 'Global':
                                newentity = Entity.objects.get(name='World')
                            elif country_col == 'D.R. of the Congo':
                                newentity = Entity.objects.get(name='Democratic Republic of Congo')
                            elif country_col == 'U.R. of Tanzania: Mainland':
                                newentity = Entity.objects.get(name='Tanzania')
                            elif country_col == 'TFYR of Macedonia':
                                newentity = Entity.objects.get(name='Macedonia')
                            elif country_col == 'Lao People\'s DR':
                                newentity = Entity.objects.get(name='Laos')
                            elif country_tool_names_dict.get(unidecode.unidecode(country_col.lower()), 0):
                                newentity = Entity.objects.get(
                                    name=country_tool_names_dict[unidecode.unidecode(country_col.lower())].owid_name)
                            elif country_col.lower() in existing_entities_list:
                                newentity = Entity.objects.get(name__iexact=country_col)
                            else:
                                newentity = Entity(name=country_col, validated=False)
                                newentity.save()
                            c_name_entity_ref[country_col] = newentity

                        data_values_tuple_list.append((str(data_value), int(year),
                                                       c_name_entity_ref[country_col].pk,
                                                       variable_name_to_object[col_number_to_var[column_number]['varname'].lower()].pk))

                        if len(data_values_tuple_list) > 3000:  # insert when the length of the list goes over 3000

                            with connection.cursor() as c:
                                c.executemany(insert_string, data_values_tuple_list)
                            data_values_tuple_list = []

        column_number = 0

    if len(data_values_tuple_list):  # insert any leftover data_values
        with connection.cursor() as c:
            c.executemany(insert_string, data_values_tuple_list)
        data_values_tuple_list = []

# for dataset in existing_datasets_list:
#     write_dataset_csv(dataset.pk, dataset.name, dataset.name, 'gbd_cause_fetcher', '')
# for dataset in new_datasets_list:
#     write_dataset_csv(dataset.pk, dataset.name, None, 'gbd_cause_fetcher', '')

newimport = ImportHistory(import_type='penn_world', import_time=timezone.now().strftime('%Y-%m-%d %H:%M:%S'),
                                  import_notes='A penn_world import was performed',
                                  import_state='There are a total of %s penn_world variables after the import' % Variable.objects.filter(datasetId__namespace='penn_world').count())
newimport.save()

print("--- %s seconds ---" % (time.time() - start_time))
