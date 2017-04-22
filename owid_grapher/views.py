import os
import json
from django.shortcuts import render
from django.conf import settings
from grapher_admin.models import Chart, Variable, License, DataValue, Entity
from django.http import HttpResponse, HttpResponseNotFound
from django.contrib.auth.decorators import login_required


@login_required
def chart(request, chartid):

    manifest = json.loads(open(os.path.join(settings.BASE_DIR, "public/build/manifest.json")).read())
    jspath = "/build/%s" % (manifest['charts.js'])
    csspath = "/build/%s" % (manifest['charts.css'])

    # for now, only looking up the chart by its id, not slug
    chartmeta = {}

    configpath = "%s/config/%s.js" % (settings.BASE_URL, chartid)

    return render(request, 'grapher/base_chart_template.html', context={'slug': chartid,
                                                                        'meta': chartmeta, 'configpath': configpath,
                                                                        'jspath': jspath, 'csspath': csspath})


@login_required
def configfile(request, configid):

    if '.js' not in configid:
        return HttpResponseNotFound
    else:
        chartid = int(configid[:configid.find('.js')])
        chartobj = Chart.objects.get(pk=chartid)

        configdict = json.loads(chartobj.config)
        configdict['title'] = chartobj.name
        configdict['chart-type'] = chartobj.type
        configdict['internalNotes'] = chartobj.notes
        configdict['slug'] = chartobj.slug
        configdict['data-entry-url'] = chartobj.origin_url
        configdict['published'] = chartobj.published

        config = 'App.loadChart(' + json.dumps(configdict) + ')'

        return HttpResponse(config, content_type="text/plain")


@login_required
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

    varids = sorted(varids)

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
        varobj = DataValue.objects.filter(fk_var_id_id=each).select_related('fk_ent_id').order_by('year')

        varstring += str(each)
        for row in varobj:
            varstring += ';' + str(row.year) + ',' + str(row.fk_ent_id.pk) + ',' + str(row.value)
            if not entitykey.get(str(row.fk_ent_id.pk), 0):
                entitykey[str(row.fk_ent_id.pk)] = {'name': row.fk_ent_id.name, 'code': row.fk_ent_id.code}
        varstring += "\r\n"

    return HttpResponse(json.dumps(meta) + varstring + json.dumps(entitykey), content_type="text/plain")