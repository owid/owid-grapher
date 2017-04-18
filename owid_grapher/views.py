from django.http import HttpResponse
from django.shortcuts import render
from django.conf import settings
import os
import json
from grapher_admin.models import Chart, Variable, License, DataValue, Entity
from django.http import HttpResponse


def chart(request, id):
    """
    manifest = json.loads(open(os.path.join(settings.BASE_DIR, "public/build/manifest.json")).read())
    jsPath = f"/build/{manifest['charts.js']}"
    cssPath = f"/build/{manifest['charts.css']}"
    """

    # for now, only looking up the chart by its id, not slug
    config = Chart.objects.get(pk=id)
    config = 'App.loadChart(' + config.config + ')'

    return render(request, 'grapher/base_chart_template.html', context={'slug': id, 'config': config})


def variables(request, ids):
    varids = []
    meta = {}
    entitykey = {}
    meta['variables'] = {}
    meta['license'] = License.objects.values().first()
    meta['license']['created_at'] = str(meta['license']['created_at'])
    meta['license']['updated_at'] = str(meta['license']['updated_at'])
    large_string = ''
    for each in ids.split('+'):
        varids.append(int(each))

    for each in varids:
        varobj = Variable.objects.select_related('sourceid__datasetid__fk_dst_cat_id').get(pk=each)
        source = {}
        source['name'] = varobj.sourceid.name
        source['description'] = varobj.sourceid.description

        var = {}
        var['id'] = varobj.pk
        var['name'] = varobj.name
        var['dataset_name'] = varobj.fk_dst_id.name
        var['created_at'] = str(varobj.created_at)
        var['description'] = varobj.description
        var['unit'] = varobj.unit
        var['source'] = source
        var['entities'] = []
        var['years'] = []
        var['values'] = []
        meta['variables'][varobj.pk] = var

    varstring = "\r\n"

    for each in varids:
        varobj = DataValue.objects.filter(fk_var_id_id=each).select_related('fk_ent_id').order_by('fk_var_id_id').order_by('year')

        varstring += str(each)
        for row in varobj:
            varstring += ';' + str(row.year) + ',' + str(row.fk_ent_id.pk) + ',' + str(row.value)
            if not entitykey.get(str(row.fk_ent_id.pk), 0):
                entitykey[str(row.fk_ent_id.pk)] = {'name': row.fk_ent_id.name, 'code': row.fk_ent_id.code}
        varstring += "\r\n"

    return HttpResponse(json.dumps(meta) + varstring + json.dumps(entitykey), content_type="text/plain")