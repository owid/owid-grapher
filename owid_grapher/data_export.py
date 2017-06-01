import os
import sys
from django.forms.models import model_to_dict
from django.utils import timezone
sys.path.insert(1, os.path.join(sys.path[0], '..'))
import owid_grapher.wsgi
from grapher_admin.models import User, Chart, ChartDimension, VariableType, DataValue, Setting


current_time = timezone.now().strftime('%Y-%m-%d %H:%M:%S')

# Prepare the list to write our data to
out = ''

# These are used to keep track of records we have already written to files
seen_vars = {}
seen_datasets = {}
seen_sources = {}
seen_categories = {}
seen_subcategories = {}
seen_entities = {}

admin_user = User(pk=1, email='admin@example.com', name='admin', password='bcrypt$$2b$12$EXfM7cWsjlNchpinv.j6KuOwK92hihg5r3fNssty8tLCUpOubST9u',
                  is_active=True, is_superuser=True, created_at=timezone.now(), updated_at=timezone.now())
out += 'INSERT INTO users (`id`, `password`, `is_superuser`, `email`, `name`, `created_at`, `updated_at`, `is_active`) VALUES ' \
       "(1, 'bcrypt$$2b$12$EXfM7cWsjlNchpinv.j6KuOwK92hihg5r3fNssty8tLCUpOubST9u', 1, 'admin@example.com', 'admin', '%s', '%s', 1);\n" % (current_time, current_time)
user_dict = model_to_dict(admin_user)

var_types = VariableType.objects.all()
if var_types:
    for each in var_types:
        var_type_dict = model_to_dict(each)
        out += 'INSERT INTO variable_types (`id`, `name`, `isSortable`) VALUES ' \
               "(%s, '%s', %s);\n" % (var_type_dict['id'], var_type_dict['name'], var_type_dict['isSortable'])

chart_ids = [284, 561, 222, 112, 341, 414]

for one_type in chart_ids:

    charts = Chart.objects.get(pk=one_type, published=True)

    if charts:
        charts.last_edited_by = admin_user
        chart_dict = model_to_dict(charts)
        out += 'INSERT INTO charts (`id`, `name`, `config`, `slug`, `published`, `starred`, `type`, `last_edited_by`, `created_at`, `updated_at`, `last_edited_at`, `origin_url`, `notes`) VALUES ' \
               "(%s, '%s', '%s', '%s', %s, %s, '%s', '%s', '%s', '%s', '%s', '%s', '%s');\n" % (chart_dict['id'], chart_dict['name'].replace("'", "\\'"), chart_dict['config'].replace("\\", "\\\\").replace("'", "\\'"), chart_dict['slug'],
                                                                                 chart_dict['published'], chart_dict['starred'], chart_dict['type'], chart_dict['last_edited_by'].replace("'", "\\'"),
                                                                                 current_time, current_time, current_time, '', '')

        chart_dims = ChartDimension.objects.filter(chartId=charts)
        for each in chart_dims:
            if not seen_categories.get(each.variableId.fk_dst_id.fk_dst_cat_id.pk, 0):
                category_dict = model_to_dict(each.variableId.fk_dst_id.fk_dst_cat_id)
                out += 'INSERT INTO dataset_categories (`id`, `name`, `created_at`, `updated_at`) VALUES ' \
                       "(%s, '%s', '%s', '%s');\n" % (category_dict['id'], category_dict['name'].replace("'", "\\'"), current_time, current_time)
                seen_categories[each.variableId.fk_dst_id.fk_dst_cat_id.pk] = 1
            if not seen_subcategories.get(each.variableId.fk_dst_id.fk_dst_subcat_id.pk, 0):
                subcategory_dict = model_to_dict(each.variableId.fk_dst_id.fk_dst_subcat_id)
                out += 'INSERT INTO dataset_subcategories (`id`, `name`, `fk_dst_cat_id`, `created_at`, `updated_at`) VALUES ' \
                       "(%s, '%s', %s, '%s', '%s');\n" % (subcategory_dict['id'], subcategory_dict['name'].replace("'", "\\'"), subcategory_dict['fk_dst_cat_id'], current_time, current_time)
                seen_subcategories[each.variableId.fk_dst_id.fk_dst_subcat_id.pk] = 1
            if not seen_datasets.get(each.variableId.fk_dst_id.pk, 0):
                dataset_dict = model_to_dict(each.variableId.fk_dst_id)
                out += 'INSERT INTO datasets (`id`, `name`, `description`, `namespace`, `fk_dst_cat_id`, `fk_dst_subcat_id`, `created_at`, `updated_at`) VALUES ' \
                       "(%s, '%s', '%s', '%s', %s, %s, '%s', '%s');\n" % (dataset_dict['id'], dataset_dict['name'].replace("'", "\\'"), dataset_dict['description'].replace("'", "\\'"),
                                                                          dataset_dict['namespace'], dataset_dict['fk_dst_cat_id'], dataset_dict['fk_dst_subcat_id'],
                                                                          current_time, current_time)
                seen_datasets[each.variableId.fk_dst_id.pk] = 1
            if not seen_sources.get(each.variableId.sourceId.pk, 0):
                source_dict = model_to_dict(each.variableId.sourceId)
                out += 'INSERT INTO sources (`id`, `name`, `description`, `datasetId`, `created_at`, `updated_at`) VALUES ' \
                       "(%s, '%s', '%s', %s, '%s', '%s');\n" % (source_dict['id'], source_dict['name'].replace("'", "\\'"), source_dict['description'].replace("'", "\\'"),
                                                                source_dict['datasetId'], current_time, current_time)
                seen_sources[each.variableId.sourceId.pk] = 1
            if not seen_vars.get(each.variableId.pk, 0):
                each.variableId.uploaded_by = admin_user
                variable_dict = model_to_dict(each.variableId)
                out += 'INSERT INTO variables (`id`, `name`, `unit`, `description`, `code`, `coverage`, `timespan`, `fk_dst_id`, `fk_var_type_id`, `sourceId`, `uploaded_by`, `created_at`, `updated_at`, `uploaded_at`) VALUES ' \
                       "(%s, '%s', '%s', '%s', '%s', '%s', '%s', %s, %s, %s, '%s', '%s', '%s', '%s');\n" % (variable_dict['id'], variable_dict['name'].replace("'", "\\'"), variable_dict['unit'], variable_dict['description'].replace("'", "\\'"),
                                                                                                            variable_dict['code'], variable_dict['coverage'], variable_dict['timespan'],
                                                                                                            variable_dict['fk_dst_id'], variable_dict['fk_var_type_id'], variable_dict['sourceId'],
                                                                                                            variable_dict['uploaded_by'].replace("'", "\\'"), current_time, current_time, current_time)
                seen_vars[each.variableId.pk] = 1
            chart_dim_dict = model_to_dict(each)
            out += 'INSERT INTO chart_dimensions (`id`, `order`, `property`, `unit`, `displayName`, `targetYear`, `isProjection`, `tolerance`, `color`, `chartId`, `variableId`) VALUES ' \
                   "(%s, %s, '%s', '%s', '%s', %s, %s, %s, '%s', %s, %s);\n" % (chart_dim_dict['id'], chart_dim_dict['order'], chart_dim_dict['property'].replace("'", "\\'"), chart_dim_dict['unit'].replace("'", "\\'"),
                                                                                chart_dim_dict['displayName'].replace("'", "\\'"), chart_dim_dict['targetYear'], chart_dim_dict['isProjection'],
                                                                                chart_dim_dict['tolerance'], chart_dim_dict['color'].replace("'", "\\'"), chart_dim_dict['chartId'], chart_dim_dict['variableId'])

            data_values = DataValue.objects.filter(fk_var_id=each.variableId)
            data_values_str = ''
            for onevalue in data_values:
                if not seen_entities.get(onevalue.fk_ent_id.pk, 0):
                    entity_dict = model_to_dict(onevalue.fk_ent_id)
                    out += 'INSERT INTO entities (`id`, `code`, `name`, `validated`, `displayName`, `created_at`, `updated_at`) VALUES ' \
                           "(%s, '%s', '%s', %s, '%s', '%s', '%s');\n" % (entity_dict['id'], entity_dict['code'], entity_dict['name'].replace("'", "\\'"),
                                                                        entity_dict['validated'], entity_dict['displayName'].replace("'", "\\'"), current_time, current_time)
                    seen_entities[onevalue.fk_ent_id.pk] = 1
                data_value_dict = model_to_dict(onevalue)
                data_values_str += "(%s, '%s', %s, %s, %s)," % (data_value_dict['id'], data_value_dict['value'], data_value_dict['year'], data_value_dict['fk_ent_id'], data_value_dict['fk_var_id'])
            out += 'INSERT INTO data_values (`id`, `value`, `year`, `fk_ent_id`, `fk_var_id`) VALUES ' + data_values_str[:-1] + ';\n'


out += 'INSERT INTO licenses (`id`, `name`, `description`, `created_at`, `updated_at`) VALUES ' \
       "(%s, '%s', '%s', '%s', '%s');\n" % (1, 'Creative Commons', 'License description', current_time, current_time)

out += 'INSERT INTO logos (`id`, `name`, `svg`, `created_at`, `updated_at`) VALUES ' \
       "(%s, '%s', '%s', '%s', '%s');\n" % (1, 'OWD', '<svg><a></a></svg>', current_time, current_time)


setting = Setting.objects.first()
setting_dict = model_to_dict(setting)
out += 'INSERT INTO settings (`id`, `meta_name`, `meta_value`, `created_at`, `updated_at`) VALUES ' \
       "(%s, '%s', '%s', '%s', '%s');\n" % (setting_dict['id'], setting_dict['meta_name'].replace("'", "\\'"), setting_dict['meta_value'].replace("'", "\\'"), current_time, current_time)

out = out.replace(', None,', ', null,').replace(", 'None',", ', null,')
outfile = open('fixtures/owid_data.sql', 'w', encoding='utf8')
outfile.write(out)
outfile.close()
