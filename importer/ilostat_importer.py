import sys
import os
import hashlib
import io
import json
import requests
import unidecode
import shutil
import time
import csv
import django.db
import glob
import gzip
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
import lxml.html

# IMPORTANT: The files in the ILOSTAT dataset contain many values for the same variable, country and year but from
# different sources. There is no easy way to split these datasets by sources, and this makes importing the values
# difficult. The way this script will import the data is it will detect the most used source for each variable,
# and will import the values coming from that source only.


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


def short_unit_extract(unit: str):
    common_short_units = ['$', '£', '€', '%']  # used for extracting short forms of units of measurement
    short_unit = None
    if unit:
        if ' per ' in unit:
            short_form = unit.split(' per ')[0]
            if any(w in short_form for w in common_short_units):
                for x in common_short_units:
                    if x in short_form:
                        short_unit = x
                        break
            else:
                short_unit = short_form
        elif any(x in unit for x in common_short_units):
            for y in common_short_units:
                if y in unit:
                    short_unit = y
                    break
        elif 'percentage' in unit:
            short_unit = '%'
        elif 'percent' in unit.lower():
            short_unit = '%'
        elif len(unit) < 9:  # this length is sort of arbitrary at this point, taken from the unit 'hectares'
            short_unit = unit
    return short_unit


def process_entities(country_names_dictionary):
    existing_entities = Entity.objects.values('name')
    existing_entities_list = {item['name'].lower() for item in existing_entities}

    country_tool_names = CountryName.objects.all()
    country_tool_names_dict = {}

    for each_country in country_tool_names:
        country_tool_names_dict[each_country.country_name.lower()] = each_country.owid_country

    c_name_entity_ref = {}  # this dict will hold the country names from excel and the appropriate entity object (this is used when saving the variables and their values)

    for c_code, country_name in country_names_dictionary.items():
        if country_tool_names_dict.get(unidecode.unidecode(country_name.lower()), 0):
            newentity = Entity.objects.get(
                name=country_tool_names_dict[unidecode.unidecode(country_name.lower())].owid_name)
        elif country_name.lower() in existing_entities_list:
            newentity = Entity.objects.get(name__iexact=country_name)
        else:
            newentity = Entity(name=country_name, validated=False)
            newentity.save()
        c_name_entity_ref[c_code] = newentity

    return c_name_entity_ref


# only the files listed here will be imported
list_of_files_to_import = ['EAP_2EAP_SEX_AGE_NB_A','EAP_2WAF_NOC_RT_A','EAP_2WAM_NOC_RT_A','EAP_2WAP_NOC_RT_A','EAP_2WAP_SEX_AGE_RT_A','EAP_DWAF_NOC_RT_A','EAP_DWAM_NOC_RT_A','EAP_DWAP_NOC_RT_A','EAP_DYAF_NOC_RT_A','EAP_DYAM_NOC_RT_A','EAP_DYAP_NOC_RT_A','EAR_4HPM_NOC_NB_A','EAR_4HPT_NOC_NB_A','EAR_4HPW_NOC_NB_A','EAR_4MMN_CUR_NB_A','EAR_4MNP_NOC_NB_A','EAR_4MPM_NOC_NB_A','EAR_4MPT_NOC_NB_A','EAR_4MPW_NOC_NB_A','EAR_FEAR_NOC_NB_A','EAR_GGAP_NOC_RT_A','EAR_INEE_NOC_NB_A','EAR_MEAR_NOC_NB_A','EAR_MREE_NOC_GR_A','EAR_TEAR_NOC_NB_A','EAR_XFLS_NOC_RT_A','EAR_XMFG_NOC_NB_A','EES_3048_NOC_RT_A','EES_FG48_NOC_RT_A','EES_FNAG_NOC_RT_A','EES_LT30_NOC_RT_A','EES_MG48_NOC_RT_A','EES_MNAG_NOC_RT_A','EES_TG48_NOC_RT_A','EES_TNAG_NOC_RT_A','EES_TNAG_SEX_RT_A','EES_XTMP_SEX_RT_A','EIP_2EIP_SEX_AGE_NB_A','EIP_FNEE_NOC_RT_A','EIP_MNEE_NOC_RT_A','EIP_NEET_SEX_NB_A','EIP_NEET_SEX_RT_A','EIP_TNEE_NOC_RT_A','EMP_2AGR_NOC_RT_A','EMP_2CFW_NOC_RT_A','EMP_2EER_NOC_RT_A','EMP_2EES_NOC_RT_A','EMP_2IND_NOC_RT_A','EMP_2MEP_NOC_RT_A','EMP_2OAW_NOC_RT_A','EMP_2SRV_NOC_RT_A','EMP_2WAP_NOC_RT_A','EMP_2WEP_NOC_RT_A','EMP_2YEP_NOC_RT_A','EMP_DWAF_NOC_RT_A','EMP_DWAM_NOC_RT_A','EMP_DWAP_NOC_RT_A','EMP_FAGR_NOC_RT_A','EMP_FCFW_NOC_RT_A','EMP_FEER_NOC_RT_A','EMP_FIND_NOC_RT_A','EMP_FOAW_NOC_RT_A','EMP_FSRV_NOC_RT_A','EMP_MCFW_NOC_RT_A','EMP_MEER_NOC_RT_A','EMP_MOAW_NOC_RT_A','EMP_PTER_SEX_RT_A','EMP_TAGR_NOC_RT_A','EMP_TCFW_NOC_RT_A','EMP_TEER_NOC_RT_A','EMP_TIND_NOC_RT_A','EMP_TOAW_NOC_RT_A','EMP_TSRV_NOC_RT_A','EMP_XFMG_NOC_RT_A','GDP_205U_NOC_NB_A','GDP_211P_NOC_NB_A','HOW_TEMP_NOC_NB_A','IFL_IECN_SEX_ECO_NB_A','ILR_CBCT_NOC_RT_A','ILR_TUMT_NOC_RT_A','INJ_TLPI_NOC_NB_A','LAC_TLAC_NOC_NB_A','LAC_XMFG_NOC_NB_A','LAI_INDE_NOC_RT_A','LAP_DGVA_NOC_RT_A','MFL_TEMP_OCU_NB_A','MST_TPOP_COU_NB_A','MST_TPOP_SEX_MIG_NB_A','POP_2FLF_NOC_RT_A','POP_2LDR_NOC_RT_A','POP_2MLF_NOC_RT_A','POP_2POP_GEO_NB_A','POP_2TLF_NOC_RT_A','POP_AEDA_NOC_RT_A','POV_DEMF_NOC_RT_A','POV_DEMM_NOC_RT_A','POV_DEMP_NOC_RT_A','POV_GT13_NOC_RT_A','POV_P2T3_NOC_RT_A','POV_P3T5_NOC_RT_A','POV_PLT1_NOC_RT_A','SDG_0111_SEX_AGE_RT_A','SDG_0131_SEX_SOC_RT_A','SDG_0552_OCU_RT_A','SDG_0821_NOC_RT_A','SDG_0851_SEX_OCU_NB_A','SDG_0852_SEX_AGE_RT_A','SDG_0861_SEX_RT_A','SDG_0871_SEX_AGE_NB_A','SDG_0871_SEX_AGE_RT_A','SDG_0922_NOC_RT_A','SDG_1041_NOC_RT_A','SDG_A831_SEX_RT_A','SDG_B831_SEX_RT_A','SDG_F881_SEX_MIG_RT_A','SDG_N881_SEX_MIG_RT_A','SOC_PEXN_NOC_RT_A','SOC_PPNT_NOC_RT_A','SOC_SOCT_NOC_RT_A','UNE_2EAP_NOC_RT_A','UNE_2URM_NOC_RT_A','UNE_2URW_NOC_RT_A','UNE_2YAP_NOC_RT_A','UNE_DEAF_NOC_RT_A','UNE_DEAM_NOC_RT_A','UNE_DEAP_NOC_RT_A','UNE_DYAF_NOC_RT_A','UNE_DYAM_NOC_RT_A','UNE_DYAP_NOC_RT_A','UNE_EDAD_NOC_RT_A','UNE_EDBS_NOC_RT_A','UNE_EDIN_NOC_RT_A','UNE_LGTD_NOC_RT_A']


source_description = {
    'dataPublishedBy': "ILOSTAT",
    'link': "http://www.ilo.org/ilostat/",
    'retrievedDate': timezone.now().strftime("%d-%B-%y"),
    'dataPublisherSource': 'ILOSTAT relies on multiple sources. The list of sources for each indicator, country by country, can be found in the ILOSTAT documentation under the bulk download facility, available at http://www.ilo.org/ilostat/faces/oracle/webcenter/portalapp/pagehierarchy/Page30.jspx',
    'additionalInfo': None
}

ilostat_indicator_page = 'http://www.ilo.org/ilostat-files/WEB_bulk_download/html/bulk_indicator.html'
ilostat_dic_page = 'http://www.ilo.org/ilostat-files/WEB_bulk_download/html/bulk_dic.html'

ilostat_downloads_save_location = settings.BASE_DIR + '/data/ilostat/'
ilostat_downloads_indicator = ilostat_downloads_save_location + 'indicator'
ilostat_downloads_dic = ilostat_downloads_save_location + 'dic'

ilostat_table_of_contents = ilostat_downloads_save_location + 'table_of_contents_en.csv'  # this file needs to be downloaded from the ILOSTAT bulk download folder

# create a directory for holding the downloads

if not os.path.exists(ilostat_downloads_save_location):
    os.makedirs(ilostat_downloads_save_location)
if not os.path.exists(ilostat_downloads_indicator):
    os.makedirs(ilostat_downloads_indicator)
if not os.path.exists(ilostat_downloads_dic):
    os.makedirs(ilostat_downloads_dic)

# uncomment this block to download new versions of files

# request_header = {'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_10_1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/39.0.2171.95 Safari/537.36'}
#
# r = requests.get(ilostat_indicator_page, headers=request_header)
# if r.ok:
#     indicator_page_html = lxml.html.fromstring(r.text)
#     all_trs = indicator_page_html.xpath('//tr')
#     for eachtr in all_trs:
#         alltds = eachtr.xpath('.//td/a/@href')
#         for eachatag in alltds:
#             if eachatag.strip().endswith('_A.csv.gz'):  # we want only the datasets that contain values annually.
#                 rr = requests.get(eachatag.strip(), stream=True, headers=request_header)
#                 if rr.ok:
#                     with open(ilostat_downloads_indicator + '/' + eachatag.rsplit('/', 1)[-1].strip(), 'wb') as out_file:
#                         shutil.copyfileobj(rr.raw, out_file)
#                 else:
#                     sys.exit('Could not download file %s Exiting...' % eachatag)
# else:
#     sys.exit('Could not open the Indicators page. Exiting...')
#
# r = requests.get(ilostat_dic_page, headers=request_header)
# if r.ok:
#     dic_page_html = lxml.html.fromstring(r.text)
#     all_trs = dic_page_html.xpath('//tr')
#     for eachtr in all_trs:
#         alltds = eachtr.xpath('.//td/a/@href')
#         for eachatag in alltds:
#             if eachatag.strip().endswith('.csv'):
#                 rr = requests.get(eachatag.strip(), stream=True, headers=request_header)
#                 if rr.ok:
#                     with open(ilostat_downloads_dic + '/' + eachatag.rsplit('/', 1)[-1].strip(), 'wb') as out_file:
#                         shutil.copyfileobj(rr.raw, out_file)
#                 else:
#                     sys.exit('Could not download file %s Exiting...' % eachatag)
# else:
#     sys.exit('Could not open the Dictionaries page. Exiting...')

# this will load all metadata info into metadata dict
# text values for all the codes from data files can be retrieved from this dict
metadata = {}
for file in glob.glob(ilostat_downloads_dic + "/*.csv"):
    one_file = os.path.basename(file)
    if '_en' in one_file:
        with gzip.open(file, 'rt', encoding='utf8') as f:
            file_content = f.read().replace('\ufeff', '')
            reader = csv.DictReader(io.StringIO(file_content))
            metadata[reader.fieldnames[0].strip()] = {}
            for row in reader:
                metadata[reader.fieldnames[0].strip()][row[reader.fieldnames[0]]] = {reader.fieldnames[1].strip(): row[reader.fieldnames[1]], reader.fieldnames[2].strip(): row[reader.fieldnames[2]]}


file_name_to_category = {}

data = {}

with open(ilostat_table_of_contents, 'r', encoding='utf8') as tcontents:
    reader = csv.DictReader(tcontents)
    for row in reader:
        if not row['subject.label'].strip():
            file_name_to_category[row['indicator']] = 'Other'
        else:
            file_name_to_category[row['indicator']] = row['subject.label']

row_number = 0
# we will be counting up the number of each source for each variable in the files
for file in glob.glob(ilostat_downloads_indicator + "/*.gz"):
    one_file = os.path.basename(file)
    if one_file.replace('.csv.gz', '') not in list_of_files_to_import:
        continue
    with gzip.open(file, 'rb') as f_in, open(file.replace('.gz', ''), 'wb') as f_out:
        shutil.copyfileobj(f_in, f_out)
    with open(file.replace('.gz', ''), 'r', encoding='utf8') as f:
        reader = csv.DictReader(f)
        print('Processing %s' % one_file)
        for row in reader:
            row_number += 1
            if '_NOC_' in one_file:
                var_code = row['indicator']
            else:
                var_code = row['indicator']
                if 'classif1' in reader.fieldnames:
                    var_code += ' ' + row['classif1']
                if 'classif2' in reader.fieldnames:
                    var_code += ' ' + row['classif2']
                if 'sex' in reader.fieldnames:
                    var_code += ' ' + row['sex']
            source_abbr = row['source']
            if var_code not in data:
                data[var_code] = { row['ref_area']: { source_abbr: 1 } }
            else:
                if row['ref_area'] not in data[var_code]:
                    data[var_code][row['ref_area']] = {source_abbr : 1}
                else:
                    if source_abbr not in data[var_code][row['ref_area']]:
                        data[var_code][row['ref_area']][source_abbr] = 1
                    else:
                        data[var_code][row['ref_area']][source_abbr] += 1

            if row_number % 100 == 0:
                time.sleep(
                    0.001)  # this is done in order to not keep the CPU busy all the time, the delay after each 100th row is 1 millisecond

preffered_sources = {}
# selecting the most used source for each variable
for eachvar, vardata in data.items():
    preffered_sources[eachvar] = {}
    for eachcountry, sourcedata in vardata.items():
        current_highest_abbr = None
        current_highest_number = 0
        for eachsource, sourcecount in sourcedata.items():
            if sourcecount > current_highest_number:
                current_highest_number = sourcecount
                current_highest_abbr = eachsource
        preffered_sources[eachvar][eachcountry] = current_highest_abbr

data = None

ilostat_category_name_in_db = 'ILOSTAT Datasets'  # set the name of the root category of all data that will be imported by this script

with transaction.atomic():

    new_datasets_list = []
    old_datasets_list = []

    country_metadata = metadata['ref_area']
    country_code_names_dict = {}
    for country_code, country_dict in country_metadata.items():
        country_code_names_dict[country_code] = country_dict['ref_area.label']
        if country_code_names_dict[country_code] == 'Congo, Democratic Republic of the':
            country_code_names_dict[country_code] = 'Democratic Republic of Congo'
        if country_code_names_dict[country_code] == 'Ethiopia (including Eritrea)':
            country_code_names_dict[country_code] = 'Eritrea and Ethiopia'
        if country_code_names_dict[country_code] == 'Germany, 5 new Länder and Berlin (East)':
            country_code_names_dict[country_code] = 'Germany'
        if country_code_names_dict[country_code] == 'Germany, Fed. Rep. of before 3.10.1990':
            country_code_names_dict[country_code] = 'Germany'
        if country_code_names_dict[country_code] == 'Germany, The former German Dem. Rep.':
            country_code_names_dict[country_code] = 'Germany'
        if country_code_names_dict[country_code] == "Korea, Democratic People's Republic of":
            country_code_names_dict[country_code] = 'North Korea'
        if country_code_names_dict[country_code] == 'Macedonia, the former Yugoslav Republic of':
            country_code_names_dict[country_code] = 'Macedonia'
        if country_code_names_dict[country_code] == 'Malaysia: Peninsular Malaysia':
            country_code_names_dict[country_code] = 'Peninsular Malaysia'
        if country_code_names_dict[country_code] == 'Malaysia: Sabah':
            country_code_names_dict[country_code] = 'Sabah'
        if country_code_names_dict[country_code] == 'Malaysia: Sarawak':
            country_code_names_dict[country_code] = 'Sarawak'
        if country_code_names_dict[country_code] == 'Moldova, Republic of':
            country_code_names_dict[country_code] = 'Moldova'
        if country_code_names_dict[country_code] == 'Tanzania (Tanganyika)':
            country_code_names_dict[country_code] = 'Tanganyika'
        if country_code_names_dict[country_code] == 'Tanzania (Zanzibar)':
            country_code_names_dict[country_code] = 'Zanzibar'
        if country_code_names_dict[country_code] == 'Tanzania, United Republic of':
            country_code_names_dict[country_code] = 'Tanzania'
        if country_code_names_dict[country_code] == 'Venezuela, Bolivarian Republic of':
            country_code_names_dict[country_code] = 'Venezuela'
        if country_code_names_dict[country_code] == 'Yemen, The former Arab Rep. of':
            country_code_names_dict[country_code] = 'Yemen'
        if country_code_names_dict[country_code] == 'Yemen, The former Democratic':
            country_code_names_dict[country_code] = 'Yemen'
        if country_code_names_dict[country_code] == 'Yugoslavia, The former Socialist Fed. Rep. of':
            country_code_names_dict[country_code] = 'Macedonia'

    country_code_entity_object_ref = process_entities(country_code_names_dict)

    for file in glob.glob(ilostat_downloads_indicator + "/*.gz"):
        one_file = os.path.basename(file)
        if one_file.replace('.csv.gz', '') not in list_of_files_to_import:
            continue
        import_history = ImportHistory.objects.filter(import_type='ilostat')
        file_imported_before = False
        for oneimport in import_history:
            if json.loads(oneimport.import_state)['file_name'] == one_file:
                file_imported_before = True
                imported_before_hash = json.loads(oneimport.import_state)['file_hash']

        # if ilostat imports for this file were never performed
        if not file_imported_before:
            existing_categories = DatasetCategory.objects.values('name')
            existing_categories_list = {item['name'] for item in existing_categories}

            if ilostat_category_name_in_db not in existing_categories_list:
                the_category = DatasetCategory(name=ilostat_category_name_in_db, fetcher_autocreated=True)
                the_category.save()

            else:
                the_category = DatasetCategory.objects.get(name=ilostat_category_name_in_db)

            existing_subcategories = DatasetSubcategory.objects.filter(categoryId=the_category.pk).values(
                'name')
            existing_subcategories_list = {item['name'].lower() for item in existing_subcategories}

            datasetname_to_object = {}

            variables = {}

            with gzip.open(file, 'rb') as f_in, open(file.replace('.gz', ''), 'wb') as f_out:
                shutil.copyfileobj(f_in, f_out)
            with open(file.replace('.gz', ''), 'r', encoding='utf8') as f:
                reader = csv.DictReader(f)
                print('Processing %s' % one_file)
                for row in reader:  # this for loop scans the file and creates categories, datasets, variables and sources
                    row_number += 1
                    if '_NOC_' in one_file:
                        var_code = row['indicator']
                    else:
                        var_code = row['indicator']
                        if 'classif1' in reader.fieldnames:
                            var_code += ' ' + row['classif1']
                        if 'classif2' in reader.fieldnames:
                            var_code += ' ' + row['classif2']
                        if 'sex' in reader.fieldnames:
                            var_code += ' ' + row['sex']
                    source_abbr = row['source']

                    if source_abbr == preffered_sources[var_code][row['ref_area']]:

                        the_subcategory_name = file_name_to_category[row['indicator']]

                        if the_subcategory_name not in datasetname_to_object:

                            if the_subcategory_name.lower() not in existing_subcategories_list:
                                the_subcategory = DatasetSubcategory(name=the_subcategory_name, categoryId=the_category)
                                the_subcategory.save()
                                newdataset = Dataset(name=the_subcategory_name,
                                                     description='This is a dataset imported by the automated fetcher',
                                                     namespace='ilostat', categoryId=the_category,
                                                     subcategoryId=the_subcategory)
                                newdataset.save()
                                new_datasets_list.append(newdataset)
                                datasetname_to_object[the_subcategory_name] = newdataset
                            else:
                                the_subcategory = DatasetSubcategory.objects.get(name=the_subcategory_name,
                                                                                 categoryId=the_category)
                                newdataset = Dataset.objects.get(name=the_subcategory_name,
                                                                 namespace='ilostat')
                                datasetname_to_object[the_subcategory_name] = newdataset


                        the_indicator_label = None
                        the_indicator_code = None

                        the_indicator_label = metadata['indicator'][row['indicator']]['indicator.label']
                        the_indicator_code = row['indicator']
                        variable_name = the_indicator_label
                        if 'classif1' in reader.fieldnames:
                            if row['classif1'] != 'NOC_VALUE':
                                if row['classif1'] == 'ECO_EQISIC4ISIC3_10_151-154':  # this is done to avoid very long variable names
                                    variable_name += ' - ' + 'ISIC-Rev.3: Production, processing and preservation of meat, fish, fruit, vegetables, oils and fats'
                                elif row['classif1'] == 'OCU_EQISCO08ISCO88_71_712-714':
                                    variable_name += ' - ' + 'ISCO-88: Building frame and related trades workers'
                                elif row['classif1'] == 'ECO_ISIC4_T':
                                    variable_name += ' - ' + 'ISIC-Rev.4: Activities of households as employers'
                                elif row['classif1'] == 'ECO_ISIC3_P':
                                    variable_name += ' - ' + 'ISIC-Rev.3: Activities of private households as employers'
                                elif row['classif1'] == 'ECO_ISIC3_G':
                                    variable_name += ' - ' + 'ISIC-Rev.3: Wholesale and retail trade'
                                else:
                                    variable_name += ' - ' + metadata['classif1'][row['classif1']]['classif1.label']
                        if 'classif2' in reader.fieldnames:
                            if row['classif2'] == 'ECO_ISIC3_G':
                                variable_name += ' - ' + 'ISIC-Rev.3: Wholesale and retail trade'
                            elif row['classif2'] == 'ECO_ISIC3_P':
                                variable_name += ' - ' + 'ISIC-Rev.3: Activities of private households as employers'
                            elif row['classif2'] == 'ECO_ISIC4_T':
                                variable_name += ' - ' + 'ISIC-Rev.4: Activities of households as employers'
                            elif row['classif2'] == 'OCU_EQISCO08ISCO88_71_712-714':
                                variable_name += ' - ' + 'ISCO-88: Building frame and related trades workers'
                            elif row['classif2'] == 'ECO_EQISIC4ISIC3_10_151-154':
                                variable_name += ' - ' + 'ISIC-Rev.3: Production, processing and preservation of meat, fish, fruit, vegetables, oils and fats'
                            else:
                                variable_name += ' - ' + metadata['classif2'][row['classif2']]['classif2.label']
                        if 'sex' in reader.fieldnames:
                            variable_name += ' - ' + metadata['sex'][row['sex']]['sex.label']
                        if variable_name not in variables:
                            variables[variable_name] = {
                                'category': file_name_to_category[row['indicator']],
                                'note_source': set(),
                                'note_indicator': set(),
                                'source': set(),
                                'classif1_code': row['classif1'] if 'classif1' in reader.fieldnames else None,
                                'classif2_code': row['classif2'] if 'classif2' in reader.fieldnames else None,
                                'sex_code': row['sex'] if 'sex' in reader.fieldnames else None
                            }
                        variables[variable_name]['source'].add(' - '.join(metadata['source'][row['source']]['source.label'].split(' - ')[2:]))
                        if 'note_source' in reader.fieldnames and row['note_source']:
                            note_sources_list = row['note_source'].split('_')
                            for eachnotesource in note_sources_list:
                                variables[variable_name]['note_source'].add(metadata['note_source'][eachnotesource]['note_source.label'])
                        if 'note_indicator' in reader.fieldnames and row['note_indicator']:
                            note_indicators_list = row['note_indicator'].split('_')
                            for eachnoteindicator in note_indicators_list:
                                variables[variable_name]['note_indicator'].add(metadata['note_indicator'][eachnoteindicator]['note_indicator.label'])

                    if row_number % 100 == 0:
                        time.sleep(
                                0.001)  # this is done in order to not keep the CPU busy all the time, the delay after each 100th row is 1 millisecond

                varcode_to_object = {}
                for varname, sourcedata in variables.items():

                    variable_name = varname
                    varunit = None
                    varcode = the_indicator_code
                    if sourcedata['classif1_code']:
                        varcode += ' ' + sourcedata['classif1_code']
                    if sourcedata['classif2_code']:
                        varcode += ' ' + sourcedata['classif2_code']
                    if sourcedata['sex_code']:
                        varcode += ' ' + sourcedata['sex_code']

                    varcode_for_reference = varcode

                    # source_description['additionalInfo'] = '\n'.join(list(sourcedata['note_indicator'])) + '\n'.join(list(sourcedata['note_source']))

                    if not source_description['additionalInfo']:
                        source_description['additionalInfo'] = None

                    newsource = Source(name='%s %s: %s' % ('ILOSTAT', sourcedata['category'], variable_name),
                                       description=json.dumps(source_description),
                                       datasetId=Dataset.objects.get(name=file_name_to_category[row['indicator']], namespace='ilostat').pk)

                    newsource.save()

                    if '(' in the_indicator_label and ')' in the_indicator_label:
                        varunit = the_indicator_label[the_indicator_label.index('('):-1].replace('(', '').replace(')','')
                    newvariable = Variable(name=variable_name,
                                           unit=varunit if
                                           varunit else '', short_unit=short_unit_extract(varunit),
                                           description='See concepts and methods provided by ILOSTAT at http://www.ilo.org/ilostat/faces/ilostat-home/metadata',
                                           code=varcode_for_reference,
                                           timespan='',
                                           datasetId=Dataset.objects.get(name=file_name_to_category[row['indicator']], namespace='ilostat'), variableTypeId=VariableType.objects.get(pk=4),
                                           sourceId=newsource)

                    varcode_to_object[varcode_for_reference] = newvariable
                    newvariable.save()

                variables = None

                insert_string = 'INSERT into data_values (value, year, entityId, variableId) VALUES (%s, %s, %s, %s)'  # this is used for constructing the query for mass inserting to the data_values table
                data_values_tuple_list = []
                with open(file.replace('.gz', ''), 'r', encoding='utf8') as f:
                    reader = csv.DictReader(f)
                    for row in reader:  # actually importing the values
                        row_number += 1
                        if '_NOC_' in one_file:
                            var_code = row['indicator']
                        else:
                            var_code = row['indicator']
                            if 'classif1' in reader.fieldnames:
                                var_code += ' ' + row['classif1']
                            if 'classif2' in reader.fieldnames:
                                var_code += ' ' + row['classif2']
                            if 'sex' in reader.fieldnames:
                                var_code += ' ' + row['sex']
                        source_abbr = row['source']

                        if source_abbr == preffered_sources[var_code][row['ref_area']]:

                            varcode = row['indicator']
                            if 'classif1' in reader.fieldnames:
                                varcode += ' ' + row['classif1']
                            if 'classif2' in reader.fieldnames:
                                varcode += ' ' + row['classif2']
                            if 'sex' in reader.fieldnames:
                                varcode += ' ' + row['sex']
                            try:
                                the_tuple = (str(float(row['obs_value'])), int(row['time']),
                                                               country_code_entity_object_ref[row['ref_area']].pk, varcode_to_object[varcode].pk)
                                if row['ref_area'] != 'DE1' and row['ref_area'] != 'DE2' and row['ref_area'] != 'YU1':
                                    # these country names cause duplicate errors
                                    data_values_tuple_list.append(the_tuple)
                            except ValueError:
                                pass
                            if len(data_values_tuple_list) > 3000:  # insert when the length of the list goes over 3000
                                with connection.cursor() as c:
                                    c.executemany(insert_string, data_values_tuple_list)
                                data_values_tuple_list = []

                        if row_number % 100 == 0:
                            time.sleep(
                                0.001)  # this is done in order to not keep the CPU busy all the time, the delay after each 100th row is 1 millisecond

                if len(data_values_tuple_list):  # insert any leftover data_values
                    with connection.cursor() as c:
                        c.executemany(insert_string, data_values_tuple_list)
                    data_values_tuple_list = []
                print('################################################################################################')

            newimport = ImportHistory(import_type='ilostat',
                                      import_time=timezone.now().strftime('%Y-%m-%d %H:%M:%S'),
                                      import_notes='Importing file %s' % one_file,
                                      import_state=json.dumps(
                                          {'file_hash': file_checksum(file),
                                           'file_name': one_file
                                           }))
            newimport.save()

            os.remove(file.replace('.gz', ''))

        else:
            if imported_before_hash == file_checksum(file):
                print('No updates available for this file.')
            else:
                existing_categories = DatasetCategory.objects.values('name')
                existing_categories_list = {item['name'] for item in existing_categories}

                if ilostat_category_name_in_db not in existing_categories_list:
                    the_category = DatasetCategory(name=ilostat_category_name_in_db, fetcher_autocreated=True)
                    the_category.save()

                else:
                    the_category = DatasetCategory.objects.get(name=ilostat_category_name_in_db)

                existing_subcategories = DatasetSubcategory.objects.filter(categoryId=the_category.pk).values(
                    'name')
                existing_subcategories_list = {item['name'].lower() for item in existing_subcategories}

                datasetname_to_object = {}

                variables = {}

                with gzip.open(file, 'rb') as f_in, open(file.replace('.gz', ''), 'wb') as f_out:
                    shutil.copyfileobj(f_in, f_out)
                with open(file.replace('.gz', ''), 'r', encoding='utf8') as f:
                    reader = csv.DictReader(f)
                    print('Processing %s' % one_file)
                    for row in reader:
                        row_number += 1
                        if '_NOC_' in one_file:
                            var_code = row['indicator']
                        else:
                            var_code = row['indicator']
                            if 'classif1' in reader.fieldnames:
                                var_code += ' ' + row['classif1']
                            if 'classif2' in reader.fieldnames:
                                var_code += ' ' + row['classif2']
                            if 'sex' in reader.fieldnames:
                                var_code += ' ' + row['sex']
                        source_abbr = row['source']

                        if source_abbr == preffered_sources[var_code][row['ref_area']]:

                            the_subcategory_name = file_name_to_category[row['indicator']]

                            if the_subcategory_name not in datasetname_to_object:

                                if the_subcategory_name.lower() not in existing_subcategories_list:
                                    the_subcategory = DatasetSubcategory(name=the_subcategory_name,
                                                                         categoryId=the_category)
                                    the_subcategory.save()
                                    newdataset = Dataset(name=the_subcategory_name,
                                                         description='This is a dataset imported by the automated fetcher',
                                                         namespace='ilostat', categoryId=the_category,
                                                         subcategoryId=the_subcategory)
                                    newdataset.save()
                                    new_datasets_list.append(newdataset)
                                    datasetname_to_object[the_subcategory_name] = newdataset
                                else:
                                    the_subcategory = DatasetSubcategory.objects.get(name=the_subcategory_name,
                                                                                     categoryId=the_category)
                                    newdataset = Dataset.objects.get(name=the_subcategory_name,
                                                                     namespace='ilostat')
                                    datasetname_to_object[the_subcategory_name] = newdataset
                                    if newdataset not in old_datasets_list:
                                        old_datasets_list.append(newdataset)

                            the_indicator_label = None
                            the_indicator_code = None

                            the_indicator_label = metadata['indicator'][row['indicator']]['indicator.label']
                            the_indicator_code = row['indicator']
                            variable_name = the_indicator_label
                            if 'classif1' in reader.fieldnames:
                                if row['classif1'] != 'NOC_VALUE':
                                    if row['classif1'] == 'ECO_EQISIC4ISIC3_10_151-154':
                                        variable_name += ' - ' + 'ISIC-Rev.3: Production, processing and preservation of meat, fish, fruit, vegetables, oils and fats'
                                    elif row['classif1'] == 'OCU_EQISCO08ISCO88_71_712-714':
                                        variable_name += ' - ' + 'ISCO-88: Building frame and related trades workers'
                                    elif row['classif1'] == 'ECO_ISIC4_T':
                                        variable_name += ' - ' + 'ISIC-Rev.4: Activities of households as employers'
                                    elif row['classif1'] == 'ECO_ISIC3_P':
                                        variable_name += ' - ' + 'ISIC-Rev.3: Activities of private households as employers'
                                    elif row['classif1'] == 'ECO_ISIC3_G':
                                        variable_name += ' - ' + 'ISIC-Rev.3: Wholesale and retail trade'
                                    else:
                                        variable_name += ' - ' + metadata['classif1'][row['classif1']]['classif1.label']
                            if 'classif2' in reader.fieldnames:
                                if row['classif2'] == 'ECO_ISIC3_G':
                                    variable_name += ' - ' + 'ISIC-Rev.3: Wholesale and retail trade'
                                elif row['classif2'] == 'ECO_ISIC3_P':
                                    variable_name += ' - ' + 'ISIC-Rev.3: Activities of private households as employers'
                                elif row['classif2'] == 'ECO_ISIC4_T':
                                    variable_name += ' - ' + 'ISIC-Rev.4: Activities of households as employers'
                                elif row['classif2'] == 'OCU_EQISCO08ISCO88_71_712-714':
                                    variable_name += ' - ' + 'ISCO-88: Building frame and related trades workers'
                                elif row['classif2'] == 'ECO_EQISIC4ISIC3_10_151-154':
                                    variable_name += ' - ' + 'ISIC-Rev.3: Production, processing and preservation of meat, fish, fruit, vegetables, oils and fats'
                                else:
                                    variable_name += ' - ' + metadata['classif2'][row['classif2']]['classif2.label']
                            if 'sex' in reader.fieldnames:
                                variable_name += ' - ' + metadata['sex'][row['sex']]['sex.label']
                            if variable_name not in variables:
                                variables[variable_name] = {
                                    'category': file_name_to_category[row['indicator']],
                                    'note_source': set(),
                                    'note_indicator': set(),
                                    'source': set(),
                                    'classif1_code': row['classif1'] if 'classif1' in reader.fieldnames else None,
                                    'classif2_code': row['classif2'] if 'classif2' in reader.fieldnames else None,
                                    'sex_code': row['sex'] if 'sex' in reader.fieldnames else None
                                }
                            variables[variable_name]['source'].add(
                                ' - '.join(metadata['source'][row['source']]['source.label'].split(' - ')[2:]))
                            if 'note_source' in reader.fieldnames and row['note_source']:
                                note_sources_list = row['note_source'].split('_')
                                for eachnotesource in note_sources_list:
                                    variables[variable_name]['note_source'].add(
                                        metadata['note_source'][eachnotesource]['note_source.label'])
                            if 'note_indicator' in reader.fieldnames and row['note_indicator']:
                                note_indicators_list = row['note_indicator'].split('_')
                                for eachnoteindicator in note_indicators_list:
                                    variables[variable_name]['note_indicator'].add(
                                        metadata['note_indicator'][eachnoteindicator]['note_indicator.label'])

                        if row_number % 100 == 0:
                            time.sleep(
                                0.001)  # this is done in order to not keep the CPU busy all the time, the delay after each 100th row is 1 millisecond

                    varcode_to_object = {}
                    existing_sources = Source.objects.filter(datasetId__in=Dataset.objects.filter(namespace='ilostat'))
                    existing_sources_list = [ onesource.name for onesource in existing_sources ]
                    existing_vars = Variable.objects.filter(datasetId__namespace='ilostat')
                    existing_vars_list = [onevar.code for onevar in existing_vars]
                    for varname, sourcedata in variables.items():

                        variable_name = varname
                        varunit = None
                        varcode = the_indicator_code
                        if sourcedata['classif1_code']:
                            varcode += ' ' + sourcedata['classif1_code']
                        if sourcedata['classif2_code']:
                            varcode += ' ' + sourcedata['classif2_code']
                        if sourcedata['sex_code']:
                            varcode += ' ' + sourcedata['sex_code']

                        varcode_for_reference = varcode

                        # source_description['additionalInfo'] = '\n'.join(
                        #    list(sourcedata['note_indicator'])) + '\n'.join(list(sourcedata['note_source']))

                        if not source_description['additionalInfo']:
                            source_description['additionalInfo'] = None

                        if '%s %s: %s' % ('ILOSTAT', sourcedata['category'], variable_name) not in existing_sources_list:
                            newsource = Source(name='%s %s: %s' % ('ILOSTAT', sourcedata['category'], variable_name),
                                           description=json.dumps(source_description),
                                           datasetId=Dataset.objects.get(name=file_name_to_category[row['indicator']],
                                                                         namespace='ilostat').pk)
                        else:
                            newsource = Source.objects.get(name='%s %s: %s' % ('ILOSTAT', sourcedata['category'], variable_name), datasetId__in=[onedataset.pk for onedataset in Dataset.objects.filter(namespace='ilostat')])
                            newsource.description = json.dumps(source_description)

                        newsource.save()

                        if '(' in the_indicator_label and ')' in the_indicator_label:
                            varunit = the_indicator_label[the_indicator_label.index('('):-1].replace('(', '').replace(
                                ')', '')

                        if varcode_for_reference not in existing_vars_list:

                            newvariable = Variable(name=variable_name,
                                               unit=varunit if
                                               varunit else '', short_unit=short_unit_extract(varunit),
                                               description='See concepts and methods provided by ILOSTAT at http://www.ilo.org/ilostat/faces/ilostat-home/metadata',
                                               code=varcode_for_reference,
                                               timespan='',
                                               datasetId=Dataset.objects.get(
                                                   name=file_name_to_category[row['indicator']], namespace='ilostat'),
                                               variableTypeId=VariableType.objects.get(pk=4),
                                               sourceId=newsource)
                        else:
                            newvariable = Variable.objects.get(code=varcode_for_reference, datasetId__namespace__exact='ilostat')
                            newvariable.description = 'See concepts and methods provided by ILOSTAT at http://www.ilo.org/ilostat/faces/ilostat-home/metadata'
                            newvariable.name = variable_name
                            newvariable.unit = varunit if varunit else ''
                            newvariable.short_unit = short_unit_extract(varunit)
                            newvariable.sourceId = newsource

                            while DataValue.objects.filter(variableId__pk=newvariable.pk).first():
                                with connection.cursor() as c:  # if we don't limit the deleted values, the db might just hang
                                    c.execute('DELETE FROM %s WHERE variableId = %s LIMIT 10000;' %
                                              (DataValue._meta.db_table, newvariable.pk))

                        varcode_to_object[varcode_for_reference] = newvariable
                        newvariable.save()

                    variables = None

                    insert_string = 'INSERT into data_values (value, year, entityId, variableId) VALUES (%s, %s, %s, %s)'  # this is used for constructing the query for mass inserting to the data_values table
                    data_values_tuple_list = []
                    with open(file.replace('.gz', ''), 'r', encoding='utf8') as f:
                        reader = csv.DictReader(f)
                        for row in reader:
                            row_number += 1
                            if '_NOC_' in one_file:
                                var_code = row['indicator']
                            else:
                                var_code = row['indicator']
                                if 'classif1' in reader.fieldnames:
                                    var_code += ' ' + row['classif1']
                                if 'classif2' in reader.fieldnames:
                                    var_code += ' ' + row['classif2']
                                if 'sex' in reader.fieldnames:
                                    var_code += ' ' + row['sex']
                            source_abbr = row['source']

                            if source_abbr == preffered_sources[var_code][row['ref_area']]:

                                varcode = row['indicator']
                                if 'classif1' in reader.fieldnames:
                                    varcode += ' ' + row['classif1']
                                if 'classif2' in reader.fieldnames:
                                    varcode += ' ' + row['classif2']
                                if 'sex' in reader.fieldnames:
                                    varcode += ' ' + row['sex']
                                try:
                                    the_tuple = (str(float(row['obs_value'])), int(row['time']),
                                                 country_code_entity_object_ref[row['ref_area']].pk,
                                                 varcode_to_object[varcode].pk)
                                    if row['ref_area'] != 'DE1' and row['ref_area'] != 'DE2' and row[
                                        'ref_area'] != 'YU1':
                                        data_values_tuple_list.append(the_tuple)
                                except ValueError:
                                    pass
                                if len(
                                    data_values_tuple_list) > 3000:  # insert when the length of the list goes over 3000
                                    with connection.cursor() as c:
                                        c.executemany(insert_string, data_values_tuple_list)
                                    data_values_tuple_list = []

                            if row_number % 100 == 0:
                                time.sleep(
                                    0.001)  # this is done in order to not keep the CPU busy all the time, the delay after each 100th row is 1 millisecond

                    if len(data_values_tuple_list):  # insert any leftover data_values
                        with connection.cursor() as c:
                            c.executemany(insert_string, data_values_tuple_list)
                        data_values_tuple_list = []
                    print(
                        '################################################################################################')

                newimport = ImportHistory(import_type='ilostat',
                                          import_time=timezone.now().strftime('%Y-%m-%d %H:%M:%S'),
                                          import_notes='Importing file %s' % one_file,
                                          import_state=json.dumps(
                                              {'file_hash': file_checksum(file),
                                               'file_name': one_file
                                               }))
                newimport.save()

                os.remove(file.replace('.gz', ''))

    for onedataset in new_datasets_list:
        write_dataset_csv(onedataset.pk, onedataset.name, None, 'ilostat_fetcher', '')
    for onedataset in old_datasets_list:
        write_dataset_csv(onedataset.pk, onedataset.name, onedataset.name, 'ilostat_fetcher', '')
