import json
import os
import sys
from django.utils import timezone
sys.path.insert(1, os.path.join(sys.path[0], '..'))
import owid_grapher.wsgi
from grapher_admin.models import User, Chart, ChartDimension, VariableType, DataValue, License, Logo, Setting
from django.core import serializers

# Prepare the list to write our data to
out = []

# These are used to keep track of records we have already written to files
seen_vars = {}
seen_datasets = {}
seen_sources = {}
seen_categories = {}
seen_subcategories = {}
seen_entities = {}

admin_user = User(pk=1, email='admin@example.com', name='admin', password='bcrypt$$2b$12$EXfM7cWsjlNchpinv.j6KuOwK92hihg5r3fNssty8tLCUpOubST9u',
                  is_active=True, is_superuser=True, created_at=timezone.now(), updated_at=timezone.now())
user = json.loads(serializers.serialize("json", [admin_user]))
out.append(user[0])

var_types = VariableType.objects.all()
if var_types:
    var_type = json.loads(serializers.serialize("json", var_types))
    for each in var_type:
        out.append(each)

chart_ids = [284, 561, 222, 112, 341, 414]

for one_type in chart_ids:

    charts = Chart.objects.get(pk=one_type, published=True)

    if charts:
        charts.last_edited_by = admin_user
        chart = json.loads(serializers.serialize("json", [charts]))
        out.append(chart[0])

        chart_dims = ChartDimension.objects.filter(chartId=charts)

        for each in chart_dims:
            if not seen_categories.get(each.variableId.fk_dst_id.fk_dst_cat_id.pk, 0):
                category = json.loads(serializers.serialize("json", [each.variableId.fk_dst_id.fk_dst_cat_id]))
                if not category[0]['fields']['created_at']:
                    category[0]['fields']['created_at'] = str(timezone.now())
                if not category[0]['fields']['updated_at']:
                    category[0]['fields']['updated_at'] = str(timezone.now())
                out.append(category[0])
                seen_categories[each.variableId.fk_dst_id.fk_dst_cat_id.pk] = 1
            if not seen_subcategories.get(each.variableId.fk_dst_id.fk_dst_subcat_id.pk, 0):
                subcategory = json.loads(serializers.serialize("json", [each.variableId.fk_dst_id.fk_dst_subcat_id]))
                if not subcategory[0]['fields']['created_at']:
                    subcategory[0]['fields']['created_at'] = str(timezone.now())
                if not subcategory[0]['fields']['updated_at']:
                    subcategory[0]['fields']['updated_at'] = str(timezone.now())
                out.append(subcategory[0])
                seen_subcategories[each.variableId.fk_dst_id.fk_dst_subcat_id.pk] = 1
            if not seen_datasets.get(each.variableId.fk_dst_id.pk, 0):
                dataset = json.loads(serializers.serialize("json", [each.variableId.fk_dst_id]))
                if not dataset[0]['fields']['created_at']:
                    dataset[0]['fields']['created_at'] = str(timezone.now())
                if not dataset[0]['fields']['updated_at']:
                    dataset[0]['fields']['updated_at'] = str(timezone.now())
                out.append(dataset[0])
                seen_datasets[each.variableId.fk_dst_id.pk] = 1
            if not seen_sources.get(each.variableId.sourceId.pk, 0):
                source = json.loads(serializers.serialize("json", [each.variableId.sourceId]))
                if not source[0]['fields']['created_at']:
                    source[0]['fields']['created_at'] = str(timezone.now())
                if not source[0]['fields']['updated_at']:
                    source[0]['fields']['updated_at'] = str(timezone.now())
                out.append(source[0])
                seen_sources[each.variableId.sourceId.pk] = 1
            if not seen_vars.get(each.variableId.pk, 0):
                each.variableId.uploaded_by = admin_user
                variable = json.loads(serializers.serialize("json", [each.variableId]))
                if not variable[0]['fields']['created_at']:
                    variable[0]['fields']['created_at'] = str(timezone.now())
                if not variable[0]['fields']['updated_at']:
                    variable[0]['fields']['updated_at'] = str(timezone.now())
                out.append(variable[0])
                seen_vars[each.variableId.pk] = 1
            chart_dim = json.loads(serializers.serialize("json", [each]))
            out.append(chart_dim[0])

            data_values = DataValue.objects.filter(fk_var_id=each.variableId)
            for onevalue in data_values:
                if not seen_entities.get(onevalue.fk_ent_id.pk, 0):
                    entity = json.loads(serializers.serialize("json", [onevalue.fk_ent_id]))
                    if not entity[0]['fields']['created_at']:
                        entity[0]['fields']['created_at'] = str(timezone.now())
                    if not entity[0]['fields']['updated_at']:
                        entity[0]['fields']['updated_at'] = str(timezone.now())
                    out.append(entity[0])
                    seen_entities[onevalue.fk_ent_id.pk] = 1
                data_value = json.loads(serializers.serialize("json", [onevalue]))
                out.append(data_value[0])


the_license = License(name='Creative Commons', updated_at=timezone.now(), created_at=timezone.now(), description='License description')
the_license = json.loads(serializers.serialize("json", [the_license]))
out.append(the_license[0])

the_logo = Logo(name="OWD", updated_at=timezone.now(), created_at=timezone.now(), svg='<svg><a></a></svg>')
the_logo = json.loads(serializers.serialize("json", [the_logo]))
out.append(the_logo[0])

setting = Setting.objects.first()
setting = json.loads(serializers.serialize("json", [setting]))
if not setting[0]['fields']['created_at']:
    setting[0]['fields']['created_at'] = str(timezone.now())
if not setting[0]['fields']['updated_at']:
    setting[0]['fields']['updated_at'] = str(timezone.now())
out.append(setting[0])

outfile = open("fixtures/owid_data.json", "w")
outfile.write(json.dumps(out, indent=4))
outfile.close()
