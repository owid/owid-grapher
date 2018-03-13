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
import requests
import lxml.html
# import pdfminer.high_level
# import pdfminer.settings
# pdfminer.settings.STRICT = False
# import pdfminer.layout

# we will first download the dataset files

un_sdg_save_location = settings.BASE_DIR + '/data/un_sdg/indicators'
un_sdg_metadata_location = settings.BASE_DIR + '/data/un_sdg/metadata'

# indicators = [
# '1.1.1','1.2.1','1.3.1','1.5.1','1.5.2','1.5.3','2.1.1','2.1.2','2.2.1','2.2.2','2.5.1','2.5.2','2.a.1','2.a.2','2.c.1','3.1.1','3.1.2','3.2.1','3.2.2','3.3.1','3.3.2','3.3.3','3.3.5','3.4.1','3.4.2','3.5.2','3.6.1','3.7.1','3.7.2','3.9.1','3.9.2','3.9.3','3.a.1','3.b.2','3.c.1','3.d.1','4.1.1','4.2.1','4.2.2','4.3.1','4.4.1','4.5.1','4.6.1','4.a.1','4.b.1','4.c.1','5.2.1','5.3.1','5.3.2','5.4.1','5.5.1','5.5.2','5.6.1','5.b.1','6.1.1','6.2.1','6.4.2','6.5.1','6.a.1','6.b.1','7.1.1','7.1.2','7.2.1','7.3.1','8.1.1','8.2.1','8.3.1','8.4.1','8.4.2','8.5.1','8.5.2','8.6.1','8.7.1','8.8.1','8.10.1','8.10.2','8.a.1','9.1.2','9.2.1','9.2.2','9.4.1','9.5.1','9.5.2','9.a.1','9.b.1','9.c.1','10.1.1','10.4.1','10.6.1','10.a.1','10.b.1','10.c.1','11.1.1','11.5.1','11.5.2','11.6.1','11.6.2','11.b.1','12.2.1','12.2.2','12.4.1','13.1.1','13.1.2','14.4.1','14.5.1','15.1.1','15.1.2','15.2.1','15.4.1','15.4.2','15.5.1','15.6.1','15.a.1','15.b.1','16.1.1','16.2.1','16.2.2','16.2.3','16.3.2','16.5.2','16.8.1','16.9.1','16.10.1','16.10.2','16.a.1','17.2.1','17.3.2','17.4.1','17.6.2','17.8.1','17.9.1','17.10.1','17.11.1','17.12.1','17.15.1','17.16.1','17.18.2','17.18.3','17.19.1','17.19.2'
# ]
#
# for oneindicator in indicators:
#
#     r = requests.get('https://unstats.un.org/sdgs/indicators/database/?indicator={}'.format(oneindicator))
#
#     html = lxml.html.fromstring(r.content)
#
#     tds = html.xpath('//table[@id="sdgDataByIndicator"]//tr')
#
#     with open(un_sdg_save_location + '/{}.csv'.format(oneindicator), 'w', encoding='utf8') as csvfile:
#         spamwriter = csv.writer(csvfile)
#
#         counter = 0
#         for each in tds:
#             line = []
#             if counter == 0:
#                 for eachone in each.xpath('.//th'):
#                     line.append(eachone.text_content().strip())
#             else:
#                 for eachone in each.xpath('.//td'):
#                     line.append(eachone.text_content().strip())
#             spamwriter.writerow(line)
#             counter += 1
#     time.sleep(2)

# now proceeding to download metadata files

# r = requests.get("https://unstats.un.org/sdgs/metadata/")
# html = lxml.html.fromstring(r.content)
#
# ahrefs = html.xpath('//a/@href')
#
# for each in ahrefs:
#     if 'Metadata-' in each:
#         rf = requests.get("https://unstats.un.org/" + each, stream=True)
#         with open(un_sdg_metadata_location + '/' + each[each.index('Metadata'):], 'wb') as f:
#             for chunk in rf.iter_content(chunk_size=1024):
#                 if chunk:  # filter out keep-alive new chunks
#                     f.write(chunk)

# we will also need to convert pdf files to plain text

# pdf_files = glob.glob(un_sdg_metadata_location + "/*.pdf")
#
# laparams = pdfminer.layout.LAParams()
# for param in ("all_texts", "detect_vertical", "word_margin", "char_margin", "line_margin", "boxes_flow"):
#     paramv = locals().get(param, None)
#     if paramv is not None:
#         setattr(laparams, param, paramv)
#
# for each in pdf_files:
#     text_file = ''
#     inputf = open(each,"rb")
#     with open(each.replace('.pdf', '.txt'), "wt", encoding="utf8") as ff:
#         pdfminer.high_level.extract_text_to_fp(inputf, ff, laparams=laparams)
#     inputf.close()

metadata_file_names = []

for file in glob.glob(un_sdg_metadata_location + "/*.txt"):
    metadata_file_names.append(os.path.basename(file))

source_description = {
    'dataPublishedBy': "United Nations Statistics Division",
    'dataPublisherSource': None,
    'link': "https://unstats.un.org/sdgs/indicators/database/",
    'retrievedDate': timezone.now().strftime("%d-%B-%y"),
    'additionalInfo': None
}

un_sdg_category_name_in_db = 'UN SDG Indicators'  # set the name of the root category of all data that will be imported by this script

new_datasets_list = []
existing_datasets_list = []

start_time = time.time()
row_number = 0
with transaction.atomic():

    existing_categories = DatasetCategory.objects.values('name')
    existing_categories_list = {item['name'] for item in existing_categories}

    if un_sdg_category_name_in_db not in existing_categories_list:
        the_category = DatasetCategory(name=un_sdg_category_name_in_db, fetcher_autocreated=True)
        the_category.save()
    else:
        the_category = DatasetCategory.objects.get(name=un_sdg_category_name_in_db)

    existing_subcategories = DatasetSubcategory.objects.filter(categoryId=the_category.pk).values('name')
    existing_subcategories_list = {item['name'] for item in existing_subcategories}

    existing_variables = Variable.objects.filter(datasetId__namespace='un_sdg').values('name')
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

    for file in glob.glob(un_sdg_save_location + "/*.csv"):
        print('Processing: %s' % file)

        # let's first decide which columns will make up the variable names

        row_name_to_values = {}
        row_name_to_values['Series Code'] = []
        row_name_to_values['Age group'] = []
        row_name_to_values['Sex'] = []
        row_name_to_values['Location'] = []
        row_name_to_values['Value type'] = []
        row_name_to_values['Unit'] = []

        columns_to_include = []
        varnames = []

        with open(file, 'r', encoding='utf8') as f:

            reader = csv.DictReader(f)
            for row in reader:
                if row['Series Code'] not in row_name_to_values['Series Code']:
                    row_name_to_values['Series Code'].append(row['Series Code'])
                if row['Age group'] not in row_name_to_values['Age group']:
                    row_name_to_values['Age group'].append(row['Age group'])
                if row['Sex'] not in row_name_to_values['Sex']:
                    row_name_to_values['Sex'].append(row['Sex'])
                if row['Location'] not in row_name_to_values['Location']:
                    row_name_to_values['Location'].append(row['Location'])
                if row['Value type'] not in row_name_to_values['Value type']:
                    row_name_to_values['Value type'].append(row['Value type'])
                if row['Unit'] not in row_name_to_values['Unit']:
                    row_name_to_values['Unit'].append(row['Unit'])

            columns_to_include.append('Indicator Ref')
            columns_to_include.append('Series Description')

            for key, value in row_name_to_values.items():
                if len(value) > 1:
                    columns_to_include.append(key)

        # now we are going to read the metadata files
        metadata_string = ''

        csv_name_parts = os.path.basename(file).replace('.csv', '').split('.')
        temp_metadata_name = []
        for x in csv_name_parts:
            if len(x) == 1:
                temp_metadata_name.append('0'+ x)
            else:
                temp_metadata_name.append(x)
        temp_metadata_name = '-'.join(temp_metadata_name).upper()

        for eachmeta in metadata_file_names:
            if temp_metadata_name in eachmeta:
                with open(os.path.join(un_sdg_metadata_location, eachmeta), 'r', encoding='utf8') as metaf:
                    mstring = metaf.read()

                metadata_string += mstring[mstring.index('Definition: '):mstring.index('\nRationale: ')] + '\n'

                try:
                    comments_index = mstring.index('Comments and limitations:')
                except:
                    comments_index = None

                if comments_index:
                    metadata_string += mstring[comments_index:mstring.index('Methodology ')] + '\n'

                metadata_string += mstring[
                                   mstring.index('Data Availability '):mstring.index('\nCalendar ')] + '\n'

        source_description['additionalInfo'] = metadata_string if metadata_string else None
        with open(file, 'r', encoding='utf8') as f:

            reader = csv.DictReader(f)
            for row in reader:
                row_number += 1
                subcategory_name = row['Indicator Description'][:250]
                if subcategory_name not in existing_subcategories_list:
                    the_subcategory = DatasetSubcategory(name=subcategory_name, categoryId=the_category)
                    the_subcategory.save()
                    newdataset = Dataset(name=subcategory_name,
                                         description='This is a dataset imported by the automated fetcher',
                                         namespace='un_sdg', categoryId=the_category,
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

                variable_name = ''
                per_row_var = []
                for each in columns_to_include:
                    if row[each]:
                        if row[
                            each] == 'Countries that have legislative, administrative and policy framework or measures reported through the Online Reporting System on Compliance  of the International Treaty on Plant Genetic Resources for Food and Agriculture (PGRFA)':
                            per_row_var.append(
                                'Countries that have measures reported through the Online Reporting System on Compliance  of the International Treaty on PGRFA')
                        elif row[
                            each] == 'Proportion of teachers in lower secondary education who have received at least the minimum organized teacher training (e.g. pedagogical training) pre-service or in-service required for teaching at the relevant level in a given country':
                            per_row_var.append(
                                'Proportion of teachers in lower secondary education who have received pedagogical training required for teaching at the relevant level in a given country')
                        elif row[
                            each] == 'Proportion of teachers in pre-primary education who have received at least the minimum organized teacher training (e.g. pedagogical training) pre-service or in-service required for teaching at the relevant level in a given country':
                            per_row_var.append(
                                'Proportion of teachers in pre-primary education who have received pedagogical training required for teaching at the relevant level in a given country')
                        elif row[
                            each] == 'Proportion of teachers in primary education who have received at least the minimum organized teacher training (e.g. pedagogical training) pre-service or in-service required for teaching at the relevant level in a given country':
                            per_row_var.append(
                                'Proportion of teachers in primary education who have received pedagogical training required for teaching at the relevant level in a given country')
                        elif row[
                            each] == 'Proportion of teachers in secondary education who have received at least the minimum organized teacher training (e.g. pedagogical training) pre-service or in-service required for teaching at the relevant level in a given country':
                            per_row_var.append(
                                'Proportion of teachers in secondary education who have received pedagogical training required for teaching at the relevant level in a given country')
                        elif row[
                            each] == 'Proportion of teachers in upper secondary education who have received at least the minimum organized teacher training (e.g. pedagogical training) pre-service or in-service required for teaching at the relevant level in a given country':
                            per_row_var.append(
                                'Proportion of teachers in upper secondary education who have received pedagogical training required for teaching at the relevant level in a given country')
                        else:
                            per_row_var.append(row[each])

                variable_name = ' - '.join(per_row_var)

                if variable_name not in existing_variables_list:

                    newvariable = Variable(name=variable_name,
                                           unit=row['Unit'],
                                           datasetId=dataset_name_to_object[subcategory_name],
                                           variableTypeId=VariableType.objects.get(pk=4),
                                           sourceId=source_name_to_object[subcategory_name])
                    newvariable.save()
                    variable_name_to_object[variable_name] = newvariable
                    existing_variables_list.add(newvariable.name)
                else:
                    if variable_name not in variable_name_to_object:
                        newvariable = Variable.objects.get(name=variable_name, datasetId=dataset_name_to_object[subcategory_name])
                        while DataValue.objects.filter(variableId__pk=newvariable.pk).first():
                            with connection.cursor() as c:  # if we don't limit the deleted values, the db might just hang
                                c.execute('DELETE FROM %s WHERE variableId = %s LIMIT 10000;' %
                                          (DataValue._meta.db_table, newvariable.pk))
                        variable_name_to_object[variable_name] = newvariable

                if row['Country or Area Name'] not in c_name_entity_ref:
                    if row['Country or Area Name'] == 'Global':
                        newentity = Entity.objects.get(name='World')
                    elif country_tool_names_dict.get(unidecode.unidecode(row['Country or Area Name'].lower()), 0):
                        #print(country_tool_names_dict[unidecode.unidecode(row['Country or Area Name'].lower())].owid_name)
                        if country_tool_names_dict[unidecode.unidecode(row['Country or Area Name'].lower())].owid_name == 'Saint Barthlemy':
                            newentity = Entity.objects.get(name='Saint Barthélemy')
                        elif country_tool_names_dict[unidecode.unidecode(row['Country or Area Name'].lower())].owid_name == 'land Islands':
                            newentity = Entity.objects.get(name='Åland Islands')
                        else:
                            newentity = Entity.objects.get(
                                name=country_tool_names_dict[unidecode.unidecode(row['Country or Area Name'].lower())].owid_name)
                    elif row['Country or Area Name'].lower() in existing_entities_list:
                        newentity = Entity.objects.get(name__iexact=row['Country or Area Name'])
                    else:
                        newentity = Entity(name=row['Country or Area Name'], validated=False)
                        newentity.save()
                    c_name_entity_ref[row['Country or Area Name']] = newentity

                for i in range(1000, 2020):
                    if str(i) in reader.fieldnames:
                        if row[str(i)]:
                            try:
                                data_values_tuple_list.append((str(float(row[str(i)])), i,
                                                   c_name_entity_ref[row['Country or Area Name']].pk, variable_name_to_object[variable_name].pk))
                            except:
                                pass

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

for dataset in existing_datasets_list:
    write_dataset_csv(dataset.pk, dataset.name, dataset.name, 'un_sdg_fetcher', '')
for dataset in new_datasets_list:
    write_dataset_csv(dataset.pk, dataset.name, None, 'un_sdg_fetcher', '')

newimport = ImportHistory(import_type='un_sdg', import_time=timezone.now().strftime('%Y-%m-%d %H:%M:%S'),
                                  import_notes='A un_sdg import was performed',
                                  import_state='There are a total of %s un_sdg variables after the import' % Variable.objects.filter(datasetId__namespace='un_sdg').count())
newimport.save()

print("--- %s seconds ---" % (time.time() - start_time))
