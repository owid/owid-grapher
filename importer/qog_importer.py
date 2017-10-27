import csv
import sys
import os
import hashlib
import json
import logging
import requests
import unidecode
import shutil
import time
import django.db.utils
sys.path.insert(1, os.path.join(sys.path[0], '..'))
import owid_grapher.wsgi
from grapher_admin.models import Entity, DatasetSubcategory, DatasetCategory, Dataset, Source, Variable, VariableType, DataValue, ChartDimension
from importer.models import ImportHistory
from country_name_tool.models import CountryName
from django.conf import settings
from django.db import connection, transaction
from django.utils import timezone
from grapher_admin.views import write_dataset_csv


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
    'dataPublishedBy': "The Quality of Government Institute",
    'retrievedDate': timezone.now().strftime("%d-%B-%y")
}

qog_file_url = 'http://www.qogdata.pol.gu.se/data/qog_std_ts_jan17.csv'
qog_metadata_file = settings.BASE_DIR + '/data/qog/metadata/qog_metadata.csv'  # metadata file should be put in this directory manually
qog_downloads_save_location = settings.BASE_DIR + '/data/qog/downloads/'

# create a directory for holding the downloads
# if the directory exists, delete it and recreate it

if not os.path.exists(qog_downloads_save_location):
    os.makedirs(qog_downloads_save_location)
else:
    shutil.rmtree(qog_downloads_save_location)
    os.makedirs(qog_downloads_save_location)

logger = logging.getLogger('importer')
start_time = time.time()

logger.info("Getting the csv file")
request_header = {'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_10_1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/39.0.2171.95 Safari/537.36'}
r = requests.get(qog_file_url, stream=True, headers=request_header)
if r.ok:
    with open(qog_downloads_save_location + 'qog.csv', 'wb') as out_file:
        shutil.copyfileobj(r.raw, out_file)
    r = None  # we do not need the request anymore
else:
    logger.error("The file could not be downloaded. Stopping the script...")
    sys.exit("Could not download file.")


# apart from the main data file itself, we need QoG's metadata file that contains source and variable information
if not os.path.isfile(qog_metadata_file):
    logger.error("The metadata file was not found. Stopping the script...")
    sys.exit("The metadata file was not found. It should be put into %s. Exiting..." % qog_metadata_file)

qog_category_name_in_db = 'QoG Standard Dataset'  # set the name of the root category of all data that will be imported by this script

# QoG category abbreviations and their full labels
# Important: this dictionary must be changed manually as new data arrives with the metadata
abbr_category_names = {
    'cat_health': 'Health',
    'cat_educ': 'Education',
    'cat_civil': 'Civil Society',
    'cat_confl': 'Conflict/Violence',
    'cat_elec': 'Election',
    'cat_energy': 'Energy and Infrastructure',
    'cat_env': 'Environment',
    'cat_polsys': 'Political System',
    'cat_jud': 'Judicial',
    'cat_qog': 'Quality of Government',
    'cat_mig': 'Migration',
    'cat_media': 'Media',
    'cat_welfare': 'Welfare',
    'cat_econpub': 'Public Economy',
    'cat_econpriv': 'Private Economy',
    'cat_labour': 'Labour Market',
    'cat_religion': 'Religion',
    'cat_history': 'History'
}

# these are the fields in the csv file that do not refer to variable names
not_var_fields = ['ccode', 'cname', 'year', 'ccodealp', 'cname_year', 'ccodealp_year', 'ccodecow', 'ccodewb',
                  'version']

# create a dict of variables and sources from the provided metadata file
qog_vars = {}
qog_sources = {}

csv.register_dialect('escaped', escapechar='\\',
                     quoting=csv.QUOTE_MINIMAL)  # this is done to unescape the strings in the csv metadata file
with open(qog_metadata_file) as csvfile:
    reader = csv.DictReader(csvfile, dialect='escaped')
    headers = reader.fieldnames
    for row in reader:
        if row['inc_stdts'] == '1' and row['varname'] not in not_var_fields:  # we are working with the standard time-series dataset
            if not row['variable']:
                qog_sources[row['varname']] = {
                    'name': row['datasource'],
                    'url': row['url'],
                    'date_retrieved': row['date'],
                    'original_dataset': row['dataset'],
                    'description': row['description']
                }
            else:
                for header in headers:
                    if header.startswith('cat_'):
                        if int(row[header]):
                            category = abbr_category_names[header]

                qog_vars[row['varname']] = {
                    'name': row['varlab'],
                    'description': row['description'],
                    'category': category,
                    'timespan': '%s - %s' % (row['std_ts_minyear'], row['std_ts_maxyear'])
                }

import_history = ImportHistory.objects.filter(import_type='qog')

with transaction.atomic():
    if not import_history:
        logger.info("Starting the initial import of QoG dataset.")

        total_data_values = 0  # for tracking the number of inserted data values

        # we will first save the category, subcategory, country, variable and source information

        existing_categories = DatasetCategory.objects.values('name')
        existing_categories_list = {item['name'] for item in existing_categories}

        if qog_category_name_in_db not in existing_categories_list:
            the_category = DatasetCategory(name=qog_category_name_in_db, fetcher_autocreated=True)
            the_category.save()
            logger.info("Inserting a category %s." % qog_category_name_in_db.encode('utf8'))
        else:
            the_category = DatasetCategory.objects.get(name=qog_category_name_in_db)

        existing_subcategories = DatasetSubcategory.objects.filter(fk_dst_cat_id=the_category.pk).values('name')
        existing_subcategories_list = {item['name'] for item in existing_subcategories}

        categories_ref_models = {}  # this dict will hold the category name and its corresponding object
        datasets_ref_models = {}  # this dict will hold the dataset name and its corresponding object
        vars_ref_models = {}  # this dict will hold the variable name and its corresponding object

        for key, value in abbr_category_names.items():
            if value not in existing_subcategories_list:
                the_subcategory = DatasetSubcategory(name=value, fk_dst_cat_id=the_category)
                the_subcategory.save()
                logger.info("Inserting a subcategory %s." % value.encode('utf8'))
            else:
                the_subcategory = DatasetSubcategory.objects.get(name=value, fk_dst_cat_id=the_category)
            categories_ref_models[value] = the_subcategory

        existing_entities = Entity.objects.values('name')
        existing_entities_list = {item['name'] for item in existing_entities}

        country_tool_names = CountryName.objects.all()
        country_tool_names_dict = {}
        for each in country_tool_names:
            country_tool_names_dict[each.country_name.lower()] = each.owid_country

        country_name_entity_ref = {}  # this dict will hold the country names from csv and the appropriate entity object (this is used when saving the variables and their values)
        country_list_from_csv = {}  # the list of countries taken from the csv file

        with open(qog_downloads_save_location + 'qog.csv') as csvfile:
            reader = csv.DictReader(csvfile)
            for row in reader:
                if row['cname'] not in country_list_from_csv:
                    country_list_from_csv[row['cname']] = 1

        for key, value in country_list_from_csv.items():
            if '(-' in key:  # QoG uses (- year) with country names to denote some historical countries
                country_name = key.replace('-', 'pre ')
            elif '-)' in key:
                country_name = key.replace(key[key.index('('):key.index(')') + 1],
                                           '').strip()  # removing the parenthesis and year from current country names
            else:
                country_name = key

            if country_tool_names_dict.get(unidecode.unidecode(country_name.lower()), 0):
                newentity = Entity.objects.get(
                    name=country_tool_names_dict[unidecode.unidecode(country_name.lower())].owid_name)
            elif country_name in existing_entities_list:
                newentity = Entity.objects.get(name=country_name)
            else:
                newentity = Entity(name=country_name, validated=False)
                newentity.save()
                logger.info("Inserting a country %s." % newentity.name.encode('utf8'))
            country_name_entity_ref[key] = newentity

        for key, category in abbr_category_names.items():
            newdataset = Dataset(name='QoG - ' + category,
                                 description='This is a dataset imported by the automated fetcher',
                                 namespace='qog', fk_dst_cat_id=the_category,
                                 fk_dst_subcat_id=categories_ref_models[category])
            newdataset.save()
            logger.info("Inserting a dataset %s." % newdataset.name.encode('utf8'))
            datasets_ref_models[category] = newdataset

        saved_sources = {}  # variables coming from one source don't all fall into one dataset
        # so we need to save the source info for each dataset where the source's variables are present

        for varcode, vardata in qog_vars.items():
            source_name = varcode[:varcode.index('_') + 1]
            if source_name in saved_sources:
                if vardata['category'] not in saved_sources[source_name]:
                    source_description['additionalInfo'] = qog_sources[source_name]['description']
                    source_description['link'] = "http://qog.pol.gu.se/data"
                    source_description['link'] += ", " + qog_sources[source_name]['url'] if qog_sources[source_name]['url'] else ""
                    source_description['dataPublisherSource'] = qog_sources[source_name]['name']
                    newsource = Source(name='%s via the Quality of Government dataset' % (
                        qog_sources[source_name]['name']),
                                       description=json.dumps(source_description),
                                       datasetId=datasets_ref_models[vardata['category']].pk)
                    # in the metadata file, some of the sources have the same name, but are treated as different sources
                    # so if we see a source with the same name in the same category, we switch to using the original dataset name
                    try:
                        with transaction.atomic():
                            newsource.save()
                    except django.db.utils.IntegrityError:
                        newsource.name = '%s via the Quality of Government dataset' % (
                                          qog_sources[source_name]['original_dataset'])
                        newsource.save()
                    logger.info("Inserting a source %s." % newsource.name.encode('utf8'))
                    saved_sources[source_name].update({vardata['category']: newsource})
            else:
                source_description['additionalInfo'] = qog_sources[source_name]['description']
                source_description['link'] = "http://qog.pol.gu.se/data"
                source_description['link'] += ", " + qog_sources[source_name]['url'] if qog_sources[source_name][
                    'url'] else ""
                source_description['dataPublisherSource'] = qog_sources[source_name]['name']
                newsource = Source(name='%s via the Quality of Government dataset' % (
                    qog_sources[source_name]['name']),
                                   description=json.dumps(source_description),
                                   datasetId=datasets_ref_models[vardata['category']].pk)
                try:
                    with transaction.atomic():
                        newsource.save()
                except django.db.utils.IntegrityError:
                    newsource.name = '%s via the Quality of Government dataset' % (
                        qog_sources[source_name]['original_dataset'])
                    newsource.save()
                logger.info("Inserting a source %s." % newsource.name.encode('utf8'))
                saved_sources[source_name] = {vardata['category']: newsource}
            newvariable = Variable(name='%s - %s' % (vardata['name'], varcode),
                                   unit='',
                                   description=vardata['description'],
                                   code=varcode, timespan=vardata['timespan'],
                                   fk_dst_id=datasets_ref_models[vardata['category']],
                                   fk_var_type_id=VariableType.objects.get(pk=4),
                                   sourceId=newsource)
            newvariable.save()
            logger.info("Inserting a variable %s." % newvariable.name.encode('utf8'))
            vars_ref_models[varcode] = newvariable

        insert_string = 'INSERT into data_values (value, year, fk_ent_id, fk_var_id) VALUES (%s, %s, %s, %s)'  # this is used for constructing the query for mass inserting to the data_values table
        data_values_tuple_list = []

        # now saving the data values
        with open(qog_downloads_save_location + 'qog.csv') as csvfile:
            reader = csv.DictReader(csvfile)
            headers = reader.fieldnames
            for row in reader:
                for header in headers:
                    if (header not in not_var_fields) and (row[header]):
                        data_values_tuple_list.append((row[header], row['year'],
                                                       country_name_entity_ref[row['cname']].pk,
                                                       vars_ref_models[header].pk))
                        total_data_values += 1
                if len(data_values_tuple_list) > 3000:  # insert when the length of the list goes over 3000
                    with connection.cursor() as dbconnection:
                        dbconnection.executemany(insert_string, data_values_tuple_list)
                    logger.info("Dumping data values...")
                    data_values_tuple_list = []

                if reader.line_num % 10 == 0:
                    time.sleep(0.001)  # this is done in order to not keep the CPU busy all the time, the delay after each 10th row is 1 millisecond

        if len(data_values_tuple_list):  # insert any leftover data_values
            with connection.cursor() as dbconnection:
                dbconnection.executemany(insert_string, data_values_tuple_list)
                logger.info("Dumping data values...")

        logger.info("Imported a total of %s data values." % total_data_values)

        newimport = ImportHistory(import_type='qog', import_time=timezone.now().strftime('%Y-%m-%d %H:%M:%S'),
                                  import_notes='Initial import of QoG data. %s data values imported.' % total_data_values,
                                  import_state=json.dumps(
                                      {'file_hash': file_checksum(qog_downloads_save_location + 'qog.csv')}))
        newimport.save()
        # now exporting csvs to the repo
        for category, dataset in datasets_ref_models.items():
            write_dataset_csv(dataset.pk, dataset.name, None, 'qog_fetcher', '')

        logger.info("Import complete.")
    else:
        logger.info("Importing the QoG dataset.")
        last_import = import_history.last()

        if json.loads(last_import.import_state)['file_hash'] == file_checksum(qog_downloads_save_location + 'qog.csv'):
            logger.info("No new data available. Exiting...")
            sys.exit('No updates available.')

        total_data_values = 0
        dataset_id_oldname_list = []  # for using with the csv exporter for version tracking
        qog_datasets = Dataset.objects.filter(namespace='qog')

        existing_variables = Variable.objects.filter(fk_dst_id__in=qog_datasets)
        existing_variables_ids = [item['id'] for item in existing_variables.values('id')]
        existing_variables_codes = [item['code'] for item in existing_variables.values('code')]
        existing_variables_id_code = {item['id']: item['code'] for item in existing_variables.values('id', 'code')}
        existing_variables_code_id = {item['code']: item['id'] for item in existing_variables.values('id', 'code')}
        existing_variables_code_sourceid = {item['code']: item['sourceId'] for item in existing_variables.values('code', 'sourceId')}

        existing_sources = {}
        for each in existing_variables:
            source_name = each.code[:each.code.index('_') + 1]
            category_name = each.fk_dst_id.fk_dst_subcat_id.name
            if source_name in existing_sources:
                if category_name not in existing_sources[source_name]:
                    existing_sources[source_name].update({category_name: each.sourceId})
            else:
                existing_sources[source_name] = {category_name: each.sourceId}

        chart_dimension_vars = ChartDimension.objects.all().values('variableId').distinct()
        chart_dimension_vars_list = {item['variableId'] for item in chart_dimension_vars}

        vars_being_used = []  # we will not be deleting any variables that are currently being used by charts
        for each_var in existing_variables_ids:
            if each_var in chart_dimension_vars_list:
                vars_being_used.append(existing_variables_id_code[each_var])

        new_variables = []

        for varcode, vardata in qog_vars.items():
            new_variables.append(varcode)

        vars_to_add = list(set(new_variables).difference(existing_variables_codes))
        vars_to_delete = list(set(existing_variables_codes).difference(new_variables))

        for each in vars_to_delete:
            delete_source_also = False
            if each not in vars_being_used:
                logger.info("Deleting data values for the variable: %s" % each.encode('utf8'))
                while DataValue.objects.filter(fk_var_id__pk=existing_variables_code_id[each]).first():
                    with connection.cursor() as c:  # if we don't limit the deleted values, the db might just hang
                        c.execute('DELETE FROM %s WHERE fk_var_id = %s LIMIT 10000;' %
                                  (DataValue._meta.db_table, existing_variables_code_id[each]))
                vars_same_source = Variable.objects.filter(sourceId__pk=existing_variables_code_sourceid[each])
                if len(vars_same_source) == 1:  # the source is being used only by one variable
                    if vars_same_source[0].code == each:  # and it is the variable that we are deleting
                        delete_source_also = True
                        source_object = vars_same_source[0].sourceId
                Variable.objects.get(code=each, fk_dst_id__in=qog_datasets).delete()
                logger.info("Deleting the variable: %s" % each.encode('utf8'))
                if delete_source_also:
                    logger.info("Deleting the source: %s" % source_object.name.encode('utf8'))
                    source_object.delete()

        existing_categories = DatasetCategory.objects.values('name')
        existing_categories_list = {item['name'] for item in existing_categories}

        if qog_category_name_in_db not in existing_categories_list:
            the_category = DatasetCategory(name=qog_category_name_in_db, fetcher_autocreated=True)
            the_category.save()
            logger.info("Inserting a category %s." % qog_category_name_in_db.encode('utf8'))
        else:
            the_category = DatasetCategory.objects.get(name=qog_category_name_in_db)

        existing_subcategories = DatasetSubcategory.objects.filter(fk_dst_cat_id=the_category.pk).values('name')
        existing_subcategories_list = {item['name'] for item in existing_subcategories}

        categories_ref_models = {}  # this dict will hold the category name and its corresponding object
        datasets_ref_models = {}  # this dict will hold the dataset name and its corresponding object
        vars_ref_models = {}  # this dict will hold the variable name and its corresponding object

        for key, value in abbr_category_names.items():
            if value not in existing_subcategories_list:
                the_subcategory = DatasetSubcategory(name=value, fk_dst_cat_id=the_category)
                the_subcategory.save()
                logger.info("Inserting a subcategory %s." % value.encode('utf8'))
            else:
                the_subcategory = DatasetSubcategory.objects.get(name=value, fk_dst_cat_id=the_category)
            categories_ref_models[value] = the_subcategory

        existing_entities = Entity.objects.values('name')
        existing_entities_list = {item['name'] for item in existing_entities}

        country_tool_names = CountryName.objects.all()
        country_tool_names_dict = {}
        for each in country_tool_names:
            country_tool_names_dict[each.country_name.lower()] = each.owid_country

        country_name_entity_ref = {}  # this dict will hold the country names from csv and the appropriate entity object (this is used when saving the variables and their values)
        country_list_from_csv = {}  # the list of countries taken from the csv file

        with open(qog_downloads_save_location + 'qog.csv') as csvfile:
            reader = csv.DictReader(csvfile)
            for row in reader:
                if row['cname'] not in country_list_from_csv:
                    country_list_from_csv[row['cname']] = 1

        for key, value in country_list_from_csv.items():
            if '(-' in key:  # QoG uses (- year) with country names to denote some historical countries
                country_name = key.replace('-', 'pre ')
            elif '-)' in key:
                country_name = key.replace(key[key.index('('):key.index(')') + 1],
                                           '').strip()  # removing the parenthesis and year from current country names
            else:
                country_name = key

            if country_tool_names_dict.get(unidecode.unidecode(country_name.lower()), 0):
                newentity = Entity.objects.get(
                    name=country_tool_names_dict[unidecode.unidecode(country_name.lower())].owid_name)
            elif country_name in existing_entities_list:
                newentity = Entity.objects.get(name=country_name)
            else:
                newentity = Entity(name=country_name, validated=False)
                newentity.save()
                logger.info("Inserting a country %s." % newentity.name.encode('utf8'))
            country_name_entity_ref[key] = newentity

        for key, category in abbr_category_names.items():
            if category not in existing_subcategories_list:
                newdataset = Dataset(name='QoG - ' + category,
                                 description='This is a dataset imported by the automated fetcher',
                                 namespace='qog', fk_dst_cat_id=the_category,
                                 fk_dst_subcat_id=categories_ref_models[category])
                newdataset.save()
                dataset_id_oldname_list.append({'id': newdataset.pk, 'newname': newdataset.name, 'oldname': None})
                logger.info("Inserting a dataset %s." % newdataset.name.encode('utf8'))
            else:
                newdataset = Dataset.objects.get(namespace='qog', fk_dst_cat_id=the_category, fk_dst_subcat_id=categories_ref_models[category])
                dataset_id_oldname_list.append({'id': newdataset.pk, 'newname': newdataset.name, 'oldname': newdataset.name})
            datasets_ref_models[category] = newdataset

        up_to_date_sources = {}

        for each in vars_to_add:
            source_name = each[:each.index('_') + 1]
            category = qog_vars[each]['category']
            if source_name in existing_sources:
                if category in existing_sources[source_name]:
                    if category not in up_to_date_sources:
                        source = existing_sources[source_name][category]
                        source.name = '%s via the Quality of Government dataset' % (
                                        qog_sources[source_name]['name'])
                        source_description['additionalInfo'] = qog_sources[source_name]['description']
                        source_description['link'] = "http://qog.pol.gu.se/data"
                        source_description['link'] += ", " + qog_sources[source_name]['url'] if \
                        qog_sources[source_name]['url'] else ""
                        source_description['dataPublisherSource'] = qog_sources[source_name]['name']
                        source.description = json.dumps(source_description)
                        source.datasetId = datasets_ref_models[category].pk
                        try:
                            with transaction.atomic():
                                source.save()
                        except django.db.utils.IntegrityError:
                            source.name = '%s via the Quality of Government dataset' % (
                                qog_sources[source_name]['original_dataset'])
                            source.save()
                        logger.info("Updating the source %s." % source.name.encode('utf8'))
                    elif category not in up_to_date_sources[source_name]:
                        source = existing_sources[source_name][category]
                        source.name = '%s via the Quality of Government dataset' % (
                                        qog_sources[source_name]['name'])
                        source_description['additionalInfo'] = qog_sources[source_name]['description']
                        source_description['link'] = "http://qog.pol.gu.se/data"
                        source_description['link'] += ", " + qog_sources[source_name]['url'] if \
                        qog_sources[source_name]['url'] else ""
                        source_description['dataPublisherSource'] = qog_sources[source_name]['name']
                        source.description = json.dumps(source_description)
                        source.datasetId = datasets_ref_models[category].pk
                        try:
                            with transaction.atomic():
                                source.save()
                        except django.db.utils.IntegrityError:
                            source.name = '%s via the Quality of Government dataset' % (
                                qog_sources[source_name]['original_dataset'])
                            source.save()
                        logger.info("Updating the source %s." % source.name.encode('utf8'))
                else:
                    source_description['additionalInfo'] = qog_sources[source_name]['description']
                    source_description['link'] = "http://qog.pol.gu.se/data"
                    source_description['link'] += ", " + qog_sources[source_name]['url'] if qog_sources[source_name][
                        'url'] else ""
                    source_description['dataPublisherSource'] = qog_sources[source_name]['name']
                    source = Source(name='%s via the Quality of Government dataset' % (
                        qog_sources[source_name]['name']),
                                       description=json.dumps(source_description),
                                       datasetId=datasets_ref_models[category].pk)
                    try:
                        with transaction.atomic():
                            source.save()
                    except django.db.utils.IntegrityError:
                        source.name = '%s via the Quality of Government dataset' % (
                                          qog_sources[source_name]['original_dataset'])
                        source.save()
                    logger.info("Inserting the source %s." % source.name.encode('utf8'))
                    existing_sources[source_name].update({category: source})
            else:
                source_description['additionalInfo'] = qog_sources[source_name]['description']
                source_description['link'] = "http://qog.pol.gu.se/data"
                source_description['link'] += ", " + qog_sources[source_name]['url'] if qog_sources[source_name][
                    'url'] else ""
                source_description['dataPublisherSource'] = qog_sources[source_name]['name']
                source = Source(name='%s via the Quality of Government dataset' % (
                    qog_sources[source_name]['name']),
                                description=json.dumps(source_description),
                                datasetId=datasets_ref_models[category].pk)
                try:
                    with transaction.atomic():
                        source.save()
                except django.db.utils.IntegrityError:
                    source.name = '%s via the Quality of Government dataset' % (
                        qog_sources[source_name]['original_dataset'])
                    source.save()
                logger.info("Inserting the source %s." % source.name.encode('utf8'))
                existing_sources[source_name] = {category: source}

            if source_name not in up_to_date_sources:
                up_to_date_sources[source_name] = {category: 1}  # we don't really need to keep the source objects
            else:                                                # for this dict like we did above
                if category not in up_to_date_sources[source_name]:
                    up_to_date_sources[source_name].update({category: 1})

            newvariable = Variable(name='%s - %s' % (qog_vars[each]['name'], each),
                                   unit='',
                                   description=qog_vars[each]['description'],
                                   code=each, timespan=qog_vars[each]['timespan'],
                                   fk_dst_id=datasets_ref_models[category],
                                   fk_var_type_id=VariableType.objects.get(pk=4),
                                   sourceId=source)
            newvariable.save()
            logger.info("Inserting a variable %s." % newvariable.name.encode('utf8'))
            vars_ref_models[each] = newvariable

        for varcode, vardata in qog_vars.items():
            if varcode not in vars_to_add:
                source_name = varcode[:varcode.index('_') + 1]
                category = qog_vars[varcode]['category']

                if source_name in existing_sources:
                    if category in existing_sources[source_name]:
                        if category not in up_to_date_sources:
                            source = existing_sources[source_name][category]
                            source_description['additionalInfo'] = qog_sources[source_name]['description']
                            source_description['link'] = "http://qog.pol.gu.se/data"
                            source_description['link'] += ", " + qog_sources[source_name]['url'] if \
                            qog_sources[source_name]['url'] else ""
                            source_description['dataPublisherSource'] = qog_sources[source_name]['name']
                            source.name = '%s via the Quality of Government dataset' % (
                                qog_sources[source_name]['name'])
                            source.description = json.dumps(source_description)
                            source.datasetId = datasets_ref_models[category].pk
                            try:
                                with transaction.atomic():
                                    source.save()
                            except django.db.utils.IntegrityError:
                                source.name = '%s via the Quality of Government dataset' % (
                                    qog_sources[source_name]['original_dataset'])
                                source.save()
                            logger.info("Updating the source %s." % source.name.encode('utf8'))
                        elif category not in up_to_date_sources[source_name]:
                            source = existing_sources[source_name][category]
                            source_description['additionalInfo'] = qog_sources[source_name]['description']
                            source_description['link'] = "http://qog.pol.gu.se/data"
                            source_description['link'] += ", " + qog_sources[source_name]['url'] if \
                            qog_sources[source_name]['url'] else ""
                            source_description['dataPublisherSource'] = qog_sources[source_name]['name']
                            source.name = '%s via the Quality of Government dataset' % (
                                qog_sources[source_name]['name'])
                            source.description = json.dumps(source_description)
                            source.datasetId = datasets_ref_models[category].pk
                            try:
                                with transaction.atomic():
                                    source.save()
                            except django.db.utils.IntegrityError:
                                source.name = '%s via the Quality of Government dataset' % (
                                    qog_sources[source_name]['original_dataset'])
                                source.save()
                            logger.info("Updating the source %s." % source.name.encode('utf8'))
                    else:
                        source_description['additionalInfo'] = qog_sources[source_name]['description']
                        source_description['link'] = "http://qog.pol.gu.se/data"
                        source_description['link'] += ", " + qog_sources[source_name]['url'] if \
                        qog_sources[source_name]['url'] else ""
                        source_description['dataPublisherSource'] = qog_sources[source_name]['name']
                        source = Source(name='%s via the Quality of Government dataset' % (
                            qog_sources[source_name]['name']),
                                        description=json.dumps(source_description),
                                        datasetId=datasets_ref_models[category].pk)
                        try:
                            with transaction.atomic():
                                source.save()
                        except django.db.utils.IntegrityError:
                            source.name = '%s via the Quality of Government dataset' % (
                                qog_sources[source_name]['original_dataset'])
                            source.save()
                        logger.info("Inserting the source %s." % source.name.encode('utf8'))
                        existing_sources[source_name].update({category: source})
                else:
                    source_description['additionalInfo'] = qog_sources[source_name]['description']
                    source_description['link'] = "http://qog.pol.gu.se/data"
                    source_description['link'] += ", " + qog_sources[source_name]['url'] if qog_sources[source_name][
                        'url'] else ""
                    source_description['dataPublisherSource'] = qog_sources[source_name]['name']
                    source = Source(name='%s via the Quality of Government dataset' % (
                        qog_sources[source_name]['name']),
                                    description=json.dumps(source_description),
                                    datasetId=datasets_ref_models[category].pk)
                    try:
                        with transaction.atomic():
                            source.save()
                    except django.db.utils.IntegrityError:
                        source.name = '%s via the Quality of Government dataset' % (
                                          qog_sources[source_name]['original_dataset'])
                        source.save()
                    logger.info("Inserting the source %s." % source.name.encode('utf8'))
                    existing_sources[source_name] = {category: source}

                if source_name not in up_to_date_sources:
                    up_to_date_sources[source_name] = {category: 1}  # we don't really need to keep the source objects
                else:                                                # for this dict like we did above
                    if category not in up_to_date_sources[source_name]:
                        up_to_date_sources[source_name].update({category: 1})

                variable = Variable.objects.get(code=varcode, fk_dst_id__in=qog_datasets)
                variable.name = '%s - %s' % (vardata['name'], varcode)
                variable.unit = ''
                variable.description = vardata['description']
                variable.timespan = vardata['timespan']
                variable.fk_dst_id = datasets_ref_models[vardata['category']]
                variable.fk_var_type_id = VariableType.objects.get(pk=4)
                variable.sourceId = source
                variable.save()
                logger.info("Updating the variable %s." % variable.name.encode('utf8'))
                vars_ref_models[varcode] = variable

                logger.info("Deleting data values for the variable: %s" % variable.name.encode('utf8'))
                while DataValue.objects.filter(fk_var_id__pk=variable.pk).first():
                    with connection.cursor() as c:
                        c.execute('DELETE FROM %s WHERE fk_var_id = %s LIMIT 10000;' %
                                  (DataValue._meta.db_table, variable.pk))

        insert_string = 'INSERT into data_values (value, year, fk_ent_id, fk_var_id) VALUES (%s, %s, %s, %s)'  # this is used for constructing the query for mass inserting to the data_values table
        data_values_tuple_list = []

        # now saving the data values
        with open(qog_downloads_save_location + 'qog.csv') as csvfile:
            reader = csv.DictReader(csvfile)
            headers = reader.fieldnames
            for row in reader:
                for header in headers:
                    if (header not in not_var_fields) and (row[header]):
                        data_values_tuple_list.append((row[header], row['year'],
                                                       country_name_entity_ref[row['cname']].pk,
                                                       vars_ref_models[header].pk))
                        total_data_values += 1
                if len(data_values_tuple_list) > 3000:  # insert when the length of the list goes over 3000
                    with connection.cursor() as dbconnection:
                        dbconnection.executemany(insert_string, data_values_tuple_list)
                    logger.info("Dumping data values...")
                    data_values_tuple_list = []

                if reader.line_num % 10 == 0:
                    time.sleep(0.001)  # this is done in order to not keep the CPU busy all the time, the delay after each 10th row is 1 millisecond

        if len(data_values_tuple_list):  # insert any leftover data_values
            with connection.cursor() as dbconnection:
                dbconnection.executemany(insert_string, data_values_tuple_list)
                logger.info("Dumping data values...")

        # now deleting subcategories and datasets that are empty (that don't contain any variables), if any

        all_qog_datasets = Dataset.objects.filter(namespace='qog')
        all_qog_datasets_with_vars = Variable.objects.filter(fk_dst_id__in=all_qog_datasets).values('fk_dst_id').distinct()
        all_qog_datasets_with_vars_dict = {item['fk_dst_id'] for item in all_qog_datasets_with_vars}

        for each in all_qog_datasets:
            if each.pk not in all_qog_datasets_with_vars_dict:
                cat_to_delete = each.fk_dst_subcat_id
                logger.info("Deleting empty dataset %s." % each.name)
                logger.info("Deleting empty category %s." % cat_to_delete.name)
                each.delete()
                cat_to_delete.delete()

        logger.info("Imported a total of %s data values." % total_data_values)

        newimport = ImportHistory(import_type='qog', import_time=timezone.now().strftime('%Y-%m-%d %H:%M:%S'),
                                  import_notes='Imported a total of %s data values.' % total_data_values,
                                  import_state=json.dumps(
                                       {'file_hash': file_checksum(qog_downloads_save_location + 'qog.csv')}))
        newimport.save()

        # now exporting csvs to the repo
        for dataset in dataset_id_oldname_list:
            write_dataset_csv(dataset['id'], dataset['newname'], dataset['oldname'], 'qog_fetcher', '')

        logger.info("Import complete.")


print("--- %s seconds ---" % (time.time() - start_time))
