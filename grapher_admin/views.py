import copy
import datetime
import json
import os
import re
import csv
import glob
import os
import CloudFlare
from io import StringIO
from urllib.parse import urlparse
from django.conf import settings
from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.contrib.auth.views import login as loginview
from django.db.models import Q
from django.db import connection
from django.db import transaction
from django.http import HttpRequest, HttpResponseRedirect, HttpResponse, HttpResponseNotFound, JsonResponse, QueryDict, StreamingHttpResponse
from django.template.response import TemplateResponse
from django.shortcuts import render
from django.urls import reverse
from django.utils import timezone
from django.utils.crypto import get_random_string
from .forms import InviteUserForm, InvitedUserRegisterForm
from .models import Chart, Variable, User, UserInvitation, Logo, ChartSlugRedirect, ChartDimension, Dataset, Setting, DatasetCategory, DatasetSubcategory, Entity, Source, VariableType, DataValue, License
from owid_grapher.views import get_query_string, get_query_as_dict
from typing import Dict, Union


def custom_login(request: HttpRequest):
    """
    Redirects to index page if the user is already logged in
    :param request: Request object
    :return: Redirects to index page if the user is logged in, otherwise will show the login page
    """
    if request.user.is_authenticated():
        return HttpResponseRedirect(settings.BASE_URL)
    else:
        return loginview(request)


@login_required
def listcharts(request: HttpRequest):
    charts = Chart.objects.all().order_by('-last_edited_at')
    allvariables = Variable.objects.all()
    vardict = {}
    for var in allvariables:
        vardict[var.pk] = {'id': var.pk, 'name': var.name}
    chartlist = []
    for chart in charts:
        each = {}
        each['id'] = chart.pk
        each['published'] = chart.published
        each['starred'] = chart.starred
        each['name'] = chart.name
        each['type'] = chart.show_type()
        each['slug'] = chart.slug
        each['notes'] = chart.notes
        each['origin_url'] = chart.origin_url
        each['last_edited_at'] = chart.last_edited_at
        if chart.last_edited_by:
            each['last_edited_by'] = chart.last_edited_by.name
        else:
            each['last_edited_by'] = None
        each['variables'] = []
        configfile = json.loads(chart.config)
        for chartvar in configfile['chart-dimensions']:
            if vardict.get(int(chartvar['variableId']), 0):
                each['variables'].append(vardict[int(chartvar['variableId'])])
        chartlist.append(each)
    if '.json' in urlparse(request.get_full_path()).path:
        return JsonResponse(chartlist, safe=False)
    else:
        return render(request, 'admin.charts.html', context={'current_user': request.user.name,
                                                             'charts': chartlist,
                                                             })


@login_required
def storechart(request: HttpRequest):
    if request.method == 'POST':
        chart = Chart()
        data = json.loads(request.body.decode('utf-8'))
        return savechart(chart, data, request.user)
    else:
        return HttpResponseRedirect(reverse('listcharts'))


@login_required
def createchart(request: HttpRequest):

    data = editor_data()
    logos = []
    for each in list(Logo.objects.filter(name='OWD')):
        logos.append(each.svg)

    chartconfig = {}
    chartconfig['logosSVG'] = logos
    chartconfig_str = json.dumps(chartconfig)

    if '.json' in urlparse(request.get_full_path()).path:
        return JsonResponse({'data': data, 'config': chartconfig_str}, safe=False)
    else:
        return render(request, 'admin.edit_chart.html', context={'current_user': request.user.name,
                                                                 'data': data, 'chartconfig': chartconfig_str,
                                                                 })


def editor_data():
    data = {}
    data['logos'] = []

    logos = Logo.objects.all()
    for each in logos:
        data['logos'].append(each.name)

    variable_query = Variable.objects.all().select_related()
    query_result = []
    for each in variable_query:
        query_result.append({'name': each.name, 'id': each.pk, 'unit': each.unit, 'description': each.description,
                       'dataset': each.fk_dst_id.name, 'category': each.fk_dst_id.fk_dst_cat_id.name,
                       'subcategory': each.fk_dst_id.fk_dst_subcat_id.name, 'namespace': each.fk_dst_id.namespace})
    optgroups = {}

    for result in query_result:
        if not optgroups.get(result['subcategory'], 0):
            optgroup = {}
            optgroup['name'] = result['subcategory']
            optgroup['namespace'] = result['namespace']
            optgroup['variables'] = []
            optgroups[result['subcategory']] = optgroup

        newresult = copy.deepcopy(result)
        if result['name'] != result['dataset']:
            newresult['name'] = result['dataset'] + ' - ' + result['name']

        optgroups[newresult['subcategory']]['variables'].append(newresult)

    namespaces = Dataset.objects.values('namespace').distinct()

    data['namespaces'] = namespaces
    data['optgroups'] = optgroups
    return data


@login_required
def editchart(request: HttpRequest, chartid: Union[str, int]):
    try:
        chartid = int(chartid)
    except ValueError:
        return HttpResponseNotFound('Invalid chart id!')

    try:
        chart = Chart.objects.get(pk=chartid)
    except Chart.DoesNotExist:
        return HttpResponseNotFound('Invalid chart id!')

    data = editor_data()
    chartconfig = json.dumps(chart.get_config())

    if '.json' in urlparse(request.get_full_path()).path:
        return JsonResponse({'data': data, 'config': chartconfig}, safe=False)
    else:
        return render(request, 'admin.edit_chart.html', context={'current_user': request.user.name,
                                                                 'data': data, 'chartconfig': chartconfig})


def savechart(chart: Chart, data: Dict, user: User):
    isExisting = chart.id != None

    if data.get('published'):
        if ChartSlugRedirect.objects.filter(~Q(chart_id=chart.pk)).filter(Q(slug=data['slug'])):
            return HttpResponse("This chart slug was previously used by another chart: %s" % data["slug"], status=402)
        elif Chart.objects.filter(~Q(pk=chart.pk)).filter(Q(slug=data['slug'])):
            return HttpResponse("This chart slug is currently in use by another chart: %s" % data["slug"], status=402)
        elif chart.published and chart.slug and chart.slug != data['slug']:
            # Changing the slug of an already published chart-- create a redirect
            try:
                old_chart_redirect = ChartSlugRedirect.objects.get(slug=chart.slug)
                old_chart_redirect.chart_id = chart.pk
                old_chart_redirect.save()
            except ChartSlugRedirect.DoesNotExist:
                new_chart_redirect = ChartSlugRedirect()
                new_chart_redirect.chart_id = chart.pk
                new_chart_redirect.slug = chart.slug
                new_chart_redirect.save()

    chart.name = data["title"]
    data.pop("title", None)

    chart.type = data["chart-type"]
    data.pop("chart-type", None)

    chart.notes = data["internalNotes"]
    data.pop("internalNotes", None)

    chart.slug = data["slug"]
    data.pop("slug", None)

    if data["published"]:
        chart.published = data["published"]
    data.pop("published", None)

    data.pop("logosSVG", None)

    dims = []
    i = 0

    chart.config = json.dumps(data)
    chart.last_edited_by = user
    chart.save()

    for dim in data["chart-dimensions"]:
        newdim = ChartDimension()
        newdim.order = i
        newdim.chartId = chart
        newdim.color = dim.get('color', "")
        newdim.tolerance = dim.get('tolerance', None)
        newdim.targetyear = dim.get('targetYear', None)
        newdim.displayname = dim.get('displayName', "")
        newdim.unit = dim.get('unit', None)
        newdim.property = dim.get('property', None)
        newdim.variableId = Variable.objects.get(pk=int(dim.get('variableId', None)))
        dims.append(newdim)
        i += 1

    for each in ChartDimension.objects.filter(chartId=chart.pk):
        each.delete()
    for each in dims:
        each.save()

    # Remove any old image exports as they will no longer represent the new chart state
    if isExisting:
        for path in glob.glob(os.path.join(settings.BASE_DIR, "public/exports/", chart.slug, "*")):
            os.remove(path)

    # Purge the Cloudflare cache for the chart config url
    # Also purge the html for some common query string urls to update the meta tags
    # TODO: a job queue / coverage of more urls with query strings
    if settings.CLOUDFLARE_KEY:
        config_url = f"{settings.CLOUDFLARE_BASE_URL}/config/{chart.id}.js"
        chart_url = f"{settings.CLOUDFLARE_BASE_URL}/{chart.slug}"
        urls_to_purge = [config_url, chart_url, chart_url + "?tab=chart", chart_url + "?tab=map"]
        cf = CloudFlare.CloudFlare(email=settings.CLOUDFLARE_EMAIL, token=settings.CLOUDFLARE_KEY)
        cf.zones.purge_cache.delete(settings.CLOUDFLARE_ZONE_ID, data={ "files": urls_to_purge })

    return JsonResponse({'success': True, 'data': {'id': chart.pk}}, safe=False)


@login_required
def managechart(request: HttpRequest, chartid: str):
    try:
        chart = Chart.objects.get(pk=int(chartid))
    except Chart.DoesNotExist:
        return HttpResponseNotFound('No such chart!')
    except ValueError:
        return HttpResponseNotFound('No such chart!')
    if request.method == 'PUT':
        data = json.loads(request.body.decode('utf-8'))
        return savechart(chart, data, request.user)
    if request.method == 'POST':
        data = QueryDict(request.body.decode('utf-8'))
        if data.get('_method', '0') == 'DELETE':
            chart.delete()
            messages.success(request, 'Chart deleted successfully')
        return HttpResponseRedirect(reverse('listcharts'))
    if request.method == 'GET':
        return HttpResponseRedirect(reverse('showchartinternal', args=(chartid,)))


@login_required
def showchart(request: HttpRequest, chartid: str):
    try:
        chart = Chart.objects.get(pk=int(chartid))
    except Chart.DoesNotExist:
        return HttpResponseNotFound('No such chart!')
    except ValueError:
        return HttpResponseNotFound('No such chart!')
    if request.method != 'GET':
        return JsonResponse(chart.get_config(), safe=False)
    else:
        # this part was lifted directly from the public facing side
        # so if anything changes there, be sure to make the same changes here
        configfile = chart.get_config()
        canonicalurl = request.build_absolute_uri('/') + chart.slug
        baseurl = request.build_absolute_uri('/') + chart.slug

        chartmeta = {}

        title = configfile['title']
        title = re.sub("/, \*time\*/", " over time", title)
        title = re.sub("/\*time\*/", "over time", title)
        chartmeta['title'] = title
        if configfile.get('subtitle', ''):
            chartmeta['description'] = configfile['subtitle']
        else:
            chartmeta['description'] = 'An interactive visualization from Our World In Data.'
        query_string = get_query_string(request)
        if query_string:
            canonicalurl += '?' + query_string
        chartmeta['canonicalUrl'] = canonicalurl
        if query_string:
            imagequery = query_string + '&' + "size=1200x800&v=" + chart.make_cache_tag()
        else:
            imagequery = "size=1200x800&v=" + chart.make_cache_tag()

        chartmeta['imageUrl'] = baseurl + '.png?' + imagequery

        configpath = "%s/config/%s.js" % (settings.BASE_URL, chart.pk)

        response = TemplateResponse(request, 'show_chart.html',
                                    context={'chartmeta': chartmeta, 'configpath': configpath,
                                             'query': query_string
                                             })
        return response


@login_required
def starchart(request: HttpRequest, chartid: str):
    try:
        chart = Chart.objects.get(pk=int(chartid))
    except Chart.DoesNotExist:
        return HttpResponseNotFound('No such chart!')
    except ValueError:
        return HttpResponseNotFound('No such chart!')
    if request.method == 'POST':
        chart.starred = True
        chart.save()
        return JsonResponse({'starred': True}, safe=False)


@login_required
def unstarchart(request: HttpRequest, chartid: str):
    try:
        chart = Chart.objects.get(pk=int(chartid))
    except Chart.DoesNotExist:
        return HttpResponseNotFound('No such chart!')
    except ValueError:
        return HttpResponseNotFound('No such chart!')
    if request.method == 'POST':
        chart.starred = False
        chart.save()
        return JsonResponse({'starred': False}, safe=False)


@login_required
def importdata(request: HttpRequest):
    datasets = Dataset.objects.filter(namespace='owid').order_by('name').values()
    datasetlist = []
    for each in datasets:
        each['fk_dst_subcat_id'] = each['fk_dst_subcat_id_id'] # XXX
        each['created_at'] = str(each['created_at'])
        each['updated_at'] = str(each['updated_at'])
        datasetlist.append(each)

    vartypes = Variable.objects.values()
    vartypeslist = []
    for each in vartypes:
        each['created_at'] = str(each['created_at'])
        each['updated_at'] = str(each['updated_at'])
        each['uploaded_at'] = str(each['uploaded_at'])
        vartypeslist.append(each)

    source_template = dict(Setting.objects.filter(meta_name='sourceTemplate').values().first())
    source_template['created_at'] = str(source_template['created_at'])
    source_template['updated_at'] = str(source_template['updated_at'])

    categories = DatasetSubcategory.objects.all().select_related().order_by('fk_dst_cat_id__pk').order_by('pk')
    category_list = []
    for each in categories:
        category_list.append({'name': each.name, 'id': each.pk, 'parent': each.fk_dst_cat_id.name})
    entitynames = Entity.objects.all()
    entitynameslist = []
    entitycodeslist = []
    for each in entitynames:
        entitynameslist.append(each.name)
        entitycodeslist.append(each.code)
    all_entitynames = entitynameslist + entitycodeslist

    data = {'datasets': datasetlist, 'categories': category_list, 'varTypes': vartypeslist, 'sourceTemplate': source_template,
            'entityNames': all_entitynames}

    if '.json' in urlparse(request.get_full_path()).path:
        return JsonResponse(data, safe=False)
    else:
        return render(request, 'admin.importer.html', context={'current_user': request.user.name,
                                                               'importerdata': json.dumps(data)})


@login_required
def store_import_data(request: HttpRequest):
    if request.method == 'POST':
        try:
            with transaction.atomic():
                data = json.loads(request.body.decode('utf-8'))

                datasetmeta = data['dataset']
                entities = data['entities']
                entitynames = data['entityNames']
                years = data['years']
                variables = data['variables']

                datasetprops = {'name': datasetmeta['name'],
                                'description': datasetmeta['description'],
                                'fk_dst_cat_id': DatasetSubcategory.objects.get(pk=datasetmeta['subcategoryId']).fk_dst_cat_id,
                                'fk_dst_subcat_id': DatasetSubcategory.objects.get(pk=datasetmeta['subcategoryId'])
                                }

                if datasetmeta['id']:
                    dataset = Dataset.objects.get(pk=datasetmeta['id'])
                    Dataset.objects.filter(pk=datasetmeta['id']).update(updated_at=timezone.now(), **datasetprops)
                else:
                    dataset = Dataset(**datasetprops)
                    dataset.save()

                dataset_id = dataset.pk

                codes = Entity.objects.filter(validated=True).values('name', 'code')

                codes_dict = {}

                for each in codes:
                    codes_dict[each['code']] = each['name']

                entitynames_list = Entity.objects.values_list('name', flat=True)

                for i in range(0, len(entitynames)):
                    name = entitynames[i]
                    if codes_dict.get(name, 0):
                        entitynames[i] = codes_dict[name]

                entitynames_to_insert = []

                for each in entitynames:
                    if each not in entitynames_list:
                        entitynames_to_insert.append(each)

                alist = [Entity(name=val, validated=False) for val in entitynames_to_insert]

                Entity.objects.bulk_create(alist)

                codes = Entity.objects.values('name', 'id')

                entitiy_name_to_id = {}

                for each in codes:
                    entitiy_name_to_id[each['name']] = each['id']

                source_ids_by_name: Dict[str, str] = {}

                for variable in variables:
                    source_name = variable['source']['name']
                    if source_ids_by_name.get(source_name, 0):
                        source_id = source_ids_by_name[source_name]
                    else:
                        if variable['source']['id']:
                            source_id = variable['source']['id']
                        else:
                            source_id = None
                        source_desc = variable['source']['description']
                        if source_id:
                            Source.objects.filter(pk=source_id).update(updated_at=timezone.now(), **variable['source'])
                        else:
                            new_source = Source(datasetId=dataset_id, name=source_name, description=source_desc)
                            new_source.save()
                            source_id = new_source.pk
                            source_ids_by_name[source_name] = source_id

                    values = variable['values']
                    variableprops = {'name': variable['name'], 'description': variable['description'], 'unit': variable['unit'],
                                     'coverage': variable['coverage'], 'timespan': variable['timespan'],
                                     'fk_var_type_id': VariableType.objects.get(pk=3),
                                     'fk_dst_id': Dataset.objects.get(pk=dataset_id),
                                     'sourceId': Source.objects.get(pk=source_id),
                                     'uploaded_at': timezone.now(),
                                     'updated_at': timezone.now(),
                                     'uploaded_by': request.user
                                     }
                    if variable['overwriteId']:
                        Variable.objects.filter(pk=variable['overwriteId']).update(**variableprops)
                        varid = variable['overwriteId']
                    else:
                        varid = Variable(**variableprops)
                        varid.save()
                        varid = varid.pk
                    DataValue.objects.filter(fk_var_id=Variable.objects.get(pk=varid)).delete()

                    newdatavalues = []

                    for i in range(0, len(years)):
                        if values[i] == '':
                            continue

                        newdatavalues.append(DataValue(fk_var_id=Variable.objects.get(pk=varid),
                                                       fk_ent_id=Entity.objects.get(pk=entitiy_name_to_id[entitynames[entities[i]]]),
                                                       year=years[i],
                                                       value=values[i]))

                        if len(newdatavalues) > 10000:
                            DataValue.objects.bulk_create(newdatavalues)
                            newdatavalues = []

                    if len(newdatavalues) > 0:
                        DataValue.objects.bulk_create(newdatavalues)
                    with connection.cursor() as cursor:
                        cursor.execute("DELETE FROM sources WHERE sources.id NOT IN (SELECT variables.sourceId FROM variables)")

                return JsonResponse({'datasetId': dataset_id}, safe=False)
        except Exception as e:
            if len(e.args) > 1:
                error_m = str(e.args[0]) + ' ' + str(e.args[1])
            else:
                error_m = e.args[0]
            return HttpResponse(error_m, status=500)




@login_required
def listdatasets(request: HttpRequest):
    variables = Variable.objects.filter(fk_dst_id__namespace='owid').select_related('fk_dst_id').order_by('-fk_dst_id__updated_at')
    datasets: Dict = {}
    for each in variables:
        if each.uploaded_by:
            uploaded_by = each.uploaded_by.name
        else:
            uploaded_by = None
        if datasets.get(each.fk_dst_id.pk, 0):
            datasets[each.fk_dst_id.pk]['variables'].append({'name': each.name, 'id': each.pk,
                                                             'uploaded_at': str(each.uploaded_at),
                                                             'uploaded_by': uploaded_by})
        else:
            datasets[each.fk_dst_id.pk] = {'name': each.fk_dst_id.name, 'id': each.fk_dst_id.pk, 'variables': [{'name': each.name,
                                                                                       'id': each.pk,
                                                                                       'uploaded_at': str(
                                                                                           each.uploaded_at),
                                                                                       'uploaded_by': uploaded_by
                                                                                       }]}
    dataset_list = []
    for value in sorted(datasets.keys(), reverse=True):
        dataset_list.append(datasets[value])
    return render(request, 'admin.datasets.html', context={'current_user': request.user.name,
                                                           'datasets': dataset_list})


@login_required
def showdataset(request: HttpRequest, datasetid: str):
    try:
        dataset = Dataset.objects.get(pk=int(datasetid))
    except Dataset.DoesNotExist:
        return HttpResponseNotFound('Dataset does not exist!')

    dataset_dict = {'id': dataset.pk, 'name': dataset.name, 'category': dataset.fk_dst_cat_id.name,
                    'subcategory': dataset.fk_dst_subcat_id.name,
                    'description': dataset.description}

    dataset_vars = Variable.objects.filter(fk_dst_id=dataset)
    dataset_chartdims = ChartDimension.objects.filter(variableId__in=dataset_vars)
    dataset_chart_ids = []
    for each in dataset_chartdims:
        dataset_chart_ids.append(each.chartId.pk)
    dataset_charts = Chart.objects.filter(pk__in=dataset_chart_ids).values()
    return render(request, 'admin.datasets.show.html', context={'current_user': request.user.name,
                                                                'dataset': dataset_dict,
                                                                'variables': dataset_vars.values(),
                                                                'charts': dataset_charts,
                                                                })


@login_required
def editdataset(request: HttpRequest, datasetid: str):
    try:
        dataset = Dataset.objects.filter(pk=int(datasetid)).values()[0]
    except Dataset.DoesNotExist:
        return HttpResponseNotFound('Dataset does not exist!')

    sources_list = []
    sources = Source.objects.all().values('pk', 'name')
    for each in sources:
        sources_list.append({'id': int(each['pk']), 'name': each['name']})
    cats_list = []
    categories = DatasetCategory.objects.values('pk', 'name')
    for each in categories:
        cats_list.append({'id': int(each['pk']), 'name': each['name']})
    subcats_list = []
    subcategories = DatasetSubcategory.objects.values('pk', 'name')
    for each in subcategories:
        subcats_list.append({'id': int(each['pk']), 'name': each['name']})
    return render(request, 'admin.datasets.edit.html', context={'current_user': request.user.name,
                                                                'dataset': dataset,
                                                                'sources': sources_list,
                                                                'categories': cats_list,
                                                                'subcategories': subcats_list,
                                                                })


@login_required
def managedataset(request: HttpRequest, datasetid: str):
    try:
        dataset = Dataset.objects.filter(pk=int(datasetid))
    except Dataset.DoesNotExist:
        return HttpResponseNotFound('Dataset does not exist!')

    if request.method == 'POST':
        request_dict = QueryDict(request.body.decode('utf-8')).dict()
        if request_dict['_method'] == 'DELETE':
            try:
                dataset.delete()
            except Exception as e:
                if e.args[0] == 1451:
                    messages.error(request, 'Dataset cannot be deleted while a chart still needs it. Delete charts or change their variables first.')
                    return HttpResponseRedirect(reverse('showdataset', args=[datasetid]))
                else:
                    messages.error(request, e.args[1])
                    return HttpResponseRedirect(reverse('showdataset', args=[datasetid]))
            messages.success(request, 'Dataset deleted.')
            return HttpResponseRedirect(reverse('listdatasets'))
        if request_dict['_method'] == 'PATCH':
            request_dict.pop('_method', None)
            request_dict.pop('csrfmiddlewaretoken', None)
            request_dict['fk_dst_cat_id'] = DatasetCategory.objects.get(pk=request_dict['fk_dst_cat_id'])
            request_dict['fk_dst_subcat_id'] = DatasetSubcategory.objects.get(pk=request_dict['fk_dst_subcat_id'])
            Dataset.objects.filter(pk=datasetid).update(updated_at=timezone.now(), **request_dict)
            messages.success(request, 'Dataset updated!')
            return HttpResponseRedirect(reverse('showdataset', args=[datasetid]))

    if request.method == 'GET':
        return HttpResponseRedirect(reverse('showdataset', args=[datasetid]))


@login_required
def dataset_csv(request: HttpRequest, datasetid: str):
    try:
        dataset = Dataset.objects.get(pk=int(datasetid))
    except Dataset.DoesNotExist:
        return HttpResponseNotFound('Dataset does not exist!')

    allvariables = Variable.objects.all()
    allvardict = {}
    chartvarlist = []

    for var in allvariables:
        allvardict[var.pk] = {'id': var.pk, 'name': var.name}
        if var.fk_dst_id == dataset:
            chartvarlist.append({'id': var.pk, 'name': var.name})

    chartvarlist = sorted(chartvarlist, key=lambda k: k['id'])

    sql_query = 'SELECT maintable.entity as entity, maintable.year as year'

    table_counter = 1
    join_string = ''
    id_tuple = ''
    headerlist = ['Entity', 'Year']
    for each in chartvarlist:
        sql_query += ', table%s.value as value%s' % (table_counter, table_counter)

        join_string += 'LEFT JOIN (SELECT * FROM data_values WHERE fk_var_id = %s) as table%s on ' \
                       'maintable.`fk_ent_id` = table%s.`fk_ent_id` and ' \
                       'maintable.year = table%s.year ' % (each['id'], table_counter, table_counter,
                                                           table_counter)

        table_counter += 1
        id_tuple += str(each['id']) + ','
        headerlist.append(each['name'])

    id_tuple = id_tuple[:-1]
    sql_query += ' FROM (SELECT fk_ent_id, entities.name as entity, year FROM data_values ' \
                 'LEFT OUTER JOIN entities on data_values.fk_ent_id = entities.id ' \
                 'WHERE fk_var_id in (%s) ORDER BY entity, year, data_values.fk_var_id) as maintable ' % id_tuple

    sql_query += join_string + 'GROUP BY entity, year;'

    with connection.cursor() as cursor:
        cursor.execute(sql_query)
        rows = cursor.fetchall()

    def stream():
        buffer_ = StringIO()
        writer = csv.writer(buffer_)
        writer.writerow(headerlist)
        for row in rows:
            writer.writerow(row)
            buffer_.seek(0)
            data = buffer_.read()
            buffer_.seek(0)
            buffer_.truncate()
            yield data

    response = StreamingHttpResponse(
        stream(), content_type='text/csv'
    )
    disposition = "attachment; filename=%s.csv" % dataset.name
    response['Content-Disposition'] = disposition
    return response


@login_required
def dataset_json(request: HttpRequest, datasetid: str):
    try:
        dataset = Dataset.objects.get(pk=int(datasetid))
    except Dataset.DoesNotExist:
        return HttpResponseNotFound('Dataset does not exist!')

    data = {'name': dataset.name, 'description': dataset.description, 'categoryId': dataset.fk_dst_cat_id.pk,
            'subcategoryId': dataset.fk_dst_subcat_id.pk, 'variables': []}

    allchart_dimensions = ChartDimension.objects.all().values('chartId', 'variableId')
    var_to_chart = {}
    for each in allchart_dimensions:
        if var_to_chart.get(each['variableId'], 0):
            var_to_chart[each['variableId']].append(each['chartId'])
        else:
            var_to_chart[each['variableId']] = []
            var_to_chart[each['variableId']].append(each['chartId'])

    allvariables = Variable.objects.all().select_related('sourceId')

    for var in allvariables:
        if var.fk_dst_id == dataset:

            sourcedata = {
                'id': var.sourceId.pk,
                'name': var.sourceId.name,
                'description': var.sourceId.description
            }

            chartdata = []

            for onechart in var_to_chart.get(var.pk, []):
                chart = Chart.objects.get(pk=onechart)
                chartdata.append({
                    'id': chart.pk,
                    'name': chart.name
                })

            vardata = {
                'id': var.pk,
                'name': var.name,
                'unit': var.unit,
                'description': var.description,
                'coverage': var.coverage,
                'timespan': var.timespan,
                'source': sourcedata,
                'charts': chartdata
            }

            data['variables'].append(vardata)

    return JsonResponse(data, safe=False)


def check_invitation_statuses():
    invites = UserInvitation.objects.filter(status='pending')
    for each in invites:
        if each.valid_till <= timezone.now():
            each.status = 'expired'
            each.save()


@login_required
def listcategories(request: HttpRequest):
    categories = DatasetCategory.objects.values()
    return render(request, 'admin.categories.html', context={'current_user': request.user.name,
                                                             'categories': categories
                                                             })

@login_required
def showcategory(request: HttpRequest, catid: str):
    try:
        category = DatasetCategory.objects.filter(pk=int(catid)).values()[0]
        catobj = DatasetCategory.objects.get(pk=int(catid))
    except DatasetCategory.DoesNotExist:
        return HttpResponseNotFound('Category does not exist!')

    subcategories = DatasetSubcategory.objects.filter(fk_dst_cat_id=catobj).values()

    category['subcategories'] = subcategories

    return render(request, 'admin.categories.show.html', context={'current_user': request.user.name,
                                                                  'category': category
                                                                  })


@login_required
def managecategory(request: HttpRequest, catid: str):
    try:
        category = DatasetCategory.objects.filter(pk=int(catid)).values()[0]
    except DatasetCategory.DoesNotExist:
        return HttpResponseNotFound('Category does not exist!')

    if request.method == 'POST':
        request_dict = QueryDict(request.body.decode('utf-8')).dict()
        if request_dict['_method'] == 'PATCH':
            request_dict.pop('_method', None)
            request_dict.pop('csrfmiddlewaretoken', None)
            DatasetCategory.objects.filter(pk=catid).update(updated_at=timezone.now(), **request_dict)
            messages.success(request, 'Category updated!')
            return HttpResponseRedirect(reverse('showcategory', args=[catid]))
        if request_dict['_method'] == 'DELETE':
            request_dict.pop('_method', None)
            request_dict.pop('csrfmiddlewaretoken', None)
            category = DatasetCategory.objects.get(pk=int(catid))
            subcategory = DatasetSubcategory.objects.filter(fk_dst_cat_id=category)
            try:
                for each in subcategory:
                    each.delete()
                category.delete()
            except Exception as e:
                messages.error(request, e.args[1])
                return HttpResponseRedirect(reverse('editcategory', args=[catid]))
            messages.success(request, 'Category deleted!')
            return HttpResponseRedirect(reverse('listcategories'))


@login_required
def editcategory(request: HttpRequest, catid: str):
    try:
        category = DatasetCategory.objects.filter(pk=int(catid)).values()[0]
    except DatasetCategory.DoesNotExist:
        return HttpResponseNotFound('Category does not exist!')

    return render(request, 'admin.categories.edit.html', context={'current_user': request.user.name,
                                                                  'category': category
                                                                  })


@login_required
def listvariables(request: HttpRequest):
    variables = Variable.objects.values()

    return render(request, 'admin.variables.html', context={'current_user': request.user.name,
                                                            'variables': variables
                                                            })


@login_required
def showvariable(request: HttpRequest, variableid: str):
    try:
        variable = Variable.objects.get(pk=int(variableid))
    except Variable.DoesNotExist:
        return HttpResponseNotFound('Variable does not exist!')

    items_per_page = 50

    chart_dims = list(ChartDimension.objects.filter(variableId=variable).values('chartId'))
    chart_id_list = []
    for each in chart_dims:
        chart_id_list.append(each['chartId'])
    charts = list(Chart.objects.filter(pk__in=chart_id_list).values('name', 'id'))

    variable_dict = {}
    variable_dict['name'] = variable.name
    variable_dict['id'] = variable.pk
    variable_dict['unit'] = variable.unit
    variable_dict['description'] = variable.description
    variable_dict['dataset'] = {'name': variable.fk_dst_id.name, 'id': variable.fk_dst_id.pk}
    variable_dict['source'] = {'name': variable.sourceId.name, 'id': variable.sourceId.pk}
    variable_dict['charts'] = charts

    request_dict = get_query_as_dict(request)
    if request_dict.get('search', [0])[0]:
        value_query = request_dict.get('value', [''])[0]
        year_query = request_dict.get('year', [None])[0]
        entity_query = request_dict.get('name', [''])[0]
        try:
            year_query = int(year_query)
        except ValueError:
            year_query = 0
        except TypeError:
            year_query = 0

        values = DataValue.objects.filter(fk_var_id=variable)
        if value_query:
            values = values.filter(value=value_query)
        if year_query:
            values = values.filter(year=year_query)
        if entity_query:
            values = values.filter(fk_ent_id__name=entity_query)

    else:
        values = DataValue.objects.filter(fk_var_id=variable)

    values = list(values.values('pk', 'value', 'year', 'fk_ent_id__name'))

    total_rows = len(values)
    total_pages = -(-len(values) // items_per_page)
    page_number = get_query_as_dict(request).get('page', [0])

    try:
        page_number = int(page_number[0])
    except ValueError:
        page_number = 0

    if page_number > 1:
        vals = values[(page_number - 1) * items_per_page:page_number * items_per_page]
    else:
        vals = values[:items_per_page]

    if vals:
        if total_pages >= 13:
            if page_number < 7:
                nav_pages = [1, 2, 3, 4, 5, 6, 7, 8, '#', total_pages - 1, total_pages]
            elif page_number > total_pages - 5:
                nav_pages = [1, 2, '#', total_pages - 7, total_pages - 6, total_pages - 5, total_pages - 4,
                             total_pages - 3,
                             total_pages - 2, total_pages - 1, total_pages]
            else:
                nav_pages = [1, 2, '#', page_number - 3, page_number - 2, page_number - 1, page_number,
                             page_number + 1,
                             page_number + 2, page_number + 3, '#', total_pages - 1, total_pages]
        else:
            nav_pages = [n for n in range(1, total_pages + 1)]
    else:
        nav_pages = []

    variable_dict['values'] = vals

    allentities = []
    for each in values:
        if each['fk_ent_id__name'] not in allentities:
            allentities.append(each['fk_ent_id__name'])

    request_string_for_pages = '?'
    for key, value in request_dict.items():
        if key != 'page':
            request_string_for_pages += key + '=' + value[0] + '&'

    return render(request, 'admin.variables.show.html', context={'current_user': request.user.name,
                                                                 'variable': variable_dict,
                                                                 'nav_pages': nav_pages,
                                                                 'current_page': page_number,
                                                                 'total_rows': total_rows,
                                                                 'entities': allentities,
                                                                 'page_request_string': request_string_for_pages
                                                                 })


@login_required
def editvariable(request: HttpRequest, variableid: str):
    try:
        variable = Variable.objects.get(pk=int(variableid))
    except Variable.DoesNotExist:
        return HttpResponseNotFound('Variable does not exist!')

    variable_dict = {
        'name': variable.name,
        'id': variable.pk,
        'unit': variable.unit,
        'coverage': variable.coverage,
        'timespan': variable.timespan,
        'description': variable.description,
        'source': {'id': variable.sourceId.pk, 'name': variable.sourceId.name}
    }

    return render(request, 'admin.variables.edit.html', context={'current_user': request.user.name,
                                                                 'variable': variable_dict
                                                                 })


@login_required
def managevariable(request: HttpRequest, variableid: str):
    try:
        variable = Variable.objects.get(pk=int(variableid))
    except Variable.DoesNotExist:
        return HttpResponseNotFound('Variable does not exist!')

    if request.method == 'POST':
        request_dict = QueryDict(request.body.decode('utf-8')).dict()
        if request_dict['_method'] == 'DELETE':
            try:
                variable.delete()
            except Exception as e:
                messages.error(request, e.args[1])
                return HttpResponseRedirect(reverse('showvariable', args=[variableid]))
            messages.success(request, 'Variable deleted.')
            return HttpResponseRedirect(reverse('listvariables'))
        if request_dict['_method'] == 'PATCH':
            request_dict.pop('_method', None)
            request_dict.pop('csrfmiddlewaretoken', None)
            request_dict.pop('sourceId', None)
            Variable.objects.filter(pk=int(variableid)).update(updated_at=timezone.now(), **request_dict)
            messages.success(request, 'Variable updated!')
            return HttpResponseRedirect(reverse('showvariable', args=[variableid]))

    if request.method == 'GET':
        return HttpResponseRedirect(reverse('showvariable', args=[variableid]))


@login_required
def listlicenses(request: HttpRequest):
    licenses = License.objects.values()
    return render(request, 'admin.licenses.html', context={'current_user': request.user.name,
                                                           'licenses': licenses
                                                           })


@login_required
def showlicense(request: HttpRequest, licenseid: str):
    try:
        license = License.objects.get(pk=int(licenseid))
    except License.DoesNotExist:
        return HttpResponseNotFound('License does not exist!')

    return render(request, 'admin.licenses.show.html', context={'current_user': request.user.name,
                                                                'license': license
                                                                })


@login_required
def editlicense(request: HttpRequest, licenseid: str):
    try:
        license = License.objects.get(pk=int(licenseid))
    except License.DoesNotExist:
        return HttpResponseNotFound('License does not exist!')

    license = {
        'id': license.pk,
        'name': license.name,
        'description': license.description
    }

    return render(request, 'admin.licenses.edit.html', context={'current_user': request.user.name,
                                                                'license': license
                                                                })


@login_required
def managelicense(request: HttpRequest, licenseid: str):
    try:
        license = License.objects.get(pk=int(licenseid))
    except License.DoesNotExist:
        return HttpResponseNotFound('License does not exist!')

    if request.method == 'POST':
        request_dict = QueryDict(request.body.decode('utf-8')).dict()
        if request_dict['_method'] == 'PATCH':
            request_dict.pop('_method', None)
            request_dict.pop('csrfmiddlewaretoken', None)
            License.objects.filter(pk=int(licenseid)).update(updated_at=timezone.now(), **request_dict)
            messages.success(request, 'License updated!')
            return HttpResponseRedirect(reverse('showlicense', args=[licenseid]))

    if request.method == 'GET':
        return HttpResponseRedirect(reverse('showlicense', args=[licenseid]))


@login_required
def listlogos(request: HttpRequest):
    logos = Logo.objects.values()
    return render(request, 'admin.logos.html', context={'current_user': request.user.name,
                                                        'logos': logos
                                                        })


@login_required
def createlogo(request: HttpRequest):
    return render(request, 'admin.logos.create.html', context={'current_user': request.user.name})


@login_required
def storelogo(request: HttpRequest):

    if request.method == 'POST':
        if not request.POST.get('name', 0):
            messages.error(request, 'Name field should not be empty.')
        if not request.FILES.get('image', 0):
            messages.error(request, 'Image field should not be empty.')
        if messages.get_messages(request):
            return HttpResponseRedirect(reverse('createlogo'))
        svg = request.FILES['image'].read()
        logo = Logo(name=request.POST['name'], svg=svg)
        logo.save()
        messages.success(request, 'Logo created!')
        return HttpResponseRedirect(reverse('listlogos'))

    if request.method == 'GET':
        return HttpResponseRedirect(reverse('listlogos'))


@login_required
def showlogo(request: HttpRequest, logoid: str):
    try:
        logo = Logo.objects.get(pk=int(logoid))
    except Logo.DoesNotExist:
        return HttpResponseNotFound('Logo does not exist!')

    logo = {
        'id': logo.pk,
        'name': logo.name,
        'svg': logo.svg
    }

    return render(request, 'admin.logos.show.html', context={'current_user': request.user.name,
                                                             'logo': logo})


@login_required
def editlogo(request: HttpRequest, logoid: str):
    try:
        logo = Logo.objects.get(pk=int(logoid))
    except Logo.DoesNotExist:
        return HttpResponseNotFound('Logo does not exist!')

    logo = {
        'id': logo.pk,
        'name': logo.name
    }

    return render(request, 'admin.logos.edit.html', context={'current_user': request.user.name,
                                                             'logo': logo})


@login_required
def managelogo(request: HttpRequest, logoid: str):
    try:
        logo = Logo.objects.get(pk=int(logoid))
    except Logo.DoesNotExist:
        return HttpResponseNotFound('Logo does not exist!')

    if request.method == 'POST':
        if request.POST.get('_method', '') == 'PATCH':
            image_no_change = 0
            if not request.POST.get('name', 0):
                messages.error(request, 'Name field should not be empty.')
            if not request.FILES.get('image', 0):
                image_no_change = 1
            if messages.get_messages(request):
                return HttpResponseRedirect(reverse('editlogo', args=[logoid]))
            if not image_no_change:
                svg = request.FILES['image'].read()
                logo.name = request.POST['name']
                logo.svg = svg
            else:
                logo.name = request.POST['name']
            logo.save()
            messages.success(request, 'Logo updated!')
            return HttpResponseRedirect(reverse('showlogo', args=[logoid]))
        if request.POST.get('_method', '') == 'DELETE':
            logo.delete()
            messages.success(request, 'Logo deleted!')
            return HttpResponseRedirect(reverse('listlogos'))

    if request.method == 'GET':
        return HttpResponseRedirect(reverse('showlogo', args=[logoid]))


@login_required
def listsources(request: HttpRequest):

    datasets = Dataset.objects.all()
    variables = Variable.objects.all()
    sources = Source.objects.all().order_by('name')

    source_var_dict: Dict = {}
    dataset_dict: Dict = {}

    for each in datasets:
        dataset_dict[each.pk] = {'id': each.pk, 'name': each.name}

    for each in variables:
        if not source_var_dict.get(each.sourceId.pk, 0):
            source_var_dict[each.sourceId.pk] = []
            source_var_dict[each.sourceId.pk].append({
            'id': each.pk,
            'name': each.name
            })
        else:
            source_var_dict[each.sourceId.pk].append({
            'id': each.pk,
            'name': each.name
            })

    sources_list = []

    for each in sources:
        sources_list.append({'id': each.pk, 'name': each.name,
                             'dataset': dataset_dict.get(each.datasetId, None),
                             'variables': source_var_dict.get(each.pk, [])})

    return render(request, 'admin.sources.html', context={'current_user': request.user.name,
                                                          'sources': sources_list})


@login_required
def showsource(request: HttpRequest, sourceid: str):
    try:
        source = Source.objects.get(pk=int(sourceid))
    except Source.DoesNotExist:
        return HttpResponseNotFound('Source does not exist!')

    source = {'id': source.pk, 'name': source.name, 'description': source.description}

    try:
        dataset = Dataset.objects.get(pk=source['id'])
        source['dataset'] = {'id': dataset.pk, 'name': dataset.name}
    except:
        source['dataset'] = None

    variables = Variable.objects.filter(sourceId__pk=source['id']).values()

    source['variables'] = variables

    return render(request, 'admin.sources.show.html', context={'current_user': request.user.name,
                                                               'source': source})


@login_required
def editsource(request: HttpRequest, sourceid: str):
    try:
        source = Source.objects.get(pk=int(sourceid))
    except Source.DoesNotExist:
        return HttpResponseNotFound('Source does not exist!')

    source = {
        'id': source.pk,
        'name': source.name,
        'description': source.description
    }

    return render(request, 'admin.sources.edit.html', context={'current_user': request.user.name,
                                                               'source': source})


@login_required
def managesource(request: HttpRequest, sourceid: str):
    try:
        source = Source.objects.get(pk=int(sourceid))
    except Source.DoesNotExist:
        return HttpResponseNotFound('Source does not exist!')

    if request.method == 'POST':
        request_dict = QueryDict(request.body.decode('utf-8')).dict()
        if request_dict['_method'] == 'PATCH':
            request_dict.pop('_method', None)
            request_dict.pop('csrfmiddlewaretoken', None)
            try:
                Source.objects.filter(pk=int(sourceid)).update(updated_at=timezone.now(), **request_dict)
            except Exception as e:
                messages.error(request, e.args[1])
                return HttpResponseRedirect(reverse('showsource', args=[sourceid]))
            messages.success(request, 'Source updated!')
            return HttpResponseRedirect(reverse('showsource', args=[sourceid]))

    if request.method == 'GET':
        return HttpResponseRedirect(reverse('showsource', args=[sourceid]))


@login_required
def editsourcetemplate(request: HttpRequest):
    sourcetemplate = Setting.objects.filter(meta_name='sourceTemplate').first()

    if request.method == 'GET':

        sourcetemplate = {'meta_value': sourcetemplate.meta_value}

        return render(request, 'admin.sourcetemplate.edit.html', context={'current_user': request.user.name,
                                                                          'sourcetemplate': sourcetemplate})
    if request.method == 'POST':
        if not request.POST.get('source_template', 0):
            messages.error(request, 'Source template field should not be empty.')
            return render(request, 'admin.sourcetemplate.edit.html', context={'current_user': request.user.name,
                                                                              'sourcetemplate': sourcetemplate})
        else:
            sourcetemplate.meta_value = request.POST['source_template']
            sourcetemplate.save()
            messages.success(request, 'Source template updated.')
            return render(request, 'admin.sourcetemplate.edit.html', context={'current_user': request.user.name,
                                                                              'sourcetemplate': sourcetemplate})


@login_required
def editsubcategory(request: HttpRequest, subcatid: str):
    try:
        subcat = DatasetSubcategory.objects.get(pk=int(subcatid))
    except DatasetSubcategory.DoesNotExist:
        return HttpResponseNotFound('Subcategory does not exist!')

    subcategory = {'id': subcat.pk, 'name': subcat.name, 'category': subcat.fk_dst_cat_id.pk}
    categories = DatasetCategory.objects.values()
    category = {'id': subcat.fk_dst_cat_id.pk}

    return render(request, 'admin.subcategories.edit.html', context={'current_user': request.user.name,
                                                                     'subcategory': subcategory,
                                                                     'categories': categories,
                                                                     'category': category})


@login_required
def managesubcategory(request: HttpRequest, subcatid: str):
    try:
        subcat = DatasetSubcategory.objects.get(pk=int(subcatid))
    except DatasetSubcategory.DoesNotExist:
        return HttpResponseNotFound('Subcategory does not exist!')

    parent_cat = subcat.fk_dst_cat_id.pk

    if request.method == 'POST':
        request_dict = QueryDict(request.body.decode('utf-8')).dict()
        if request_dict['_method'] == 'DELETE':
            try:
                subcat.delete()
            except Exception as e:
                messages.error(request, e.args[1])
                return HttpResponseRedirect(reverse('editsubcategory', args=[subcatid]))
            messages.success(request, 'Subcategory deleted.')
            return HttpResponseRedirect(reverse('showcategory', args=[parent_cat]))
        if request_dict['_method'] == 'PATCH':
            request_dict.pop('_method', None)
            request_dict.pop('csrfmiddlewaretoken', None)
            try:
                DatasetSubcategory.objects.filter(pk=int(subcatid)).update(updated_at=timezone.now(), **request_dict)
            except Exception as e:
                messages.error(request, e.args[1])
                return HttpResponseRedirect(reverse('editsubcategory', args=[subcatid]))
            messages.success(request, 'Subcategory updated!')
            return HttpResponseRedirect(reverse('showcategory', args=[parent_cat]))


@login_required
def createsubcategory(request: HttpRequest):
    categories = DatasetCategory.objects.values()
    return render(request, 'admin.subcategories.create.html',context={'current_user': request.user.name,
                                                                      'categories': categories
                                                                      })


@login_required
def storesubcategory(request: HttpRequest):
    categories = DatasetCategory.objects.values()
    if request.method == 'POST':
        if not request.POST.get('name', 0):
            messages.error(request, 'Name field should not be empty.')
        if messages.get_messages(request):
            return render(request, 'admin.subcategories.create.html',
                          context={'current_user': request.user.name,
                                   'categories': categories})
        subcat = DatasetSubcategory()
        subcat.name = request.POST['name']
        subcat.fk_dst_cat_id = DatasetCategory.objects.get(pk=int(request.POST['fk_dst_cat_id']))
        subcat.save()
        messages.success(request, 'Subcategory created!')
        return HttpResponseRedirect(reverse('listcategories'))



@login_required
def listusers(request: HttpRequest):
    check_invitation_statuses()
    users = User.objects.all().order_by('created_at')
    userlist = []

    for each in users:
        userlist.append({'name': each.name, 'created_at': each.created_at})

    if '.json' in urlparse(request.get_full_path()).path:
        return JsonResponse(userlist, safe=False)
    else:
        return render(request, 'admin.users.html', context={'current_user': request.user.name,
                                                            'users': userlist
                                                            })


@login_required
def invite_user(request: HttpRequest):
    if request.method == 'GET':
        if not request.user.is_superuser:
            return HttpResponse('Permission denied!')
        else:
            form = InviteUserForm()
            return render(request, 'admin.invite_user.html', context={'form': form,
                                                                      'current_user': request.user.name})
    if request.method == 'POST':
        if not request.user.is_superuser:
            return HttpResponse('Permission denied!')
        else:
            form = InviteUserForm(request.POST)
            if form.is_valid():
                email = form.cleaned_data['email']
                name = form.cleaned_data['name']
                try:
                    newuser = User.objects.get(email=email)
                    messages.error(request, 'The user you are inviting is registered in the system.')
                    return render(request, 'admin.invite_user.html', context={'form': form,
                                                                              'current_user': request.user.name})
                except User.DoesNotExist:
                    pass
                try:
                    newuser = User.objects.get(name=name)
                    messages.error(request, 'The user with that name is registered in the system.')
                    return render(request, 'admin.invite_user.html', context={'form': form,
                                                                              'current_user': request.user.name})
                except User.DoesNotExist:
                    pass
                newuser = User()
                newuser.email = email
                newuser.name = name
                newuser.is_active = False
                newuser.is_superuser = False
                newuser.save()
                invitation = UserInvitation()
                invitation.code = get_random_string(length=40)
                invitation.email = newuser.email
                invitation.user_id = newuser
                invitation.status = 'pending'
                invitation.valid_till = timezone.now() + datetime.timedelta(days=2)
                invitation.save()
                newuser.email_user('Invitation to join OWID',
                                   'Hi %s, please follow this link in order '
                                   'to register on owid-grapher: %s' %
                                   (newuser.name, request.build_absolute_uri(reverse('registerbyinvite', args=[invitation.code]))),
                                   'no-reply@ourworldindata.org')
                messages.success(request, 'The invite was sent successfully.')
                return render(request, 'admin.invite_user.html', context={'form': InviteUserForm(),
                                                                          'current_user': request.user.name, })
            else:
                return render(request, 'admin.invite_user.html', context={'form': form,
                                                                          'current_user': request.user.name, })


def register_by_invite(request: HttpRequest, code: str):
    check_invitation_statuses()
    try:
        invite = UserInvitation.objects.get(code=code)
    except UserInvitation.DoesNotExist:
        return HttpResponseNotFound('Your invitation code does not exist in the system.')
    invited_user = invite.user_id

    if request.method == 'GET':
        if invite.status == 'successful':
            return HttpResponse('Your invitation code has already been used.')
        if invite.status == 'expired':
            return HttpResponse('Your invitation code has expired.')
        if invite.status == 'cancelled':
            return HttpResponse('Your invitation code has been cancelled.')
        form = InvitedUserRegisterForm(data={'name': invited_user.name})
        return render(request, 'register_invited_user.html', context={'form': form})
    if request.method == 'POST':
        form = InvitedUserRegisterForm(request.POST)
        if form.is_valid():
            name = form.cleaned_data['name']
            try:
                newuser = User.objects.get(name=name)
                if newuser != invited_user:
                    messages.error(request, 'The username you chose is not available. Please choose another username.')
                    return render(request, 'register_invited_user.html', context={'form': form})
            except User.DoesNotExist:
                pass
            if form.cleaned_data['password1'] == form.cleaned_data['password2']:
                newuser.name = name
                newuser.set_password(form.cleaned_data['password1'])
                newuser.is_active = True
                newuser.save()
                invite.status = 'successful'
                invite.save()
                return HttpResponseRedirect(reverse("login"))
            else:
                messages.error(request, "Passwords don't match!")
                return render(request, 'register_invited_user.html', context={'form': form})
        else:
            return render(request, 'register_invited_user.html', context={'form': form})
