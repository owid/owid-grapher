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
from openpyxl import load_workbook


oecd_downloads_save_location = settings.BASE_DIR + '/data/OECD/'
oecd_metadata_file = settings.BASE_DIR + '/data/OECD/oecd_metadata.xlsx'
oecd_dataset_base_link = 'https://stats.oecd.org/Index.aspx?DataSetCode={}'

source_description = {
    'dataPublishedBy': "OECD.Stat",
    'dataPublisherSource': None,
    'link': "http://stats.oecd.org",
    'retrievedDate': timezone.now().strftime("%d-%B-%y"),
    'additionalInfo': None
}

wb = load_workbook(filename=oecd_metadata_file, read_only=True)
ws = wb['Data']

row_number = 0
column_number = 0

metadata_dict = {}

for row in ws.rows:
    row_number += 1
    for cell in row:
        column_number += 1
        if column_number == 1:
            dataset_name = cell.value
        if column_number == 2:
            cat_name = cell.value
        if column_number == 3:
            file_name = cell.value
        if column_number == 4:
            metadata_dict[file_name] = {
                'category': cat_name,
                'dataset': dataset_name,
                'meta_text': cell.value if cell.value else ''
            }

    column_number = 0


# Some of the records in the database related to OECD entities had trailing spaces, which resulted in duplicate errors during importing
for each in Entity.objects.filter(name__icontains='OECD'):
    if ' ' in each.name:
        each.name = each.name.strip()
        each.created_at = datetime.datetime.now()
        each.save()

oecd_category_name_in_db = 'OECD.Stat Datasets'  # set the name of the root category of all data that will be imported by this script

new_datasets_list = []
existing_datasets_list = []

start_time = time.time()
row_number = 0


duplicate_value_tracker = {}
with transaction.atomic():

    existing_categories = DatasetCategory.objects.values('name')
    existing_categories_list = {item['name'] for item in existing_categories}

    if oecd_category_name_in_db not in existing_categories_list:
        the_category = DatasetCategory(name=oecd_category_name_in_db, fetcher_autocreated=True)
        the_category.save()
    else:
        the_category = DatasetCategory.objects.get(name=oecd_category_name_in_db)

    existing_subcategories = DatasetSubcategory.objects.filter(categoryId=the_category.pk).values('name')
    existing_subcategories_list = {item['name'] for item in existing_subcategories}

    existing_variables = Variable.objects.filter(datasetId__namespace='oecd_stat').values('name')
    existing_variables_list = {item['name'].lower() for item in existing_variables}

    dataset_name_to_object = {item.name: item for item in Dataset.objects.filter(namespace='oecd_stat')}
    source_name_to_object = { item.name: item for item in Source.objects.filter(datasetId__in=[x.pk for x in Dataset.objects.filter(namespace='oecd_stat')]) }

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

    for file in glob.glob(oecd_downloads_save_location + "/**/" + "/*.csv", recursive=True):
        file_name = os.path.basename(file)
        file_name = file_name[:file_name.rfind('_')]

        if file_name in ['FIXINCLSA', 'SOCR', 'EDU_ENTR_FIELD', 'EDU_ENTR_AGE', 'EDU_ENRL_AGE', 'EDU_ENRL_FIELD', 'EDU_FIN_NATURE',
                         'EDU_GRAD_AGE', 'EAG_ENRL_MOBILES_ORIGIN', 'EDU_PERS_AGE', 'EDU_ENRL_INST',
                         'EDU_PERS_INST', 'EAG_FIN_RATIO_CATEGORY', 'EDU_DEM', 'EAG_EA_SKILLS', 'EDU_GRAD_FIELD',
                         'EAG_ENRL_SHARE_CATEGORY', 'EDU_GRAD_MOBILE', 'EDU_ENRL_MOBILE', 'TOURISM_REC_EXP',
                         'ALFS_EMP', 'TENURE_DIS', 'TEMP_D', 'TENURE_FREQ', 'SKILLS_2', 'USLHRS_I', 'TENURE_AVE',
                         'TEMP_I', 'PPP2014', 'TAXAUTO', 'REV', 'RS_AFR', 'RS_ASI', 'RSLACT', 'TXWDECOMP', 'TABLE1',
                         'EPER', 'ICT_BUS']:
            continue

        file_category = file[file.index('data/OECD/'):].replace(os.path.basename(file), '').replace('data/OECD/',
                                                                                                    '').replace('/', '')

        if file_category == 'National Accounts':
            continue

        if file_category == 'Demography and Population':
            if file_name not in ['MIG']:
                continue

        if file_name not in duplicate_value_tracker:
            duplicate_value_tracker[file_name] = set()
        columns_to_process = []  # these columns will be considered for building variable names
        with open(file, 'rt', encoding='utf-8-sig') as f:
            print('Processing: %s' % file)

            reader = csv.DictReader(f)

            for onec in reader.fieldnames:
                if not onec.isupper():  # uppercase column names usually contain codes
                    if onec not in ['Value', 'Time', 'Year', 'Time period', 'Reference year', 'Country', 'Metropolitan areas', 'Country - distribution',
                                    'Reporting country', 'Flags', 'Flag Codes', 'Unit', 'Unit Code', 'Reference Period', 'Periods',
                                    'Reference Period Code', 'PowerCode', 'PowerCode Code', 'Measure', 'Frequency', 'Recipient', 'Donor', 'Country of residence', 'Country of birth', 'Country of origin',
                                    'Country of birth/nationality', 'Inventor country', 'Partner']:  # we don't use these columns for constructing the variable names
                        columns_to_process.append(onec)

            filename = metadata_dict[file_name]['dataset']

            if file_name not in ['DIOC_CITIZEN_AGE', 'DIOC_DURATION_STAY', 'DIOC_FIELD_STUDY','DIOC_LFS','DIOC_SECTOR','DIOC_SEX_AGE','MIG','REF_TOTALOFFICIAL','REF_TOTALRECPTS','TABLE3A','EDU_ENRL_MOBILE','EDU_GRAD_MOBILE','IO_GHG_2015']:

                if metadata_dict[file_name]['category'] not in existing_subcategories_list:
                    the_subcategory = DatasetSubcategory(name=metadata_dict[file_name]['category'],
                                                         categoryId=the_category)
                    the_subcategory.save()

                    existing_subcategories = DatasetSubcategory.objects.filter(categoryId=the_category.pk).values(
                        'name')
                    existing_subcategories_list = {item['name'] for item in existing_subcategories}
                else:
                    the_subcategory = DatasetSubcategory.objects.get(name=metadata_dict[file_name]['category'],
                                                                     categoryId=the_category)

                long_dataset_name = "{} - {}".format(file_category, filename)
                if long_dataset_name not in dataset_name_to_object:
                    newdataset = Dataset(name=long_dataset_name,
                                         description='This is a dataset imported by the automated fetcher',
                                         namespace='oecd_stat', categoryId=the_category,
                                         subcategoryId=the_subcategory)
                    newdataset.save()
                    dataset_name_to_object[long_dataset_name] = newdataset
                    new_datasets_list.append(newdataset)
                else:
                    newdataset = Dataset.objects.get(name=long_dataset_name, categoryId=the_category)

                source_name = "OECD - {} - {}".format(metadata_dict[file_name]['category'], filename)
                source_description['additionalInfo'] = metadata_dict[file_name]['meta_text']
                source_description['link'] = oecd_dataset_base_link.format(file_name)
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

                for row in reader:
                    if (file_name == 'GIDDB2014') and ((row['Region'] != 'All regions') or (row['Income group'] != 'All income categories')):
                        continue
                    if (file_name == 'SIGI2014') and ((row['Region'] != 'All regions') or (row['Income'] != 'All income categories')):
                        continue
                    if (file_name == 'SOCX_AGG') and ((row['Type of Expenditure'] != 'Total') or (row['Type of Programme'] != 'Total')):
                        continue
                    if (file_name == 'EDU_FIN_SOURCE') and ((row['ISCED 2011 P category'] != 'All educational programmes') or (row['Type of expenditure'] != 'All expenditure types') or (row['Counterpart sector'] != 'All sectors')):
                        continue
                    if (file_name == 'EAG_EARNINGS') and (row['Earnings category'] != 'All earners'):
                        continue
                    if (file_name == 'EAG_NEAC') and (row['Field'] != 'Total'):
                        continue
                    if (file_name == 'ANBERD_REV4') and not row['Industry'].isupper():
                        continue
                    if (file_name == 'INVPT_I') and ((row['Sex'] != 'All persons') or (row['Age'] != 'Total') or (row['Employment status'] != 'Total employment')):
                        continue
                    if row['Value']:
                        country_col = None
                        year_col_name = None

                        row_number += 1

                        thevarname = []
                        for key in columns_to_process:
                            if row[key]:
                                thevarname.append("{}:{}".format(key, row[key]))
                        if thevarname:
                            variable_name = ' - '.join(thevarname)
                        else:
                            variable_name = filename

                        if file_name == 'ANBERD_REV4':
                            variable_name += ' - ' + row['Country - distribution'][row['Country - distribution'].rfind('-'):]
                        variable_name += ' - ' + file_name
                        variable_code = None

                        if 'Unit' in reader.fieldnames:
                            if row['Unit']:
                                varunit = row['Unit']
                            else:
                                varunit = ''
                        else:
                            varunit = ''

                        if variable_name.lower() not in existing_variables_list:
                            newvariable = Variable(name=variable_name,
                                                   unit=varunit,
                                                   code=variable_code,
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

                        if 'Country' in reader.fieldnames:
                            country_col = row['Country'].strip()
                        elif 'Reporting country' in reader.fieldnames:
                            country_col = row['Reporting country'].strip()
                        elif 'Inventor country' in reader.fieldnames:
                            country_col = row['Inventor country'].strip()
                        elif file_name == 'REF_TOTAL_ODF':
                            country_col = row['Recipient'].strip()
                        elif file_name == 'TABLE1':
                            country_col = row['Donor'].strip()
                        elif file_name == 'FDI_AGGR_SUMM':
                            country_col = row['Reporting country'].strip()
                        elif file_name == 'ANBERD_REV4':
                            country_col = row['Country - distribution'][:row['Country - distribution'].rfind('-')]. strip()
                        elif file_name == 'CITIES':
                            country_col = row['Metropolitan areas'].strip()

                        if file_name == 'EAG_WT_ORG':
                            year_col_name = 2015
                        elif 'Year' in reader.fieldnames:
                            year_col_name = row['Year']
                        elif 'Time' in reader.fieldnames:
                            year_col_name = row['Time']
                        elif 'Reference year' in reader.fieldnames:
                            year_col_name = row['Reference year']
                        elif 'Time period' in reader.fieldnames:
                            year_col_name = row['Time period']
                        elif 'YEAR' in reader.fieldnames:
                            year_col_name = row['YEAR']
                        elif 'Periods' in reader.fieldnames:
                            year_col_name = row['Periods']

                        try:
                            year_col_name = int(year_col_name)
                        except:
                            if 'Reference Period' in reader.fieldnames:
                                if row['Reference Period'] == '':
                                    print('Skipping one row: year column is empty.')
                                    continue
                                else:
                                    try:
                                        year_col_name = int(row['Reference Period'])
                                    except:
                                        print('Skipping one row: year column is invalid - {}.'.format(row['Reference Period']))
                                        continue
                            else:
                                if file_name not in ['HEALTH_HCQI']:
                                    raise ValueError
                                else:
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

                        if ((int(year_col_name), c_name_entity_ref[country_col].pk, variable_name_to_object[variable_name.lower()].pk)) not in duplicate_value_tracker[file_name]:
                            duplicate_value_tracker[file_name].add((int(year_col_name), c_name_entity_ref[country_col].pk, variable_name_to_object[variable_name.lower()].pk))
                            data_values_tuple_list.append((str(data_value), int(year_col_name), c_name_entity_ref[country_col].pk, variable_name_to_object[variable_name.lower()].pk))

                        if len(data_values_tuple_list) > 3000:  # insert when the length of the list goes over 3000

                            with connection.cursor() as c:
                                c.executemany(insert_string, data_values_tuple_list)
                            data_values_tuple_list = []

                        if row_number % 100 == 0:
                            time.sleep(0.001)  # this is done in order to not keep the CPU busy all the time, the delay after each 100th row is 1 millisecond

            else:
                varname_n_country_to_values = {}
                varname_to_unit = {}
                i = 0
                entity1_values = []
                entity2_values = []
                if file_name == 'DIOC_CITIZEN_AGE':
                    country_columns = ['Country of birth', 'Country of residence']
                    add_to_variable_name = ['Country of residence:All countries', 'Country of birth:All countries']
                if file_name == 'DIOC_DURATION_STAY':
                    country_columns = ['Country of birth', 'Country of residence']
                    add_to_variable_name = ['Country of residence:All countries', 'Country of birth:All countries']
                if file_name == 'DIOC_FIELD_STUDY':
                    country_columns = ['Country of birth', 'Country of residence']
                    add_to_variable_name = ['Country of residence:All countries', 'Country of birth:All countries']
                if file_name == 'DIOC_LFS':
                    country_columns = ['Country of birth', 'Country of residence']
                    add_to_variable_name = ['Country of residence:All countries', 'Country of birth:All countries']
                if file_name == 'DIOC_SECTOR':
                    country_columns = ['Country of birth', 'Country of residence']
                    add_to_variable_name = ['Country of residence:All countries', 'Country of birth:All countries']
                if file_name == 'DIOC_SEX_AGE':
                    country_columns = ['Country of birth', 'Country of residence']
                    add_to_variable_name = ['Country of residence:All countries', 'Country of birth:All countries']
                if file_name == 'MIG':
                    country_columns = ['Country of birth/nationality', 'Country']
                    add_to_variable_name = ['Country:All countries', 'Country of birth/nationality:All countries']
                if file_name == 'REF_TOTALOFFICIAL':
                    country_columns = ['Recipient', 'Donor']
                    add_to_variable_name = ['Donor:All countries', 'Recipient:All countries']
                if file_name == 'REF_TOTALRECPTS':
                    country_columns = ['Recipient', 'Donor']
                    add_to_variable_name = ['Donor:All countries', 'Recipient:All countries']
                if file_name == 'TABLE3A':
                    country_columns = ['Recipient', 'Donor']
                    add_to_variable_name = ['Donor:All countries', 'Recipient:All countries']
                if file_name == 'EDU_ENRL_MOBILE':
                    country_columns = ['Country', 'Country of origin']
                    add_to_variable_name = ['Country of origin:All countries', 'Country:All countries']
                if file_name == 'EDU_GRAD_MOBILE':
                    country_columns = ['Recipient', 'Donor']
                    add_to_variable_name = ['Donor:All countries', 'Recipient:All countries']
                if file_name == 'IO_GHG_2015':
                    country_columns = ['Country', 'Partner']
                    add_to_variable_name = ['Partner:All countries', 'Country:All countries']

                for onevalue in country_columns:
                    for row in reader:
                        if row['Value']:
                            country_col = None
                            year_col_name = None

                            row_number += 1

                            if file_name == 'DIOC_CITIZEN_AGE':
                                year_col_name = 2000
                            elif file_name == 'DIOC_DURATION_STAY':
                                year_col_name = 2000
                            elif file_name == 'DIOC_FIELD_STUDY':
                                year_col_name = 2000
                            elif file_name == 'DIOC_LFS':
                                year_col_name = 2000
                            elif file_name == 'DIOC_SECTOR':
                                year_col_name = 2000
                            elif file_name == 'DIOC_SEX_AGE':
                                year_col_name = 2000
                            elif file_name == 'EDU_ENRL_MOBILE':
                                year_col_name = 2014
                            elif 'Year' in reader.fieldnames:
                                year_col_name = row['Year']
                            elif 'Time' in reader.fieldnames:
                                year_col_name = row['Time']
                            elif 'Reference year' in reader.fieldnames:
                                year_col_name = row['Reference year']
                            elif 'Time period' in reader.fieldnames:
                                year_col_name = row['Time period']
                            elif 'YEAR' in reader.fieldnames:
                                year_col_name = row['YEAR']
                            elif 'Periods' in reader.fieldnames:
                                year_col_name = row['Periods']

                            try:
                                year_col_name = int(year_col_name)
                            except:
                                if 'Reference Period' in reader.fieldnames:
                                    if row['Reference Period'] == '':
                                        print('Skipping one row: year column is empty.')
                                        continue
                                    else:
                                        try:
                                            year_col_name = int(row['Reference Period'])
                                        except:
                                            print('Skipping one row: year column is invalid - {}.'.format(
                                                row['Reference Period']))
                                            continue
                                else:
                                    if file_name not in ['HEALTH_HCQI']:
                                        raise ValueError
                                    else:
                                        continue

                            thevarname = [add_to_variable_name[i]]
                            for key in columns_to_process:
                                if row[key]:
                                    thevarname.append("{}:{}".format(key, row[key]))
                            if thevarname:
                                variable_name = ' - '.join(thevarname)
                            else:
                                variable_name = filename

                            if 'Unit' in reader.fieldnames:
                                if row['Unit']:
                                    varunit = row['Unit']
                                else:
                                    varunit = ''
                            else:
                                varunit = ''

                            if variable_name not in varname_to_unit:
                                varname_to_unit[variable_name] = varunit

                            data_value = float(row['Value'])
                            if 'PowerCode' in reader.fieldnames:
                                if row['PowerCode']:
                                    if row['PowerCode'] == 'Thousands':
                                        data_value *= 1000
                                    if row['PowerCode'] == 'Millions':
                                        data_value *= 1000000

                            if variable_name not in varname_n_country_to_values:
                                varname_n_country_to_values[variable_name] = {}
                            else:
                                if year_col_name not in varname_n_country_to_values[variable_name]:
                                    varname_n_country_to_values[variable_name][year_col_name] = {}
                                else:
                                    if row[country_columns[i]] not in varname_n_country_to_values[variable_name][year_col_name]:
                                        varname_n_country_to_values[variable_name][year_col_name][row[country_columns[i]]] = 0
                                        varname_n_country_to_values[variable_name][year_col_name][row[country_columns[i]]] += data_value
                                    else:
                                        varname_n_country_to_values[variable_name][year_col_name][row[country_columns[i]]] += data_value
                            if i == 0:
                                if row[country_columns[i]] not in entity1_values:
                                    entity1_values.append(row[country_columns[i]])
                            else:
                                if row[country_columns[i]] not in entity2_values:
                                    entity2_values.append(row[country_columns[i]])

                    f.seek(0)
                    reader = csv.DictReader(f)
                    i += 1

                if metadata_dict[file_name]['category'] not in existing_subcategories_list:
                    the_subcategory = DatasetSubcategory(name=metadata_dict[file_name]['category'],
                                                         categoryId=the_category)
                    the_subcategory.save()

                    existing_subcategories = DatasetSubcategory.objects.filter(
                        categoryId=the_category.pk).values(
                        'name')
                    existing_subcategories_list = {item['name'] for item in existing_subcategories}
                else:
                    the_subcategory = DatasetSubcategory.objects.get(name=metadata_dict[file_name]['category'],
                                                                     categoryId=the_category)

                long_dataset_name = "{} - {}".format(file_category, filename)
                if long_dataset_name not in dataset_name_to_object:
                    newdataset = Dataset(name=long_dataset_name,
                                         description='This is a dataset imported by the automated fetcher',
                                         namespace='oecd_stat', categoryId=the_category,
                                         subcategoryId=the_subcategory)
                    newdataset.save()
                    dataset_name_to_object[long_dataset_name] = newdataset
                    new_datasets_list.append(newdataset)
                else:
                    newdataset = Dataset.objects.get(name=long_dataset_name, categoryId=the_category)

                source_name = "OECD - {} - {}".format(metadata_dict[file_name]['category'], filename)
                source_description['additionalInfo'] = metadata_dict[file_name]['meta_text']
                source_description['additionalInfo'] += '\n{} contains {}'.format(add_to_variable_name[0], ', '.join(entity1_values))
                source_description['additionalInfo'] += '\n{} contains {}'.format(add_to_variable_name[1],
                                                                                  ', '.join(entity2_values))
                source_description['link'] = oecd_dataset_base_link.format(file_name)
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

                for dict_var_name, dict_value in varname_n_country_to_values.items():
                    for dict_year, dict_country in dict_value.items():
                        for country_name, country_value in dict_country.items():
                            country_col = country_name.strip()
                            if country_col not in c_name_entity_ref:
                                if country_col == 'Global':
                                    newentity = Entity.objects.get(name='World')
                                elif country_col == 'Rest of the world':
                                    newentity = Entity.objects.get(name='Rest of World')
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

                            variable_code = None
                            variable_name = dict_var_name
                            if variable_name.lower() not in existing_variables_list:
                                newvariable = Variable(name=variable_name,
                                                       unit=varname_to_unit[variable_name],
                                                       code=variable_code,
                                                       datasetId=newdataset,
                                                       variableTypeId=VariableType.objects.get(pk=4),
                                                       sourceId=source_name_to_object[source_name])
                                newvariable.save()
                                variable_name_to_object[variable_name.lower()] = newvariable
                                existing_variables_list.add(newvariable.name.lower())
                            else:

                                if variable_name.lower() not in variable_name_to_object:
                                    newvariable = Variable.objects.get(name=variable_name,
                                                                       datasetId=newdataset)
                                    while DataValue.objects.filter(variableId__pk=newvariable.pk).first():
                                        with connection.cursor() as c:  # if we don't limit the deleted values, the db might just hang
                                            c.execute('DELETE FROM %s WHERE variableId = %s LIMIT 10000;' %
                                                      (DataValue._meta.db_table, newvariable.pk))
                                    variable_name_to_object[variable_name.lower()] = newvariable
                            if ((int(dict_year), c_name_entity_ref[country_col].pk,
                                 variable_name_to_object[variable_name.lower()].pk)) not in \
                                duplicate_value_tracker[file_name]:
                                duplicate_value_tracker[file_name].add((int(dict_year),
                                                                        c_name_entity_ref[country_col].pk,
                                                                        variable_name_to_object[
                                                                            variable_name.lower()].pk))
                                data_values_tuple_list.append((str(country_value), int(dict_year),
                                                               c_name_entity_ref[country_col].pk,
                                                               variable_name_to_object[
                                                                   variable_name.lower()].pk))

                            if len(
                                data_values_tuple_list) > 3000:  # insert when the length of the list goes over 3000

                                with connection.cursor() as c:
                                    c.executemany(insert_string, data_values_tuple_list)
                                data_values_tuple_list = []

                            if row_number % 100 == 0:
                                time.sleep(
                                    0.001)  # this is done in order to not keep the CPU busy all the time, the delay after each 100th row is 1 millisecond


        if file_name not in ['EAG_FIN_RATIO_CATEGORY', 'EAG_NEAC', 'JOBQ', 'PAG']:
            del duplicate_value_tracker[file_name]

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
                                  import_state='There are a total of %s oecd_stat variables after the import' % Variable.objects.filter(datasetId__namespace='oecd_stat').count())
newimport.save()

print("--- %s seconds ---" % (time.time() - start_time))
