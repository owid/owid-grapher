import os
import sys
from django.db import connection
from django.forms.models import model_to_dict
from django.utils import timezone
sys.path.insert(1, os.path.join(sys.path[0], '..'))
import grapher_admin.wsgi
from grapher_admin.models import User, Chart, ChartDimension, VariableType, DataValue, Setting, Entity
from MySQLdb import escape_string
import json

def dictfetchall(cursor):
    "Return all rows from a cursor as a dict"
    columns = [col[0] for col in cursor.description]
    return [
        dict(zip(columns, row))
        for row in cursor.fetchall()
    ]

def format_sql(statement, *args):
    format_args = []
    for arg in args:
        if arg is None:
            format_args.append('null')
        elif isinstance(arg, (int, float)):
            format_args.append(arg)
        elif arg is True:
            format_args.append("True")
        elif arg is False:
            format_args.append("False")
        else:
            format_args.append("'"+escape_string(arg)+"'")
    return statement.format(*format_args)

current_time = timezone.now().strftime('%Y-%m-%d %H:%M:{}')

# Prepare the list to write our data to
out = ''

# These are used to keep track of records we have already written to files
seen_vars = {}
seen_datasets = {}
seen_sources = {}
seen_categories = {}
seen_subcategories = {}
seen_entities = {}
seen_data_values = {}

all_entities = list(Entity.objects.all().values())
entities_dict = {}
for each in all_entities:
    entities_dict[each['id']] = each

admin_user = User(pk=1, email='admin@example.com', name='admin', password='bcrypt$$2b$12$EXfM7cWsjlNchpinv.j6KuOwK92hihg5r3fNssty8tLCUpOubST9u',
                  is_active=True, is_superuser=True, created_at=timezone.now(), updated_at=timezone.now())
out += format_sql('INSERT INTO users (`id`, `password`, `is_superuser`, `email`, `name`, `created_at`, `updated_at`, `is_active`) VALUES ' \
       "(1, 'bcrypt$$2b$12$EXfM7cWsjlNchpinv.j6KuOwK92hihg5r3fNssty8tLCUpOubST9u', 1, 'admin@example.com', 'admin', {}, {}, 1);\n", current_time, current_time)
user_dict = model_to_dict(admin_user)

var_types = VariableType.objects.all()
if var_types:
    for each in var_types:
        out += format_sql('INSERT INTO variable_types (`id`, `name`, `isSortable`) VALUES ' \
               "({}, {}, {});\n", each.pk, each.name, each.isSortable)

chart_ids = [284, 561, 222, 112, 341, 414]

['law-mandate-nondiscrimination-hiring', 'law-mandate-equal-pay', 'does-legislation-explicitly-criminalise-marital-rape', 'gender-rights-to-property',
'women-required-to-obey-husband', 'does-law-mandate-paid-or-unpaid-maternity-leave', 'nondiscrimination-clause-gender']


for one_type in chart_ids:

    charts = Chart.objects.get(pk=one_type)

    if charts:
        charts.last_edited_by = admin_user
        out += format_sql(
            'INSERT INTO charts (`id`, `config`, `starred`, `last_edited_by`, `created_at`, `updated_at`, `last_edited_at`, `published_at`, `published_by`) VALUES ' \
               "({}, {}, {}, {}, {}, {}, {}, {}, {});\n", charts.pk, json.dumps(charts.config), charts.starred, charts.last_edited_by.name,
                                                                                 current_time, current_time, current_time, current_time, charts.last_edited_by.name)

        chart_dims = ChartDimension.objects.filter(chartId=charts)
        for each in chart_dims:
            if not seen_categories.get(each.variableId.datasetId.categoryId.pk, 0):
                category = each.variableId.datasetId.categoryId
                out += format_sql('INSERT INTO dataset_categories (`id`, `name`, `fetcher_autocreated`, `created_at`, `updated_at`) VALUES ' \
                       "({}, {}, 0, {}, {});\n", category.pk, category.name, current_time, current_time)
                seen_categories[each.variableId.datasetId.categoryId.pk] = 1
            if not seen_subcategories.get(each.variableId.datasetId.subcategoryId.pk, 0):
                subcategory = each.variableId.datasetId.subcategoryId
                out += format_sql('INSERT INTO dataset_subcategories (`id`, `name`, `categoryId`, `created_at`, `updated_at`) VALUES ' \
                       "({}, {}, {}, {}, {});\n", subcategory.pk, subcategory.name, subcategory.categoryId.pk, current_time, current_time)
                seen_subcategories[each.variableId.datasetId.subcategoryId.pk] = 1
            if not seen_datasets.get(each.variableId.datasetId.pk, 0):
                dataset = each.variableId.datasetId
                out += format_sql('INSERT INTO datasets (`id`, `name`, `description`, `namespace`, `categoryId`, `subcategoryId`, `created_at`, `updated_at`) VALUES ' \
                       "({}, {}, {}, {}, {}, {}, {}, {});\n", dataset.pk, dataset.name, dataset.description,
                                                                          dataset.namespace, dataset.categoryId.pk, dataset.subcategoryId.pk,
                                                                          current_time, current_time)
                seen_datasets[each.variableId.datasetId.pk] = 1
            if not seen_sources.get(each.variableId.sourceId.pk, 0):
                source = each.variableId.sourceId
                out += format_sql('INSERT INTO sources (`id`, `name`, `description`, `datasetId`, `created_at`, `updated_at`) VALUES ' \
                       "({}, {}, {}, {}, {}, {});\n", source.pk, source.name, source.description,
                                                                source.datasetId, current_time, current_time)
                seen_sources[each.variableId.sourceId.pk] = 1
            if not seen_vars.get(each.variableId.pk, 0):
                each.variableId.uploaded_by = admin_user
                variable = each.variableId
                out += format_sql('INSERT INTO variables (`id`, `name`, `unit`, `description`, `code`, `coverage`, `timespan`, `datasetId`, `variableTypeId`, `sourceId`, `uploaded_by`, `created_at`, `updated_at`, `uploaded_at`, `display`) VALUES ' \
                       "({}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {});\n", variable.pk, variable.name, variable.unit, variable.description,
                                                                                                            variable.code, variable.coverage, variable.timespan,
                                                                                                            variable.datasetId.pk, variable.variableTypeId.pk, variable.sourceId.pk,
                                                                                                            variable.uploaded_by.name, current_time, current_time, current_time, "{}")
                seen_vars[each.variableId.pk] = 1
            chart_dim = each
            out += format_sql('INSERT INTO chart_dimensions (`id`, `order`, `property`, `chartId`, `variableId`) VALUES ' \
                   "({}, {}, {}, {}, {});\n", chart_dim.pk, chart_dim.order, chart_dim.property, chart_dim.chartId.pk, chart_dim.variableId.pk)

            entity_ids = DataValue.objects.filter(variableId=each.variableId).values_list('entityId', flat=True)
            for one_id in entity_ids:
                if not seen_entities.get(one_id, 0):
                    out += format_sql('INSERT INTO entities (`id`, `code`, `name`, `validated`, `displayName`, `created_at`, `updated_at`) VALUES ' \
                           "({}, {}, {}, {}, {}, {}, {});\n", entities_dict[one_id]['id'], entities_dict[one_id]['code'],
                                                                          entities_dict[one_id]['name'],
                                                                          entities_dict[one_id]['validated'], entities_dict[one_id]['displayName'], current_time, current_time)
                    seen_entities[one_id] = 1

            with connection.cursor() as cursor:
                cursor.execute(format_sql('SELECT * FROM data_values WHERE variableId = {};', each.variableId.pk))
                data_values = dictfetchall(cursor)
            data_values_str = ''
            for onevalue in data_values:
                if onevalue['id'] not in seen_data_values:
                    data_values_str += format_sql("({}, {}, {}, {}, {}),", onevalue['id'], onevalue['value'], onevalue['year'], onevalue['entityId'], onevalue['variableId'])
                    seen_data_values[onevalue['id']] = 1
            if data_values_str:
                out += 'INSERT INTO data_values (`id`, `value`, `year`, `entityId`, `variableId`) VALUES ' + data_values_str[:-1] + ';\n'


out += format_sql('INSERT INTO licenses (`id`, `name`, `description`, `created_at`, `updated_at`) VALUES ' \
       "({}, {}, {}, {}, {});\n", 1, 'Creative Commons', 'License description', current_time, current_time)

out += format_sql('INSERT INTO logos (`id`, `name`, `svg`, `created_at`, `updated_at`) VALUES ' \
       "({}, {}, {}, {}, {});\n", 1, 'OWD', '<svg><a></a></svg>', current_time, current_time)


setting = Setting.objects.first()
out += format_sql('INSERT INTO settings (`id`, `meta_name`, `meta_value`, `created_at`, `updated_at`) VALUES ' \
       "({}, {}, {}, {}, {});\n", setting.pk, setting.meta_name, setting.meta_value, current_time, current_time)

out = out.replace(', None,', ', null,').replace(", 'None',", ', null,')
outfile = open('fixtures/owid_data.sql', 'w', encoding='utf8')
outfile.write(out)
outfile.close()
