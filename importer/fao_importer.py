import sys
import os
import csv
import hashlib
from datetime import datetime
import json
import glob
import unidecode
import time
import zipfile
sys.path.insert(1, os.path.join(sys.path[0], '..'))
import owid_grapher.wsgi
import django.db
from grapher_admin.models import Entity, DatasetSubcategory, DatasetCategory, Dataset, Source, Variable, VariableType, DataValue, ChartDimension
from importer.models import ImportHistory
from country_name_tool.models import CountryName
from django.conf import settings
from django.db import connection, transaction
from django.utils import timezone
from grapher_admin.views import write_dataset_csv

start_time = datetime.now()
# IMPORTANT: FAOSTAT's large bulk dataset download is a collection of 70+ zip files
# Each zip file contains only one csv file
# The link to the bulk download: http://fenixservices.fao.org/faostat/static/bulkdownloads/FAOSTAT.zip
# These csv files contain different structure variants
# Some of the zip files may have been compressed using a compression format not available in python
# Unzip those files, and put their csv files into the same directory where all zip files are located
# Here is what you need to to before running this script:
# Put all .zip and .csv files you want to parse in one directory
# make sure you have metadata csv files for each of your .zip or .csv file
# metadata files must be in a separate directory, and must have the same name as the .zip or .csv dataset file
# Metadata is not included in the bulk download, and can be downloaded from http://www.fao.org/faostat/en/?#data/
# Put each dataset file's name into an appropriate category in the category_files dict
# Fill in the files_to_exclude list with files you don't want to parse
# Please note that the datasets which don't have their corresponding .csv metadata files will have some of the "Sources" fields empty
# Check the column_types list and the logic for dealing with different column types in the process_csv_file function
# Fill in the file_dataset_names dict with names of datasets for each file
# The script will perform the necessary checks and will inform the user if anything is missing

fao_category_name_in_db = 'FAOSTAT'  # set the name of the root category of all data that will be imported by this script

source_template = '<table>' \
                    '<tr>' \
                        '<td>Dataset name</td>' \
                        '<td>%s</td>' \
                    '</tr>' \
                    '<tr>' \
                        '<td>Data published by</td>' \
                        '<td>%s</td>' \
                    '</tr>' \
                    '<tr>' \
                        '<td>Data publisher\'s source</td>' \
                        '<td>%s</td>' \
                    '</tr>' \
                    '<tr>' \
                        '<td>Link</td>' \
                        '<td><a target="_blank" href="http://www.fao.org/faostat/en/?#data/">' \
                  'http://www.fao.org/faostat/en/?#data/</a></td>' \
                    '</tr>' \
                    '<tr>' \
                        '<td>Retrieved</td>' \
                        '<td>' + timezone.now().strftime("%d-%B-%y") +'</td>' \
                    '</tr>' \
                  '</table>' \
                  '<div class="datasource-additional">' \
                    '<p>' \
                    '<b><i style="text-decoration: underline;">Additional information as provided by the source</i></b><br>' \
                    '%s' \
                    '</p>' \
                  '</div>'


category_files = {
    "Production": [
        "Production_Crops_E_All_Data_(Normalized).zip",
        "Production_CropsProcessed_E_All_Data_(Normalized).zip",
        "Production_Livestock_E_All_Data_(Normalized).zip",
        "Production_LivestockPrimary_E_All_Data_(Normalized).zip",
        "Production_LivestockProcessed_E_All_Data_(Normalized).zip",
        "Production_Indices_E_All_Data_(Normalized).zip",
        "Value_of_Production_E_All_Data_(Normalized).zip"
    ],
    "Trade": [
        "Trade_Crops_Livestock_E_All_Data_(Normalized).zip",
        "Trade_LiveAnimals_E_All_Data_(Normalized).zip",
        "Trade_DetailedTradeMatrix_E_All_Data_(Norm).zip",  # this file cannot be extracted using python's zipfile module
        "Trade_DetailedTradeMatrix_E_All_Data_(Norm).csv",
        "Trade_Indices_E_All_Data_(Norm).zip"
    ],
    "Food Balance": [
        "FoodBalanceSheets_E_All_Data_(Normalized).zip",  # this file cannot be extracted using python's zipfile module
        "FoodBalanceSheets_E_All_Data_(Normalized).csv",
        "CommodityBalances_Crops_E_All_Data_(Normalized).zip",
        "CommodityBalances_LivestockFish_E_All_Data_(Normalized).zip",
        "FoodSupply_Crops_E_All_Data_(Normalized).zip",
        "FoodSupply_LivestockFish_E_All_Data_(Normalized).zip"
    ],
    "Food Security": [
        "Indicators_from_Household_Surveys_E_All_Data_(Normalized).zip",
        "Food_Security_Data_E_All_Data_(Norm).zip"
    ],
    "Prices": [
        "Prices_E_All_Data_(Normalized).zip",
        "Prices_Monthly_E_All_Data_(Normalized).zip",
        "Price_Indices_E_All_Data_(Normalized).zip",
        "PricesArchive_E_All_Data_(Norm).zip",
        "ConsumerPriceIndices_E_All_Data_(Normalized).zip",
        "Deflators_E_All_Data_(Normalized).zip",
        "Exchange_rate_E_All_Data_(Normalized).zip"
    ],
    "Inputs": [
        "Inputs_Fertilizers_E_All_Data_(Normalized).zip",
        "Inputs_FertilizersArchive_E_All_Data_(Norm).zip",
        "Inputs_FertilizersTradeValues_E_All_Data_(Norm).zip",
        "Inputs_Pesticides_Use_E_All_Data_(Normalized).zip",
        "Inputs_Pesticides_Trade_E_All_Data_(Norm).zip",
        "Inputs_Land_E_All_Data_(Normalized).zip",
        "Employment_Indicators_E_All_Data_(Norm).zip"
    ],
    "Population": [
        "Population_E_All_Data_(Norm).zip"
    ],
    "Investment": [
        "Investment_Machinery_E_All_Data_(Norm).zip",
        "Investment_MachineryArchive_E_All_Data_(Norm).zip",
        "Investment_GovernmentExpenditure_E_All_Data_(Normalized).zip",
        "Investment_CreditAgriculture_E_All_Data_(Normalized).zip",
        "Development_Assistance_to_Agriculture_E_All_Data_(Normalized).zip",
        "Investment_ForeignDirectInvestment_E_All_Data_(Norm).zip",
        "Investment_CountryInvestmentStatisticsProfile__E_All_Data_(Normalized).zip"
    ],
    "Macro-Statistics": [
        "Investment_CapitalStock_E_All_Data_(Normalized).zip",
        "Macro-Statistics_Key_Indicators_E_All_Data_(Normalized).zip"
    ],
    "Agri-Environmental Indicators": [
        "Environment_AirClimateChange_E_All_Data_(Norm).zip",
        "Environment_Energy_E_All_Data_(Norm).zip",
        "Environment_Fertilizers_E_All_Data_(Normalized).zip",
        "Environment_LandUse_E_All_Data_(Normalized).zip",
        "Environment_LandCover_E_All_Data_(Normalized).zip",
        "Environment_LivestockPatterns_E_All_Data_(Normalized).zip",
        "Environment_Pesticides_E_All_Data_(Normalized).zip",
        "Environment_Soil_E_All_Data_(Norm).zip",
        "Environment_Water_E_All_Data_(Norm).zip",
        "Environment_Emissions_by_Sector_E_All_Data_(Normalized).zip",
        "Environment_Emissions_intensities_E_All_Data_(Normalized).zip",
        "Environment_Livestock_E_All_Data_(Norm).zip"
    ],
    "Emissions - Agriculture": [
        "Emissions_Agriculture_Agriculture_total_E_All_Data_(Norm).zip",
        "Emissions_Agriculture_Enteric_Fermentation_E_All_Data_(Norm).zip",
        "Emissions_Agriculture_Manure_Management_E_All_Data_(Norm).zip",
        "Emissions_Agriculture_Rice_Cultivation_E_All_Data_(Norm).zip",
        "Emissions_Agriculture_Synthetic_Fertilizers_E_All_Data_(Norm).zip",
        "Emissions_Agriculture_Manure_applied_to_soils_E_All_Data_(Norm).zip",
        "Emissions_Agriculture_Manure_left_on_pasture_E_All_Data_(Norm).zip",
        "Emissions_Agriculture_Crop_Residues_E_All_Data_(Norm).zip",
        "Emissions_Agriculture_Cultivated_Organic_Soils_E_All_Data_(Norm).zip",
        "Emissions_Agriculture_Burning_Savanna_E_All_Data_(Norm).zip",
        "Emissions_Agriculture_Burning_crop_residues_E_All_Data_(Norm).zip",
        "Emissions_Agriculture_Energy_E_All_Data_(Norm).zip"
    ],
    "Emissions - Land Use": [
        "Emissions_Land_Use_Land_Use_Total_E_All_Data_(Norm).zip",
        "Emissions_Land_Use_Forest_Land_E_All_Data_(Norm).zip",
        "Emissions_Land_Use_Cropland_E_All_Data_(Norm).zip",
        "Emissions_Land_Use_Grassland_E_All_Data_(Norm).zip",
        "Emissions_Land_Use_Burning_Biomass_E_All_Data_(Norm).zip"
    ],
    "Forestry": [
        "Forestry_E_All_Data_(Normalized).zip",
        "Forestry_Trade_Flows_E_All_Data_(Normalized).zip"
    ],
    "ASTI R&D Indicators": [
        "ASTI_Research_Spending_E_All_Data_(Norm).zip",
        "ASTI_Researchers_E_All_Data_(Normalized).zip"
    ],
    "Emergency Response": [
        "Food_Aid_Shipments_WFP_E_All_Data_(Normalized).zip"
    ]
    }


file_dataset_names = {
    "ASTI_Research_Spending_E_All_Data_(Norm).zip": "ASTI-Expenditures",
    "ASTI_Researchers_E_All_Data_(Normalized).zip": "ASTI-Researchers",
    "CommodityBalances_Crops_E_All_Data_(Normalized).zip": "Commodity Balances - Crops Primary Equivalent",
    "CommodityBalances_LivestockFish_E_All_Data_(Normalized).zip": "Commodity Balances - Livestock and Fish Primary Equivalent",
    "ConsumerPriceIndices_E_All_Data_(Normalized).zip": "Consumer Price Indices",
    "Deflators_E_All_Data_(Normalized).zip": "Deflators",
    "Development_Assistance_to_Agriculture_E_All_Data_(Normalized).zip": "Development Flows to Agriculture",
    "Emissions_Agriculture_Agriculture_total_E_All_Data_(Norm).zip": "Agriculture Total",
    "Emissions_Agriculture_Burning_crop_residues_E_All_Data_(Norm).zip": "Burning - Crop Residues",
    "Emissions_Agriculture_Burning_Savanna_E_All_Data_(Norm).zip": "Burning - Savanna",
    "Emissions_Agriculture_Crop_Residues_E_All_Data_(Norm).zip": "Crop Residues",
    "Emissions_Agriculture_Cultivated_Organic_Soils_E_All_Data_(Norm).zip": "Cultivation of Organic Soils",
    "Emissions_Agriculture_Energy_E_All_Data_(Norm).zip": "Energy Use",
    "Emissions_Agriculture_Enteric_Fermentation_E_All_Data_(Norm).zip": "Enteric Fermentation",
    "Emissions_Agriculture_Manure_applied_to_soils_E_All_Data_(Norm).zip": "Manure applied to Soils",
    "Emissions_Agriculture_Manure_left_on_pasture_E_All_Data_(Norm).zip": "Manure left on Pasture",
    "Emissions_Agriculture_Manure_Management_E_All_Data_(Norm).zip": "Manure Management",
    "Emissions_Agriculture_Rice_Cultivation_E_All_Data_(Norm).zip": "Rice Cultivation",
    "Emissions_Agriculture_Synthetic_Fertilizers_E_All_Data_(Norm).zip": "Synthetic Fertilizers",
    "Emissions_Land_Use_Burning_Biomass_E_All_Data_(Norm).zip": "Burning - Biomass",
    "Emissions_Land_Use_Cropland_E_All_Data_(Norm).zip": "Cropland",
    "Emissions_Land_Use_Forest_Land_E_All_Data_(Norm).zip": "Forest Land",
    "Emissions_Land_Use_Grassland_E_All_Data_(Norm).zip": "Grassland",
    "Emissions_Land_Use_Land_Use_Total_E_All_Data_(Norm).zip": "Land Use Total",
    "Employment_Indicators_E_All_Data_(Norm).zip": "Employment Indicators",
    "Environment_AirClimateChange_E_All_Data_(Norm).zip": "Air and climate change",
    "Environment_Emissions_by_Sector_E_All_Data_(Normalized).zip": "Emissions by sector",
    "Environment_Emissions_intensities_E_All_Data_(Normalized).zip": "Emissions intensities",
    "Environment_Energy_E_All_Data_(Norm).zip": "Energy",
    "Environment_Fertilizers_E_All_Data_(Normalized).zip": "Fertilizers",
    "Environment_LandCover_E_All_Data_(Normalized).zip": "Land Cover",
    "Environment_LandUse_E_All_Data_(Normalized).zip": "Land Use",
    "Environment_Livestock_E_All_Data_(Norm).zip": "Livestock",
    "Environment_LivestockPatterns_E_All_Data_(Normalized).zip": "Livestock Patterns",
    "Environment_Pesticides_E_All_Data_(Normalized).zip": "Pesticides",
    "Environment_Soil_E_All_Data_(Norm).zip": "Soil",
    "Environment_Water_E_All_Data_(Norm).zip": "Water",
    "Exchange_rate_E_All_Data_(Normalized).zip": "Exchange rates - Annual",
    "Food_Aid_Shipments_WFP_E_All_Data_(Normalized).zip": "Food Aid Shipments (WFP)",
    "Food_Security_Data_E_All_Data_(Norm).zip": "Suite of Food Security Indicators",
    "FoodBalanceSheets_E_All_Data_(Normalized).zip": "Food Balance Sheets",
    "FoodSupply_Crops_E_All_Data_(Normalized).zip": "Food Supply - Crops Primary Equivalent",
    "FoodSupply_LivestockFish_E_All_Data_(Normalized).zip": "Food Supply - Livestock and Fish Primary Equivalent",
    "Forestry_E_All_Data_(Normalized).zip": "Forestry Production and Trade",
    "Forestry_Trade_Flows_E_All_Data_(Normalized).zip": "Forestry Trade Flows",
    "Indicators_from_Household_Surveys_E_All_Data_(Normalized).zip": "Indicators from Household Surveys (gender, area, socioeconomics)",
    "Inputs_Fertilizers_E_All_Data_(Normalized).zip": "Fertilizers",
    "Inputs_FertilizersArchive_E_All_Data_(Norm).zip": "Fertilizers archive",
    "Inputs_FertilizersTradeValues_E_All_Data_(Norm).zip": "Fertilizers - Trade Value",
    "Inputs_Land_E_All_Data_(Normalized).zip": "Land Use",
    "Inputs_Pesticides_Trade_E_All_Data_(Norm).zip": "Pesticides Trade",
    "Inputs_Pesticides_Use_E_All_Data_(Normalized).zip": "Pesticides Use",
    "Investment_CapitalStock_E_All_Data_(Normalized).zip": "Capital Stock",
    "Investment_CountryInvestmentStatisticsProfile__E_All_Data_(Normalized).zip": "Country Investment Statistics Profile",
    "Investment_CreditAgriculture_E_All_Data_(Normalized).zip": "Credit to Agriculture",
    "Investment_ForeignDirectInvestment_E_All_Data_(Norm).zip": "Foreign Direct Investment (FDI)",
    "Investment_GovernmentExpenditure_E_All_Data_(Normalized).zip": "Government Expenditure",
    "Investment_Machinery_E_All_Data_(Norm).zip": "Machinery",
    "Investment_MachineryArchive_E_All_Data_(Norm).zip": "Machinery Archive",
    "Macro-Statistics_Key_Indicators_E_All_Data_(Normalized).zip": "Macro Indicators",
    "Population_E_All_Data_(Norm).zip": "Annual population",
    "Price_Indices_E_All_Data_(Normalized).zip": "Producer Price Indices - Annual",
    "Prices_E_All_Data_(Normalized).zip": "Producer Prices - Annual",
    "Prices_Monthly_E_All_Data_(Normalized).zip": "Producer Prices - Monthly",
    "PricesArchive_E_All_Data_(Norm).zip": "Producer Prices - Archive",
    "Production_Crops_E_All_Data_(Normalized).zip": "Crops",
    "Production_CropsProcessed_E_All_Data_(Normalized).zip": "Crops processed",
    "Production_Indices_E_All_Data_(Normalized).zip": "Production Indices",
    "Production_Livestock_E_All_Data_(Normalized).zip": "Live Animals",
    "Production_LivestockPrimary_E_All_Data_(Normalized).zip": "Livestock Primary",
    "Production_LivestockProcessed_E_All_Data_(Normalized).zip": "Livestock Processed",
    "Trade_Crops_Livestock_E_All_Data_(Normalized).zip": "Crops and livestock products",
    "Trade_DetailedTradeMatrix_E_All_Data_(Norm).zip": "Detailed trade matrix",
    "Trade_Indices_E_All_Data_(Norm).zip": "Trade Indices",
    "Trade_LiveAnimals_E_All_Data_(Normalized).zip": "Live animals",
    "Value_of_Production_E_All_Data_(Normalized).zip": "Value of Agricultural Production",
    "FoodBalanceSheets_E_All_Data_(Normalized).csv": "Food Balance Sheets",
    "Trade_DetailedTradeMatrix_E_All_Data_(Norm).csv": "Detailed trade matrix"
}

# the different column name variants found in the FAO dataset files
column_types = [
    # 11 columns
    tuple(["Area Code", "Area", "Item Code", "Item", "ISO Currency Code", "Currency", "Year Code", "Year", "Unit", "Value", "Flag"]),
    tuple(["CountryCode", "Country", "ItemCode", "Item", "ElementGroup", "ElementCode", "Element", "Year", "Unit", "Value", "Flag"]),
    tuple(["Area Code", "Area", "Item Code", "Item", "Element Code", "Element", "Year Code", "Year", "Unit", "Value", "Flag"]),
    tuple(["Country Code", "Country", "Item Code", "Item", "Element Code", "Element", "Year Code", "Year", "Unit", "Value", "Flag"]),
    tuple(["Country Code", "Country", "Source Code", "Source", "Indicator Code", "Indicator", "Year Code", "Year", "Unit", "Value", "Flag"]),
    tuple(["Recipient Country Code", "Recipient Country", "Item Code", "Item", "Donor Country Code", "Donor Country", "Year Code", "Year", "Unit", "Value", "Flag"]),
    # 13 columns
    tuple(["Reporter Country Code", "Reporter Countries", "Partner Country Code", "Partner Countries", "Item Code", "Item", "Element Code", "Element", "Year Code", "Year", "Unit", "Value", "Flag"]),
    # 15 columns
    tuple(["Donor Code", "Donor", "Recipient Country Code", "Recipient Country", "Item Code", "Item", "Element Code", "Element", "Purpose Code", "Purpose", "Year Code", "Year", "Unit", "Value", "Flag"])
]

files_to_exclude = ["CommodityBalances_Crops_E_All_Data_(Normalized).zip", "CommodityBalances_LivestockFish_E_All_Data_(Normalized).zip",
                    "FoodSupply_Crops_E_All_Data_(Normalized).zip", "FoodSupply_LivestockFish_E_All_Data_(Normalized).zip",
                    "Indicators_from_Household_Surveys_E_All_Data_(Normalized).zip", "Population_E_All_Data_(Norm).zip",
                    "Prices_Monthly_E_All_Data_(Normalized).zip", "PricesArchive_E_All_Data_(Norm).zip",
                    "ConsumerPriceIndices_E_All_Data_(Normalized).zip"]

all_dataset_files_dir = os.path.join(settings.BASE_DIR, 'data/fao/FAOSTAT')
metadata_dir = os.path.join(settings.BASE_DIR, 'data/fao/fao_metadata')


all_files_cat = []  # will contain all the files that are assigned to a category in the category_files variable
file_to_category_dict = {}  # will hold the corresponding category of a file
for category, files in category_files.items():
    for each in files:
        all_files_cat.append(each)
        file_to_category_dict[each] = category

all_files_meta = []  # will contain all the .csv metadata files in the folder given by metadata_dir variable
for file in glob.glob(metadata_dir + "/*.csv"):
    all_files_meta.append(os.path.splitext(os.path.basename(file))[0] + ".zip")
    # dataset files that can't be extracted by python will be put in csv format in the folder with other .zip files
    all_files_meta.append(os.path.splitext(os.path.basename(file))[0] + ".csv")


# Will now perform the checks for files, dataset categories and file structures
parsing_notes = []

for file in glob.glob(all_dataset_files_dir + "/*.zip"):
    one_file = os.path.basename(file)
    if one_file not in all_files_cat and one_file not in files_to_exclude:
        parsing_notes.append("The file %s is not found in the category_files dict." % one_file)
    if one_file not in all_files_meta and one_file not in files_to_exclude:
        parsing_notes.append("The metadata file for %s was not found." % one_file)
    if one_file in files_to_exclude:
        parsing_notes.append("File %s will be excluded from parsing." % one_file)
    if one_file not in files_to_exclude:
        file_extracted = 1
        zip_ref = zipfile.ZipFile(file, 'r')
        csv_filename = zip_ref.namelist()[0]
        try:
            zip_ref.extractall("/tmp")
        except:
            file_extracted = 0
        zip_ref.close()

        if file_extracted:
            with open(os.path.join("/tmp", csv_filename), encoding='latin-1') as csvfile:
                reader = csv.DictReader(csvfile)
                columns = tuple(reader.fieldnames)
                if columns not in column_types:
                    parsing_notes.append("The file %s contains columns that are not defined in the column_types list." % one_file)
            os.remove("/tmp/%s" % csv_filename)
    if one_file not in files_to_exclude:
        if one_file not in file_dataset_names:
            parsing_notes.append(
                "The file %s does not have a dataset name defined in file_dataset_names dict." % one_file)


for file in glob.glob(all_dataset_files_dir + "/*.csv"):
    one_file = os.path.basename(file)
    if one_file not in all_files_cat and one_file not in files_to_exclude:
        parsing_notes.append("The file %s is not found in the category_files dict." % one_file)
    if one_file not in all_files_meta and one_file not in files_to_exclude:
        parsing_notes.append("The metadata file for %s was not found." % one_file)
    if one_file in files_to_exclude:
        parsing_notes.append("File %s will be excluded from parsing." % one_file)
    if one_file not in files_to_exclude:
        with open(file, encoding='latin-1') as csvfile:
            reader = csv.DictReader(csvfile)
            columns = tuple(reader.fieldnames)
            if columns not in column_types:
                parsing_notes.append(
                    "The file %s contains columns that are not defined in the column_types list." % one_file)
    if one_file not in files_to_exclude:
        if one_file not in file_dataset_names:
            parsing_notes.append(
                "The file %s does not have a dataset name defined in file_dataset_names dict." % one_file)

if len(parsing_notes) > 0:
    for each in parsing_notes:
        print(each)
    user_answer = input("Do you want to proceed? (Enter Y or N)")
    while user_answer.lower() != "y" and user_answer.lower() != "n":
        user_answer = input("Do you want to proceed? (Enter Y or N)")
    if user_answer.lower() == "n":
        sys.exit()


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
        elif len(unit) < 9:  # this length is sort of arbitrary at this point, taken from the unit 'hectares'
            short_unit = unit
    return short_unit


def process_csv_file_insert(filename_to_process: str, original_filename: str):
    print('Processing: %s' % original_filename)

    global unique_data_tracker
    global datasets_list

    current_file_vars_countries = set()  # keeps track of variables+countries we saw in the current file
    current_file_var_codes = set()
    current_file_var_names = set()
    previous_row = tuple()

    # inserting a subcategory
    if file_to_category_dict[original_filename] not in existing_subcategories_list:
        the_subcategory = DatasetSubcategory(name=file_to_category_dict[original_filename], fk_dst_cat_id=the_category)
        the_subcategory.save()
        existing_subcategories_list.add(file_to_category_dict[original_filename])
    else:
        the_subcategory = DatasetSubcategory.objects.get(name=file_to_category_dict[original_filename])

    insert_string = 'INSERT into data_values (value, year, fk_ent_id, fk_var_id) VALUES (%s, %s, %s, %s)'  # this is used for constructing the query for mass inserting to the data_values table
    data_values_tuple_list = []

    # inserting a dataset
    newdataset = Dataset(name='%s: %s' % (file_to_category_dict[original_filename], file_dataset_names[original_filename]),
                         description='This is a dataset imported by the automated fetcher',
                         namespace='faostat', fk_dst_cat_id=the_category,
                         fk_dst_subcat_id=the_subcategory)
    newdataset.save()
    datasets_list.append(newdataset)

    # reading source information from a csv file in metadata_dir
    metadata_file_path = os.path.join(metadata_dir, os.path.splitext(original_filename)[0] + ".csv")
    data_published_by = 'Food and Agriculture Organization of the United Nations (FAO)'
    data_publishers_source = ''
    additional_information = ''
    variable_description = ''
    if os.path.isfile(metadata_file_path):
        with open(metadata_file_path, encoding='latin-1') as metadatacsv:
            metadatareader = csv.DictReader(metadatacsv)
            metadatacolumns = tuple(metadatareader.fieldnames)
            for row in metadatareader:
                if row['Subsection Code'] == '1.1':
                    data_published_by = row['Metadata']
                if row['Subsection Code'] == '3.1':
                    variable_description = row['Metadata']
                if row['Subsection Code'] == '3.4':
                    additional_information = row['Metadata']
                if row['Subsection Code'] == '20.1':
                    data_publishers_source = row['Metadata']

    # inserting a dataset source
    newsource = Source(name=file_dataset_names[original_filename],
                       description=source_template %
                                   (file_dataset_names[original_filename],
                                    data_published_by,
                                    data_publishers_source,
                                    additional_information
                                    ),
                       datasetId=newdataset.pk)
    newsource.save()

    existing_fao_variables = Variable.objects.filter(fk_dst_id__in=Dataset.objects.filter(namespace='faostat'))
    existing_fao_variables_dict = {}
    for each in existing_fao_variables:
        existing_fao_variables_dict[each.name] = each

    with open(filename_to_process, encoding='latin-1') as currentfile:
        currentreader = csv.DictReader(currentfile)
        filecolumns = tuple(currentreader.fieldnames)

        # these column types are very similar
        if filecolumns == column_types[0] or filecolumns == column_types[1] \
           or filecolumns == column_types[2] or filecolumns == column_types[3] \
           or filecolumns == column_types[4]:

            for row in currentreader:
                if filecolumns == column_types[0]:
                    countryname = row['Area']
                    variablename = row['Item']
                    variablecode = row['Item Code']
                if filecolumns == column_types[1]:
                    countryname = row['Country']
                    variablename = '%s - %s' % (row['Item'], row['Element'])
                    variablecode = '%s - %s' % (row['ItemCode'], row['ElementCode'])
                if filecolumns == column_types[2]:
                    countryname = row['Area']
                    variablename = '%s - %s' % (row['Item'], row['Element'])
                    variablecode = '%s - %s' % (row['Item Code'], row['Element Code'])
                if filecolumns == column_types[3]:
                    countryname = row['Country']
                    variablename = '%s - %s' % (row['Item'], row['Element'])
                    variablecode = '%s - %s' % (row['Item Code'], row['Element Code'])
                if filecolumns == column_types[4]:
                    countryname = row['Country']
                    variablename = '%s - %s' % (row['Indicator'], row['Source'])
                    variablecode = '%s - %s' % (row['Indicator Code'], row['Source Code'])

                if original_filename == 'Emissions_Agriculture_Energy_E_All_Data_(Norm).zip':
                    variablename += ' - %s' % row['Unit']

                if original_filename == 'Production_LivestockPrimary_E_All_Data_(Normalized).zip':
                    variablename += ' - %s' % row['Unit']

                if original_filename == 'Trade_LiveAnimals_E_All_Data_(Normalized).zip':
                    variablename += ' - %s' % row['Unit']

                # avoiding duplicate rows
                if original_filename == 'Inputs_Pesticides_Use_E_All_Data_(Normalized).zip':
                    if row['Item Code'] not in current_file_var_codes and row['Item'] not in current_file_var_names:
                        current_file_var_codes.add(row['Item Code'])
                        current_file_var_names.add(row['Item'])
                    elif row['Item Code'] in current_file_var_codes and row['Item'] in current_file_var_names:
                        pass
                    else:
                        continue

                # avoiding duplicate rows
                if original_filename == 'FoodBalanceSheets_E_All_Data_(Normalized).csv':
                    if tuple(row) == previous_row:
                        previous_row = tuple(row)
                        continue
                    else:
                        previous_row = tuple(row)

                try:
                    year = int(row['Year'])
                    value = float(row['Value'])
                except ValueError:
                    year = False
                    value = False

                variablename = file_dataset_names[original_filename] + ': ' + variablename

                current_file_vars_countries.add(tuple([countryname, variablecode]))

                process_one_row(year, value, countryname, variablecode, variablename, existing_fao_variables_dict,
                                row['Unit'], newsource, newdataset, variable_description, data_values_tuple_list)

        if filecolumns == column_types[5] or filecolumns == column_types[6] or filecolumns == column_types[7]:
            unique_vars = []
            # first we collect all variable names
            for row in currentreader:
                if filecolumns == column_types[5]:
                    variablename = '%s - Donors' % row['Item']
                if filecolumns == column_types[6]:
                    variablename = '%s - %s - Reporters' % (row['Item'], row['Element'])
                if filecolumns == column_types[7]:
                    variablename = '%s - %s - Donors' % (row['Item'], row['Purpose'])
                if variablename not in unique_vars:
                    unique_vars.append(variablename)
            # then we collect values for these variables
            processed_rows = set()
            for onevar in unique_vars:
                row_counter = 0
                unique_records_holder = {}
                currentfile.seek(0)  # going back to the top of the file
                for row in currentreader:
                    if row_counter in processed_rows:
                        row_counter += 1
                        continue
                    if row_counter % 300 == 0:
                        time.sleep(0.001)  # this is done in order to not keep the CPU busy all the time
                    if row['Year'] == 'Year':
                        continue
                    if filecolumns == column_types[5]:
                        variablename = '%s - Donors' % row['Item']
                    if filecolumns == column_types[6]:
                        variablename = '%s - %s - Reporters' % (row['Item'], row['Element'])
                    if filecolumns == column_types[7]:
                        variablename = '%s - %s - Donors' % (row['Item'], row['Purpose'])
                    if variablename == onevar:
                        processed_rows.add(row_counter)
                        if filecolumns == column_types[5]:
                            countryname = row['Donor Country']
                            variablecode = row['Item Code']
                            variableunit = row['Unit']
                        if filecolumns == column_types[6]:
                            countryname = row['Reporter Countries']
                            variablecode = '%s - %s' % (row['Item Code'], row['Element Code'])
                            variableunit = row['Unit']
                        if filecolumns == column_types[7]:
                            countryname = row['Donor']
                            variablecode = '%s - %s' % (row['Item Code'], row['Purpose Code'])
                            variableunit = row['Unit']

                        try:
                            year = int(row['Year'])
                            value = float(row['Value'])
                        except ValueError:
                            year = False
                            value = False
                        if year is not False and value is not False:
                            unique_record = tuple([countryname, int(row['Year'])])
                            if unique_record not in unique_records_holder:
                                unique_records_holder[unique_record] = float(row['Value'])
                            else:
                                unique_records_holder[unique_record] += float(row['Value'])

                    row_counter += 1

                for key, value in unique_records_holder.items():
                    variablename = file_dataset_names[original_filename] + ': ' + onevar
                    process_one_row(list(key)[1], str(value), list(key)[0], variablecode, variablename, existing_fao_variables_dict,
                                    variableunit, newsource, newdataset, variable_description, data_values_tuple_list)
            currentfile.seek(0)

            unique_vars = []
            for row in currentreader:
                if row['Year'] == 'Year':
                    continue
                if filecolumns == column_types[5]:
                    variablename = '%s - Recipients' % row['Item']
                if filecolumns == column_types[6]:
                    variablename = '%s - %s - Partners' % (row['Item'], row['Element'])
                if filecolumns == column_types[7]:
                    variablename = '%s - %s - Recipients' % (row['Item'], row['Purpose'])
                if variablename not in unique_vars:
                    unique_vars.append(variablename)
            processed_rows = set()
            for onevar in unique_vars:
                row_counter = 0
                unique_records_holder = {}
                currentfile.seek(0)
                for row in currentreader:
                    if row_counter in processed_rows:
                        row_counter += 1
                        continue
                    if row_counter % 300 == 0:
                        time.sleep(0.001)  # this is done in order to not keep the CPU busy all the time
                    if row['Year'] == 'Year':
                        continue
                    if filecolumns == column_types[5]:
                        variablename = '%s - Recipients' % row['Item']
                    if filecolumns == column_types[6]:
                        variablename = '%s - %s - Partners' % (row['Item'], row['Element'])
                    if filecolumns == column_types[7]:
                        variablename = '%s - %s - Recipients' % (row['Item'], row['Purpose'])
                    if variablename == onevar:
                        processed_rows.add(row_counter)
                        if filecolumns == column_types[5]:
                            countryname = row['Recipient Country']
                            variablecode = row['Item Code']
                            variableunit = row['Unit']
                        if filecolumns == column_types[6]:
                            countryname = row['Partner Countries']
                            variablecode = '%s - %s' % (row['Item Code'], row['Element Code'])
                            variableunit = row['Unit']
                        if filecolumns == column_types[7]:
                            countryname = row['Recipient Country']
                            variablecode = '%s - %s' % (row['Item Code'], row['Purpose Code'])
                            variableunit = row['Unit']

                        try:
                            year = int(row['Year'])
                            value = float(row['Value'])
                        except ValueError:
                            year = False
                            value = False
                        if year is not False and value is not False:
                            unique_record = tuple([countryname, int(row['Year'])])
                            if unique_record not in unique_records_holder:
                                unique_records_holder[unique_record] = float(row['Value'])
                            else:
                                unique_records_holder[unique_record] += float(row['Value'])

                    row_counter += 1

                for key, value in unique_records_holder.items():
                    variablename = file_dataset_names[original_filename] + ': ' + onevar
                    process_one_row(list(key)[1], str(value), list(key)[0], variablecode, variablename,
                                    existing_fao_variables_dict,
                                    variableunit, newsource, newdataset, variable_description,
                                    data_values_tuple_list)

        if len(data_values_tuple_list):  # insert any leftover data_values
            with connection.cursor() as c:
                c.executemany(insert_string, data_values_tuple_list)

    unique_data_tracker.update(current_file_vars_countries)


def process_one_row(year, value, countryname, variablecode, variablename, existing_fao_variables_dict,
                    unit, source, dataset, var_desc, data_values_tuple_list):

    global unique_data_tracker
    global processed_values

    processed_values += 1
    if processed_values % 300 == 0:
        time.sleep(0.001)  # this is done in order to not keep the CPU busy all the time

    insert_string = 'INSERT into data_values (value, year, fk_ent_id, fk_var_id) VALUES (%s, %s, %s, %s)'  # this is used for constructing the query for mass inserting to the data_values table

    if year is not False and value is not False:
        if tuple([countryname, variablecode]) not in unique_data_tracker:
            if countryname not in country_name_entity_ref:
                if countryname.lower() in existing_entities_list:
                    newentity = Entity.objects.get(name=countryname)
                elif country_tool_names_dict.get(unidecode.unidecode(countryname.lower()), 0):
                    newentity = Entity.objects.get(
                        name=country_tool_names_dict[unidecode.unidecode(countryname.lower())].owid_name)
                else:
                    newentity = Entity(name=countryname, validated=False)
                    newentity.save()
                country_name_entity_ref[countryname] = newentity

            if variablename not in existing_fao_variables_dict:
                s_unit = short_unit_extract(unit)
                newvariable = Variable(name=variablename,
                                       unit=unit if
                                       unit else '', short_unit=s_unit,
                                       description=var_desc,
                                       code=variablecode, timespan='',
                                       fk_dst_id=dataset, fk_var_type_id=VariableType.objects.get(pk=4),
                                       sourceId=source)
                try:
                    with transaction.atomic():
                        newvariable.save()
                except django.db.utils.IntegrityError:
                    newvariable = Variable(name=variablename,
                                           unit=unit if
                                           unit else '', short_unit=s_unit,
                                           description=var_desc,
                                           code=None, timespan='',
                                           fk_dst_id=dataset, fk_var_type_id=VariableType.objects.get(pk=4),
                                           sourceId=source)
                    newvariable.save()
                existing_fao_variables_dict[variablename] = newvariable
            data_values_tuple_list.append((str(value), int(year),
                                           country_name_entity_ref[countryname].pk,
                                           existing_fao_variables_dict[variablename].pk))
            if len(data_values_tuple_list) > 3000:  # insert when the length of the list goes over 3000
                with connection.cursor() as c:
                    c.executemany(insert_string, data_values_tuple_list)
                del data_values_tuple_list[:]

import_history = ImportHistory.objects.filter(import_type='faostat')

with transaction.atomic():
    processed_values = 0  # the total number of values processed
    datasets_list = []
    existing_categories = DatasetCategory.objects.values('name')
    existing_categories_list = {item['name'] for item in existing_categories}

    if fao_category_name_in_db not in existing_categories_list:
        the_category = DatasetCategory(name=fao_category_name_in_db, fetcher_autocreated=True)
        the_category.save()
    else:
        the_category = DatasetCategory.objects.get(name=fao_category_name_in_db)

    existing_subcategories = DatasetSubcategory.objects.filter(fk_dst_cat_id=the_category.pk).values('name')
    existing_subcategories_list = {item['name'] for item in existing_subcategories}

    existing_entities = Entity.objects.values('name')
    existing_entities_list = {item['name'].lower() for item in existing_entities}

    country_tool_names = CountryName.objects.all()
    country_tool_names_dict = {}
    for each in country_tool_names:
        country_tool_names_dict[each.country_name.lower()] = each.owid_country

    country_name_entity_ref = {}  # this dict will hold the country names and the appropriate entity object (this is used when saving the variables and their values)
    unique_data_tracker = set()  # this set will keep track of variable-country combinations

    for eachfile in glob.glob(all_dataset_files_dir + "/*.zip"):
        if os.path.basename(eachfile) not in files_to_exclude:
            file_extracted = 1
            zip_ref = zipfile.ZipFile(eachfile, 'r')
            csv_filename = zip_ref.namelist()[0]
            try:
                zip_ref.extractall("/tmp")
            except:
                file_extracted = 0
                print("Could not extract file: %s" % eachfile)
            zip_ref.close()

            if file_extracted:
                file_imported_before = False
                for oneimport in import_history:
                    if json.loads(oneimport.import_state)['file_name'] == os.path.basename(eachfile):
                        file_imported_before = True
                        imported_before_hash = json.loads(oneimport.import_state)['file_hash']
                if not file_imported_before:
                    process_csv_file_insert("/tmp/%s" % csv_filename, os.path.basename(eachfile))
                    os.remove("/tmp/%s" % csv_filename)
                    newimport = ImportHistory(import_type='faostat',
                                              import_time=timezone.now().strftime('%Y-%m-%d %H:%M:%S'),
                                              import_notes='Importing file %s' % os.path.basename(eachfile),
                                              import_state=json.dumps(
                                                  {'file_hash': file_checksum(eachfile),
                                                   'file_name': os.path.basename(eachfile)
                                                   }))
                    newimport.save()
                else:
                    if imported_before_hash == file_checksum(eachfile):
                        print('No updates available for file %s.' % os.path.basename(eachfile))

    for eachfile in glob.glob(all_dataset_files_dir + "/*.csv"):
        if os.path.basename(eachfile) not in files_to_exclude:
            file_imported_before = False
            for oneimport in import_history:
                if json.loads(oneimport.import_state)['file_name'] == os.path.basename(eachfile):
                    file_imported_before = True
                    imported_before_hash = json.loads(oneimport.import_state)['file_hash']
            if not file_imported_before:
                process_csv_file_insert(eachfile, os.path.basename(eachfile))
                newimport = ImportHistory(import_type='faostat',
                                          import_time=timezone.now().strftime('%Y-%m-%d %H:%M:%S'),
                                          import_notes='Importing file %s' % os.path.basename(eachfile),
                                          import_state=json.dumps(
                                              {'file_hash': file_checksum(eachfile),
                                               'file_name': os.path.basename(eachfile)
                                               }))
                newimport.save()
            else:
                if imported_before_hash == file_checksum(eachfile):
                    print('No updates available for file %s.' % os.path.basename(eachfile))

    for eachdataset in datasets_list:
        write_dataset_csv(eachdataset.pk, eachdataset.name, None, 'faostat_fetcher', '')

print("Script execution time: %s" % (datetime.now() - start_time))
