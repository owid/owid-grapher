import sys
import os
import json
import unidecode
import time
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
from openpyxl import load_workbook

files_to_process = ['forest_biomass_above_ground','waste_municipal_total','glob_amph_critical','glob_amph_endangered','glob_amph_evaluated','glob_amph_percent','glob_amph_threatened','glob_amph_vulnerable','glob_animals_evaluated','glob_animals_percent','glob_animals_threatened','aquacult_prod_freshwater_fish','aquacult_prod_freshwater_value','aquacult_prod_marine_fish','aquacult_prod_marine_value','aquacult_prod_total','aquacult_prod_total_value','area_salinized','carbon_soil','forest_biomass_below_ground','glob_bird_critical','glob_bird_endangered','glob_bird_evaluated','glob_bird_percent','glob_bird_threatened','glob_bird_vulnerable','blue_water','forest_carbon_above_ground','forest_carbon_below_ground','reg_bod_tot_gems','reg_nitro_tot_gems','pm10_country','conservation_agriculture','ozone_all','ozone_ctc','ozone_cfc','ozone_halon','ozone_hcfc','ozone_meth_bromide','ozone_meth_chloro','continental_shelf','cnty_area','glob_crust_evaluated','glob_crust_percent','glob_crust_threatened','water_desalinated','mortality_resp_infections','active_pop','pop_agriculture','pop_agriculture_female','pop_agriculture_male','ele_distri','ele_dom','ele_nucl','ele_prod','ele_tps','ele_resid','ele_trans','emissions_so2_total_rivm','so2_unfccc_exc','so2_unfccc_inc','energy_road_total','energy_transport_total','prod_biodiesel','prod_biogasoline','energy_prod_comb_renew','energy_prod_crudeoil','energy_prod_hydro','energy_prod_naturalgas','energy_prod_nuclear','prod_biofuels_other','energy_prod_indig','efz','fish_catch_freshwater','fish_catch_marine','fish_catch','glob_fish_stock_fexp','glob_fish_stock_nexp','glob_fish_stock_oexp','fish_fresh_prod','fish_marine_value','fish_total_prod','glob_fishes_critical','glob_fishes_endangered','glob_fishes_evaluated','glob_fishes_percent','glob_fishes_threatened','glob_fishes_vulnerable','forest_area','forest_extent_change_tot','forest_fire_extent','forest_rate','forest_plantation_change','forest_plantation_extent','forest_cons','forest_prod','forest_prot','forest_fsc_extent','forest_pefc_area','forest_pefc_nb','glob_temperature','glob_temp_changes','glob_ghg_atm_live','glob_land_surface_temperature_live','glob_sea_level','glob_sea_level_live','glob_sea_level_uc','glob_sea_surface_temperature_live','green_water','grey_water','groundwater_recharge_int','forest_stock','pesticide_hazardous_export','pesticide_hazardous_import','glob_insects_critical','glob_insects_endangered','glob_insects_evaluated','glob_insects_percent','glob_insects_threatened','glob_insects_vulnerable','coastline_length','glob_living_planet_freshwater','glob_living_planet','glob_living_planet_marine','glob_living_planet_temperate','glob_living_planet_terrestrial','glob_living_planet_tropical','glob_mam_critical','glob_mam_endangered','glob_mam_evaluated','glob_mam_percent','glob_mam_threatened','glob_mam_vulnerable','mangroves_total','glob_mollusc_critical','glob_mollusc_endangered','glob_mollusc_evaluated','glob_mollusc_percent','glob_mollusc_threatened','glob_mollusc_vulnerable','waste_munic','reactors_op_pow','reactors_op_nb','reactors_cons_pow','reactors_cons_nb','reactors_op_pow','reactors_op_nb','reactors_cons_pow','reactors_cons_nb','unhcr_asylum','unhcr_idps','glob_all_treaties','unhcr_refugees','basel','cbd','cites','cms','kyoto','ramsar_convention','rotterdam','stockholm','unclos','unccd','unfccc','ozone_treaty','heritage_convention','food_production_variability','food_supply_variability','pesticide_cons_fong_bact','pesticide_consump_herbicides','pesticide_consump_insecticides','pesticide_consump_oils','pesticide_consump_plant','pesticide_consump_rodenticides','glob_plants_critical','glob_plants_endangered','glob_plants_evaluated','glob_plants_percent','glob_plants_threatened','glob_plants_vulnerable','glob_plastic_prod','pop_100km_coast','forest_primary_change','forest_primary_extent','water_waste_muni','marine_uncl_prot_ratio','marine_uncl_prot_tot','land_uncl_prot_ratio','land_uncl_prot_tot','terr_prot_ratio','terr_protected_tot','rail_km','rails_good','railways_passenger','refugees_asylum_tot','refugees_origine_total','glob_en_supply_index_biof','glob_en_supply_index_geo','glob_en_supply_index_hydro','glob_en_supply_index_solar','glob_en_supply_index_tiw','glob_en_supply_index_wind','glob_en_supply_index_wind','cholera_cases_nb','cholera_deaths_nb','glob_reptile_critical','glob_reptile_endangered','glob_reptile_evaluated','glob_reptile_percent','glob_reptile_threatened','glob_reptile_vulnerable','glob_sea_ice_area_north_live','glob_sea_ice_area_south_live','glob_sea_ice_extent_north_live','glob_sea_ice_extent_south_live','glob_sea_ice_extent','surface_water','dam_tot_cap','forest_total_extent','tpes_coal','tpes_comb_renew_waste','tpes_crude_oil','tpes_geotherm','tpes_hydro','tpes_natgas','tpes_nuclear','tpes_petroleum','tpes_solar','tpes_total','water_ground_renew','water_surface_water_renew','water_waste_muni_treated','wat_treat_waste_res','waste_glass','waste_paper','water_footprint','water_footprint_agri','water_footprint_ind','water_footprint_dom','water_dep_ratio','surface_groundwater','water_tot_exploit','water_tot_ext','water_external_renewable','water_resources_total','water_tot_renev','water_use_agri','water_use_agri_perc_renew','water_use_agri_perc_withdrawal','water_use_perc_renew','water_use_ind','water_use_ind_perc_withdrawal','water_use_dom','water_use_muni_perc_withdrawal','groundwat_withdraw_tot','surfacewater_withdrawal','water_use_total','ramsar_area','ramsar_number','whs_number']

un_ep_save_location = settings.BASE_DIR + '/data/un_ep/'

source_description = {
    'dataPublishedBy': "United Nations Environment Programme",
    'dataPublisherSource': None,
    'link': "http://ede.grid.unep.ch/",
    'retrievedDate': timezone.now().strftime("%d-%B-%y"),
    'additionalInfo': None
}

un_ep_category_name_in_db = 'UNEP Datasets'  # set the name of the root category of all data that will be imported by this script

new_datasets_list = []
existing_datasets_list = []

start_time = time.time()
row_number = 0
with transaction.atomic():

    existing_categories = DatasetCategory.objects.values('name')
    existing_categories_list = {item['name'] for item in existing_categories}

    if un_ep_category_name_in_db not in existing_categories_list:
        the_category = DatasetCategory(name=un_ep_category_name_in_db, fetcher_autocreated=True)
        the_category.save()
    else:
        the_category = DatasetCategory.objects.get(name=un_ep_category_name_in_db)

    existing_subcategories = DatasetSubcategory.objects.filter(categoryId=the_category.pk).values('name')
    existing_subcategories_list = {item['name'] for item in existing_subcategories}

    existing_variables = Variable.objects.filter(datasetId__namespace='un_ep').values('name')
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

    for file in glob.glob(un_ep_save_location + "/*.xlsx"):
        subcategory_name = None

        if file[file.index('__')+2:file.rfind('__')] in files_to_process:

            print('Processing: %s' % file)

            # let's first extract the metadata

            wb = load_workbook(file, read_only=True)
            metadata = wb['Metadata']

            column_number = 0  # this will be reset to 0 on each new row
            row_number = 0  # this will be reset to 0 if we switch to another worksheet, or start reading the worksheet from the beginning one more time

            publication_year = ''
            unit = ''
            abstract = ''
            point_of_contact = 'Point of contact\n'
            temporal_extent = 'Temporal extent\n'
            geographic_extent = 'Geographic extent\n'
            subcategory_name = 'Unknown'
            varunit = None

            for row in metadata.rows:
                row_number += 1
                for cell in row:
                    column_number += 1
                    if row_number == 4 and column_number == 2:
                        varname = cell.value
                    if row_number == 5 and column_number == 2:
                        publication_year = 'Publication year: ' + str(cell.value)
                    if row_number == 8 and column_number == 2:
                        unit = 'Unit: ' + cell.value
                        varunit = cell.value
                    if row_number == 12 and column_number == 2:
                        abstract = 'Abstract \n' + cell.value

                    if row_number == 29 and column_number == 2:
                        point_of_contact += 'Role: ' + cell.value + '\n' if cell.value else 'None'
                    if row_number == 30 and column_number == 2:
                        point_of_contact += 'Person: ' + cell.value + '\n' if cell.value else 'None'
                    if row_number == 31 and column_number == 2:
                        point_of_contact += 'Organization: ' + cell.value + '\n' if cell.value else 'None'
                    if row_number == 32 and column_number == 2:
                        point_of_contact += 'Email: ' + cell.value + '\n' if cell.value else 'None'

                    if row_number == 21 and column_number == 2:
                        temporal_extent += 'Covered time: ' + cell.value if cell.value else 'N/A'

                    if row_number == 23 and column_number == 2:
                        geographic_extent += 'Coverage: ' + cell.value if cell.value else 'N/A'
                    if row_number == 16 and column_number == 2:
                        subcategory_name = cell.value

                column_number = 0

            metadata_string = "{}\n{}\n{}\n{}\n{}\n{}".format(publication_year, unit, abstract, point_of_contact, temporal_extent, geographic_extent)

            source_description['additionalInfo'] = metadata_string if metadata_string else None

            if subcategory_name not in existing_subcategories_list:
                the_subcategory = DatasetSubcategory(name=subcategory_name, categoryId=the_category)
                the_subcategory.save()
                newdataset = Dataset(name=subcategory_name,
                                     description='This is a dataset imported by the automated fetcher',
                                     namespace='un_ep', categoryId=the_category,
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
            if 'iea.org' in json.dumps(source_description).lower() or 'iea stat' in json.dumps(
                source_description).lower() or 'iea 2014' in json.dumps(source_description).lower():
                source_description[
                    'dataPublishedBy'] = 'International Energy Agency (IEA) via United Nations Environment Programme'
            else:
                source_description['dataPublishedBy'] = "United Nations Environment Programme"
            if varname not in existing_variables_list:
                newsource = Source(name=varname,
                                   description=json.dumps(source_description),
                                   datasetId=dataset_name_to_object[subcategory_name].pk)
                newsource.save()
                source_name_to_object[varname] = newsource
            else:
                newsource = Source.objects.get(name=varname, datasetId=dataset_name_to_object[subcategory_name].pk)
                newsource.description = json.dumps(source_description)
                newsource.save()
                source_name_to_object[varname] = newsource

            if varname not in existing_variables_list:

                newvariable = Variable(name=varname,
                                       unit=varunit,
                                       datasetId=dataset_name_to_object[subcategory_name],
                                       variableTypeId=VariableType.objects.get(pk=4),
                                       sourceId=source_name_to_object[varname])
                newvariable.save()
                variable_name_to_object[varname] = newvariable
                existing_variables_list.add(newvariable.name)
            else:
                if varname not in variable_name_to_object:
                    newvariable = Variable.objects.get(name=varname,
                                                       datasetId=dataset_name_to_object[subcategory_name])
                    while DataValue.objects.filter(variableId__pk=newvariable.pk).first():
                        with connection.cursor() as c:  # if we don't limit the deleted values, the db might just hang
                            c.execute('DELETE FROM %s WHERE variableId = %s LIMIT 10000;' %
                                      (DataValue._meta.db_table, newvariable.pk))
                    variable_name_to_object[varname] = newvariable

            for onesheet in wb.get_sheet_names():
                column_number = 0
                row_number = 0

                column_to_years = {}
                if onesheet != 'Metadata':

                    for row in wb[onesheet].rows:
                        row_number += 1
                        for cell in row:
                            column_number += 1

                            if row_number > 1 and column_number == 1:
                                entity = cell.value
                                if entity not in c_name_entity_ref:
                                    if entity == 'Global':
                                        newentity = Entity.objects.get(name='World')
                                    elif country_tool_names_dict.get(unidecode.unidecode(entity.lower()), 0):
                                        newentity = Entity.objects.get(
                                            name=country_tool_names_dict[
                                                unidecode.unidecode(entity.lower())].owid_name)
                                    elif entity.lower() in existing_entities_list:
                                        newentity = Entity.objects.get(name__iexact=entity)
                                    else:
                                        newentity = Entity(name=entity, validated=False)
                                        newentity.save()
                                    c_name_entity_ref[entity] = newentity

                            if onesheet == 'National':

                                if row_number == 1 and column_number > 14:
                                    if cell.value:
                                        try:
                                            column_to_years[column_number] = int(cell.value)
                                        except:
                                            pass

                                if row_number > 1 and column_number > 14:
                                    if column_number in column_to_years:
                                        if str(cell.value) != '-9999':
                                            data_values_tuple_list.append(
                                                (str(float(cell.value)), column_to_years[column_number],
                                                 c_name_entity_ref[entity].pk,
                                                 variable_name_to_object[varname].pk))

                            if onesheet == 'Subregional':

                                if row_number == 1 and column_number > 2:
                                    if cell.value:
                                        try:
                                            column_to_years[column_number] = int(cell.value)
                                        except:
                                            pass

                                if row_number > 1 and column_number > 2:
                                    if column_number in column_to_years:
                                        if str(cell.value) != '-9999':
                                            if entity != 'North America':
                                                data_values_tuple_list.append(
                                                    (str(float(cell.value)), column_to_years[column_number],
                                                     c_name_entity_ref[entity].pk,
                                                     variable_name_to_object[varname].pk))

                            if onesheet == 'Regional' or onesheet == 'Global':

                                if row_number == 1 and column_number > 1:
                                    if cell.value:
                                        try:
                                            column_to_years[column_number] = int(cell.value)
                                        except:
                                            pass

                                if row_number > 1 and column_number > 1:
                                    if column_number in column_to_years:
                                        if str(cell.value) != '-9999':
                                            data_values_tuple_list.append(
                                                (str(float(cell.value)), column_to_years[column_number],
                                                 c_name_entity_ref[entity].pk,
                                                 variable_name_to_object[varname].pk))

                        column_number = 0

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


# for dataset in existing_datasets_list:
#     print(dataset.name)
#     write_dataset_csv(dataset.pk, dataset.name, dataset.name, 'un_ep_fetcher', '')
# for dataset in new_datasets_list:
#     print(dataset.name)
#     write_dataset_csv(dataset.pk, dataset.name, None, 'un_ep_fetcher', '')

newimport = ImportHistory(import_type='un_ep', import_time=timezone.now().strftime('%Y-%m-%d %H:%M:%S'),
                                  import_notes='A un_ep import was performed',
                                  import_state='There are a total of %s un_ep variables after the import' % Variable.objects.filter(datasetId__namespace='un_ep').count())
newimport.save()

print("--- %s seconds ---" % (time.time() - start_time))
