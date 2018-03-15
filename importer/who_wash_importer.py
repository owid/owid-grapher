import sys
import os
import json
import time
sys.path.insert(1, os.path.join(sys.path[0], '..'))
import grapher_admin.wsgi
from openpyxl import load_workbook
from grapher_admin.models import Entity, DatasetSubcategory, DatasetCategory, Dataset, Source, Variable, VariableType, DataValue
from importer.models import ImportHistory
from country_name_tool.models import CountryName
from django.conf import settings
from django.db import connection, transaction
from django.utils import timezone
from django.urls import reverse
from grapher_admin.views import write_dataset_csv
import unidecode

who_wash_downloads_save_location = settings.BASE_DIR + '/data/who_wash/'

wb = load_workbook(who_wash_downloads_save_location + 'dataset.xlsx', read_only=True)

source_description = {
    'dataPublishedBy': "WHO/UNICEF Joint Monitoring Programme for Water Supply, Sanitation and Hygiene (JMP)",
    'dataPublisherSource': None,
    'link': "https://washdata.org/data",
    'retrievedDate': timezone.now().strftime("%d-%B-%y"),
    'additionalInfo': None
}

sections = ['Water', 'Sanitation', 'Hygiene']

columns = {
    'Sanitation': {
        1: 'Country',
        3: 'Year',
        4: 'Population',
        5: 'Percent urban',
        6: {
            'name': 'At least basic',
            'type': 'National'
        },
        7: {
            'name': 'Limited (shared)',
            'type': 'National'
        },
        8: {
            'name': 'Unimproved',
            'type': 'National'
        },
        9: {
            'name': 'Open defecation',
            'type': 'National'
        },
        10: {
            'name': 'Annual rate of change in basic',
            'type': 'National'
        },
        11: {
            'name': 'Annual rate of change in open defecation',
            'type': 'National'
        },
        12: {
            'name': 'At least basic',
            'type': 'Rural'
        },
        13: {
            'name': 'Limited (shared)',
            'type': 'Rural'
        },
        14: {
            'name': 'Unimproved',
            'type': 'Rural'
        },
        15: {
            'name': 'Open defecation',
            'type': 'Rural'
        },
        16: {
            'name': 'Annual rate of change in basic',
            'type': 'Rural'
        },
        17: {
            'name': 'Annual rate of change in open defecation',
            'type': 'Rural'
        },
        18: {
            'name': 'At least basic',
            'type': 'Urban'
        },
        19: {
            'name': 'Limited (shared)',
            'type': 'Urban'
        },
        20: {
            'name': 'Unimproved',
            'type': 'Urban'
        },
        21: {
            'name': 'Open defecation',
            'type': 'Urban'
        },
        22: {
            'name': 'Annual rate of change in basic',
            'type': 'Urban'
        },
        23: {
            'name': 'Annual rate of change in open defecation',
            'type': 'Urban'
        },
        24: {
            'name': 'Proportion of population using improved sanitation facilities (excluding shared) - Safely managed',
            'type': 'National'
        },
        25: {
            'name': 'Proportion of population using improved sanitation facilities (excluding shared) - Disposed in situ',
            'type': 'National'
        },
        26: {
            'name': 'Proportion of population using improved sanitation facilities (excluding shared) - Emptied and treated',
            'type': 'National'
        },
        27: {
            'name': 'Proportion of population using improved sanitation facilities (excluding shared) - Wastewater treated',
            'type': 'National'
        },
        28: {
            'name': 'Proportion of population using improved sanitation facilities (excluding shared) - Latrines and other',
            'type': 'National'
        },
        29: {
            'name': 'Proportion of population using improved sanitation facilities (excluding shared) - Septic tanks',
            'type': 'National'
        },
        30: {
            'name': 'Proportion of population using improved sanitation facilities (excluding shared) - Sewer connections',
            'type': 'National'
        },
        31: {
            'name': 'Proportion of population using improved sanitation facilities (excluding shared) - Safely managed',
            'type': 'Rural'
        },
        32: {
            'name': 'Proportion of population using improved sanitation facilities (excluding shared) - Disposed in situ',
            'type': 'Rural'
        },
        33: {
            'name': 'Proportion of population using improved sanitation facilities (excluding shared) - Emptied and treated',
            'type': 'Rural'
        },
        34: {
            'name': 'Proportion of population using improved sanitation facilities (excluding shared) - Wastewater treated',
            'type': 'Rural'
        },
        35: {
            'name': 'Proportion of population using improved sanitation facilities (excluding shared) - Latrines and other',
            'type': 'Rural'
        },
        36: {
            'name': 'Proportion of population using improved sanitation facilities (excluding shared) - Septic tanks',
            'type': 'Rural'
        },
        37: {
            'name': 'Proportion of population using improved sanitation facilities (excluding shared) - Sewer connections',
            'type': 'Rural'
        },
        38: {
            'name': 'Proportion of population using improved sanitation facilities (excluding shared) - Safely managed',
            'type': 'Urban'
        },
        39: {
            'name': 'Proportion of population using improved sanitation facilities (excluding shared) - Disposed in situ',
            'type': 'Urban'
        },
        40: {
            'name': 'Proportion of population using improved sanitation facilities (excluding shared) - Emptied and treated',
            'type': 'Urban'
        },
        41: {
            'name': 'Proportion of population using improved sanitation facilities (excluding shared) - Wastewater treated',
            'type': 'Urban'
        },
        42: {
            'name': 'Proportion of population using improved sanitation facilities (excluding shared) - Latrines and other',
            'type': 'Urban'
        },
        43: {
            'name': 'Proportion of population using improved sanitation facilities (excluding shared) - Septic tanks',
            'type': 'Urban'
        },
        44: {
            'name': 'Proportion of population using improved sanitation facilities (excluding shared) - Sewer connections',
            'type': 'Urban'
        },

    },
    'Hygiene': {
        1: 'Country',
        3: 'Year',
        4: 'Population',
        5: 'Percent urban',
        6: {
            'name': 'Basic',
            'type': 'National'
        },
        7: {
            'name': 'Limited (without water or soap)',
            'type': 'National'
        },
        8: {
            'name': 'No facility',
            'type': 'National'
        },
        9: {
            'name': 'Basic',
            'type': 'Rural'
        },
        10: {
            'name': 'Limited (without water or soap)',
            'type': 'Rural'
        },
        11: {
            'name': 'No facility',
            'type': 'Rural'
        },
        12: {
            'name': 'Basic',
            'type': 'Urban'
        },
        13: {
            'name': 'Limited (without water or soap)',
            'type': 'Urban'
        },
        14: {
            'name': 'No facility',
            'type': 'Urban'
        }
    },
    'Water': {
        1: 'Country',
        3: 'Year',
        4: 'Population',
        5: 'Percent urban',
        6: {
            'name': 'At least basic',
            'type': 'National'
        },
        7: {
            'name': 'Limited (more than 30 mins)',
            'type': 'National'
        },
        8: {
            'name': 'Unimproved',
            'type': 'National'
        },
        9: {
            'name': 'Surface water',
            'type': 'National'
        },
        10: {
            'name': 'Annual rate of change in basic',
            'type': 'National'
        },
        11: {
            'name': 'At least basic',
            'type': 'Rural'
        },
        12: {
            'name': 'Limited (more than 30 mins)',
            'type': 'Rural'
        },
        13: {
            'name': 'Unimproved',
            'type': 'Rural'
        },
        14: {
            'name': 'Surface water',
            'type': 'Rural'
        },
        15: {
            'name': 'Annual rate of change in basic',
            'type': 'Rural'
        },
        16: {
            'name': 'At least basic',
            'type': 'Urban'
        },
        17: {
            'name': 'Limited (more than 30 mins)',
            'type': 'Urban'
        },
        18: {
            'name': 'Unimproved',
            'type': 'Urban'
        },
        19: {
            'name': 'Surface water',
            'type': 'Urban'
        },
        20: {
            'name': 'Annual rate of change in basic',
            'type': 'Urban'
        },
        21: {
            'name': 'Proportion of population using improved water supplies - Safely managed',
            'type': 'National'
        },
        22: {
            'name': 'Proportion of population using improved water supplies - Accessible on premises',
            'type': 'National'
        },
        23: {
            'name': 'Proportion of population using improved water supplies - Available when needed',
            'type': 'National'
        },
        24: {
            'name': 'Proportion of population using improved water supplies - Free from contamination',
            'type': 'National'
        },
        25: {
            'name': 'Proportion of population using improved water supplies - Piped',
            'type': 'National'
        },
        26: {
            'name': 'Proportion of population using improved water supplies - Non-piped',
            'type': 'National'
        },
        27: {
            'name': 'Proportion of population using improved water supplies - Safely managed',
            'type': 'Rural'
        },
        28: {
            'name': 'Proportion of population using improved water supplies - Accessible on premises',
            'type': 'Rural'
        },
        29: {
            'name': 'Proportion of population using improved water supplies - Available when needed',
            'type': 'Rural'
        },
        30: {
            'name': 'Proportion of population using improved water supplies - Free from contamination',
            'type': 'Rural'
        },
        31: {
            'name': 'Proportion of population using improved water supplies - Piped',
            'type': 'Rural'
        },
        32: {
            'name': 'Proportion of population using improved water supplies - Non-piped',
            'type': 'Rural'
        },
        33: {
            'name': 'Proportion of population using improved water supplies - Safely managed',
            'type': 'Urban'
        },
        34: {
            'name': 'Proportion of population using improved water supplies - Accessible on premises',
            'type': 'Urban'
        },
        35: {
            'name': 'Proportion of population using improved water supplies - Available when needed',
            'type': 'Urban'
        },
        36: {
            'name': 'Proportion of population using improved water supplies - Free from contamination',
            'type': 'Urban'
        },
        37: {
            'name': 'Proportion of population using improved water supplies - Piped',
            'type': 'Urban'
        },
        38: {
            'name': 'Proportion of population using improved water supplies - Non-piped',
            'type': 'Urban'
        }
    }
}

who_wash_category_name_in_db = 'WHO WASH Datasets'  # set the name of the root category of all data that will be imported by this script

start_time = time.time()

with transaction.atomic():

    existing_categories = DatasetCategory.objects.values('name')
    existing_categories_list = {item['name'] for item in existing_categories}

    if who_wash_category_name_in_db not in existing_categories_list:
        the_category = DatasetCategory(name=who_wash_category_name_in_db, fetcher_autocreated=True)
        the_category.save()
    else:
        the_category = DatasetCategory.objects.get(name=who_wash_category_name_in_db)

    existing_subcategories = DatasetSubcategory.objects.filter(categoryId=the_category.pk).values('name')
    existing_subcategories_list = {item['name'] for item in existing_subcategories}

    existing_variables = Variable.objects.filter(datasetId__namespace='who_wash').values('name')
    existing_variables_list = {item['name'].lower() for item in existing_variables}

    dataset_name_to_object = {item.name: item for item in Dataset.objects.filter(namespace='who_wash')}
    source_name_to_object = {item.name: item for item in Source.objects.filter(
        datasetId__in=[x.pk for x in Dataset.objects.filter(namespace='who_wash')])}

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

    for section in sections:
        if section not in existing_subcategories_list:
            the_subcategory = DatasetSubcategory(name=section,
                                                 categoryId=the_category)
            the_subcategory.save()

            existing_subcategories = DatasetSubcategory.objects.filter(categoryId=the_category.pk).values(
                'name')
            existing_subcategories_list = {item['name'] for item in existing_subcategories}
        else:
            the_subcategory = DatasetSubcategory.objects.get(name=section,
                                                             categoryId=the_category)

        if section not in dataset_name_to_object:
            newdataset = Dataset(name=section,
                                 description='This is a dataset imported by the automated fetcher',
                                 namespace='who_wash', categoryId=the_category,
                                 subcategoryId=the_subcategory)
            newdataset.save()
            dataset_name_to_object[section] = newdataset
        else:
            newdataset = Dataset.objects.get(name=section, categoryId=the_category)

        source_name = "WHO UNICEF - {}".format(section)
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

        ws = wb[section]

        column_number = 0
        row_number = 0

        for row in ws.rows:
            row_number += 1
            for cell in row:
                if row_number > 3:
                    column_number += 1

                    if column_number in columns[section]:
                        if columns[section][column_number] == 'Country':
                            if str(cell.value).strip() and cell.value is not None:
                                country_col = cell.value
                        if columns[section][column_number] == 'Year':
                            if str(cell.value).strip() and cell.value is not None:
                                year = int(cell.value)
                        if columns[section][column_number] == 'Population':
                            if str(cell.value).strip() and cell.value is not None:
                                population = float(cell.value)
                        if columns[section][column_number] == 'Percent urban':
                            if str(cell.value).strip() and cell.value is not None:
                                urban_percent = float(cell.value)
                        if column_number > 5:
                            if cell.value and cell.value != '-':
                                if section == 'Water':
                                    varname = 'Drinking water'
                                if section == 'Sanitation':
                                    varname = 'Sanitation'
                                if section == 'Hygiene':
                                    varname = 'Hygiene'
                                varname += ' - ' + columns[section][column_number]['name'] + ' - ' + columns[section][column_number]['type']

                                percent_varname = varname + ' - Percent'
                                varunit = 'Percent'

                                if percent_varname.lower() not in existing_variables_list:
                                    newvariable = Variable(name=percent_varname,
                                                           unit=varunit,
                                                           code=None,
                                                           datasetId=newdataset,
                                                           variableTypeId=VariableType.objects.get(pk=4),
                                                           sourceId=source_name_to_object[source_name])
                                    newvariable.save()
                                    variable_name_to_object[percent_varname.lower()] = newvariable
                                    existing_variables_list.add(newvariable.name.lower())
                                else:

                                    if percent_varname.lower() not in variable_name_to_object:
                                        newvariable = Variable.objects.get(name=percent_varname, datasetId=newdataset)
                                        while DataValue.objects.filter(variableId__pk=newvariable.pk).first():
                                            with connection.cursor() as c:  # if we don't limit the deleted values, the db might just hang
                                                c.execute('DELETE FROM %s WHERE variableId = %s LIMIT 10000;' %
                                                          (DataValue._meta.db_table, newvariable.pk))
                                        variable_name_to_object[percent_varname.lower().lower()] = newvariable

                                if columns[section][column_number]['type'] == 'National':
                                    calc_population = (population*1000)*(float(cell.value)/100)
                                if columns[section][column_number]['type'] == 'Urban':
                                    calc_population = ((population*1000)*(urban_percent/100))*(float(cell.value)/100)
                                if columns[section][column_number]['type'] == 'Rural':
                                    calc_population = ((population*1000) - ((population*1000)*(urban_percent/100)))*(float(cell.value)/100)

                                pop_varname = varname + ' - Population'
                                varunit = 'People'

                                if pop_varname.lower() not in existing_variables_list:
                                    newvariable = Variable(name=pop_varname,
                                                           unit=varunit,
                                                           code=None,
                                                           datasetId=newdataset,
                                                           variableTypeId=VariableType.objects.get(pk=4),
                                                           sourceId=source_name_to_object[source_name])
                                    newvariable.save()
                                    variable_name_to_object[pop_varname.lower()] = newvariable
                                    existing_variables_list.add(newvariable.name.lower())
                                else:

                                    if pop_varname.lower() not in variable_name_to_object:
                                        newvariable = Variable.objects.get(name=pop_varname, datasetId=newdataset)
                                        while DataValue.objects.filter(variableId__pk=newvariable.pk).first():
                                            with connection.cursor() as c:  # if we don't limit the deleted values, the db might just hang
                                                c.execute('DELETE FROM %s WHERE variableId = %s LIMIT 10000;' %
                                                          (DataValue._meta.db_table, newvariable.pk))
                                        variable_name_to_object[pop_varname.lower().lower()] = newvariable

                                if country_col not in c_name_entity_ref:
                                    if country_col == 'Global':
                                        newentity = Entity.objects.get(name='World')
                                    elif country_tool_names_dict.get(unidecode.unidecode(country_col.lower()), 0):
                                        newentity = Entity.objects.get(
                                            name=country_tool_names_dict[
                                                unidecode.unidecode(country_col.lower())].owid_name)
                                    elif country_col.lower() in existing_entities_list:
                                        newentity = Entity.objects.get(name__iexact=country_col)
                                    else:
                                        newentity = Entity(name=country_col, validated=False)
                                        newentity.save()
                                    c_name_entity_ref[country_col] = newentity

                                data_values_tuple_list.append((str(cell.value), int(year),
                                                               c_name_entity_ref[country_col].pk,
                                                               variable_name_to_object[percent_varname.lower()].pk))
                                data_values_tuple_list.append((str(calc_population), int(year),
                                                               c_name_entity_ref[country_col].pk,
                                                               variable_name_to_object[pop_varname.lower()].pk))

                                if len(
                                    data_values_tuple_list) > 3000:  # insert when the length of the list goes over 3000

                                    with connection.cursor() as c:
                                        c.executemany(insert_string, data_values_tuple_list)
                                    data_values_tuple_list = []

            column_number = 0

    if len(data_values_tuple_list):  # insert any leftover data_values
        with connection.cursor() as c:
            c.executemany(insert_string, data_values_tuple_list)
        data_values_tuple_list = []

    newimport = ImportHistory(import_type='who_wash', import_time=timezone.now().strftime('%Y-%m-%d %H:%M:%S'),
                              import_notes='An who_wash import was performed',
                              import_state='There are a total of %s oecd_stat variables after the import' % Variable.objects.filter(
                                  datasetId__namespace='who_wash').count())
    newimport.save()

    print("--- %s seconds ---" % (time.time() - start_time))
