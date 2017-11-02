import json
from django.db import transaction
from django.db import connection
from django.test import TestCase
from grapher_admin.models import DatasetSubcategory, Dataset, Variable, Source, DataValue, Entity


class OwidTests(TestCase):

    @transaction.atomic()
    def setUp(self):
        with connection.cursor() as cursor:
            file = open('owid_grapher/fixtures/owid_data.sql', 'r', encoding='utf8').read()
            delimit = ");\n"  # the delimiter that separates each INSERT statement in our export file
            file = [e + delimit for e in file.split(delimit) if e]
            for eachline in file:
                cursor.execute(eachline)

    # Tests for the admin side of the grapher

    @classmethod
    def create_new_dataset_json(cls):
        random_category = DatasetSubcategory.objects.all().order_by('?').first()
        random_category = random_category.pk

        test_dataset = {}
        test_dataset['dataset'] = {
            'id': None,
            'name': 'testdataset',
            'description': 'testdescription',
            'subcategoryId': random_category
        }
        test_dataset['years'] = [1850, 1860, 1870, 1880, 1890, 1900]
        test_dataset['entityNames'] = ["United Kingdom", "Singapore", "Albania", "Australia", "Armenia", "Hungary"]
        test_dataset['entities'] = [0, 1, 2, 3, 4, 5]
        test_dataset['variables'] = []
        test_dataset['variables'].append({
            'overwriteId': None,
            'name': 'Test Values 1',
            'unit': '%',
            'description': 'Test description for variable 1',
            'coverage': 'global',
            'timespan': '1850-1900',
            'source': {
                'id': None,
                'name': 'Test Source',
                'dataPublishedBy': "test publisher",
                'dataPublisherSource': "test publisher source",
                'link': "https://example.com",
                'retrievedDate': "2017-01-01",
                'additionalInfo': "test additional info"
            },
            'values': ["0.000431591", "0.000462546", "0.000478732", "0.000479573", "0.00045079", "0.000470082"]
        })
        test_dataset['variables'].append({
            'overwriteId': None,
            'name': 'Test Values 2',
            'unit': '',
            'description': 'Test description for variable 2',
            'coverage': '',
            'timespan': '1850-1900',
            'source': {
                'id': None,
                'name': 'Test Source',
                'dataPublishedBy': "test publisher",
                'dataPublisherSource': "test publisher source",
                'link': "https://example.com",
                'retrievedDate': "2017-01-01",
                'additionalInfo': "test additional info"
            },
            'values': ["3.6", "3.2", "6.5", "7.4", "3.456", "3"]
        })

        return test_dataset

    def test_listcharts(self):
        self.client.login(email='admin@example.com', password='admin')
        response = self.client.get('/grapher/admin/')
        self.assertEqual(response.status_code, 200)

    def test_createchart(self):
        self.client.login(email='admin@example.com', password='admin')
        response = self.client.get('/grapher/admin/charts/create/')
        self.assertEqual(response.status_code, 200)

    # this is for scenarios where the dataset does not overwrite anything
    def test_import_newdataset(self):
        self.client.login(email='admin@example.com', password='admin')
        test_dataset = self.create_new_dataset_json()

        initial_number_of_variables = Variable.objects.all().count()
        initial_number_of_sources = Source.objects.all().count()
        initial_number_of_values = DataValue.objects.all().count()
        initial_number_of_entities = Entity.objects.all().count()
        all_entity_names = Entity.objects.values('name')
        all_entity_names_list = []
        for each in all_entity_names:
            all_entity_names_list.append(each['name'])

        response = self.client.post('/grapher/admin/import/variables', json.dumps(test_dataset), content_type="application/json")
        last_dataset_insert_id = Dataset.objects.all().last()
        last_dataset_insert_id = last_dataset_insert_id.pk

        final_number_of_variables = Variable.objects.all().count()
        final_number_of_sources = Source.objects.all().count()
        final_number_of_values = DataValue.objects.all().count()
        final_number_of_entities = Entity.objects.all().count()

        unique_sources = {}
        new_sources_number = 0
        for each in test_dataset['variables']:
            if not unique_sources.get(each['source']['name'], 0):
                new_sources_number += 1
                unique_sources[each['source']['name']] = 1

        inserted_values = 0
        for each in test_dataset['variables']:
            inserted_values += len(each['values'])

        new_entities = 0
        for each in test_dataset['entityNames']:
            if each not in all_entity_names_list:
                new_entities += 1

        self.assertEqual(response.status_code, 200)
        self.assertJSONEqual(response.content, {'datasetId': last_dataset_insert_id}) # check if the dataset was inserted correctly
        self.assertEqual(initial_number_of_variables + len(test_dataset['variables']), final_number_of_variables) # check if number of variables is correct
        self.assertEqual(initial_number_of_sources + new_sources_number, final_number_of_sources) # check if number of sources is correct
        self.assertEqual(initial_number_of_values + inserted_values, final_number_of_values) # check if number of data values is correct
        self.assertEqual(initial_number_of_entities + new_entities, final_number_of_entities) # check if number of entities is correct

    # this is for scenarios where the dataset being imported overwrites the existing one
    def test_overwrite_dataset(self):
        self.client.login(email='admin@example.com', password='admin')

        test_dataset = self.create_new_dataset_json()
        self.client.post('/grapher/admin/import/variables', json.dumps(test_dataset), content_type="application/json")
        last_dataset_insert_id = Dataset.objects.all().last()
        self.assertEqual(test_dataset['dataset']['name'], last_dataset_insert_id.name)  # making sure that the post request went through
        test_dataset['dataset']['id'] = last_dataset_insert_id.pk  # set the dataset id to overwrite
        test_dataset['dataset']['name'] = 'changed name'
        test_dataset['dataset']['description'] = 'changed description'
        variable_to_overwrite = Variable.objects.filter(fk_dst_id=last_dataset_insert_id).first()
        test_dataset['variables'][0]['overwriteId'] = variable_to_overwrite.pk  # the first variable will overwrite one of the variables in the DB
        test_dataset['variables'][0]['source']['id'] = variable_to_overwrite.sourceId.pk
        test_dataset['variables'][0]['values'].append('0.000478732')  # adding an extra value - referenced in inserted_values below
        test_dataset['variables'][1]['values'].append('')
        test_dataset['years'].append(1910)  # for the extra value above
        test_dataset['entities'].append(0)  # for the extra value above
        test_dataset['variables'][1]['name'] = 'New Test Values'  # the second variable will be added as a new variable
        test_dataset['variables'][1]['source']['name'] = 'New Test Source'

        initial_number_of_variables = Variable.objects.all().count()
        initial_number_of_sources = Source.objects.all().count()
        initial_number_of_values = DataValue.objects.all().count()

        response = self.client.post('/grapher/admin/import/variables', json.dumps(test_dataset),
                                    content_type="application/json")

        final_number_of_variables = Variable.objects.all().count()
        final_number_of_sources = Source.objects.all().count()
        final_number_of_values = DataValue.objects.all().count()

        new_variables_number = 1
        new_sources_number = 1
        inserted_values = len(test_dataset['variables'][1]['values'])

        changed_dataset = Dataset.objects.all().last()
        changed_dataset_name = changed_dataset.name
        changed_dataset_description = changed_dataset.description

        self.assertEqual(response.status_code, 200)
        self.assertJSONEqual(response.content,
                             {'datasetId': test_dataset['dataset']['id']})
        self.assertEqual(test_dataset['dataset']['name'], changed_dataset_name)
        self.assertEqual(test_dataset['dataset']['description'], changed_dataset_description)
        self.assertEqual(initial_number_of_variables + new_variables_number, final_number_of_variables)
        self.assertEqual(initial_number_of_sources + new_sources_number, final_number_of_sources)
        self.assertEqual(initial_number_of_values + inserted_values, final_number_of_values)
