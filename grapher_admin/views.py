import copy
import datetime
from dateutil import parser
import json
import re
import csv
import glob
import os
import subprocess
import threading
import shlex
import time
from ansi2html import Ansi2HTMLConverter
from unidecode import unidecode
from io import StringIO
import urllib
from urllib.parse import urlparse
from django.conf import settings
from django.contrib import messages
from django.contrib.auth.views import login as loginview
from django.db.models import Q
from django.db import connection
from django.http import HttpRequest, HttpResponseRedirect, HttpResponse, HttpResponseNotFound, JsonResponse, QueryDict, StreamingHttpResponse
from django.template.response import TemplateResponse
from django.shortcuts import render
from django.urls import reverse
from django.utils import timezone
from django.utils.crypto import get_random_string
from .forms import InviteUserForm, InvitedUserRegisterForm
from .models import Chart, Variable, User, UserInvitation, Logo, ChartSlugRedirect, ChartDimension, Dataset, Setting, DatasetCategory, DatasetSubcategory, Entity, Source, VariableType, DataValue, License
from typing import Dict, Union, Optional
from django.db import transaction
from django.core.cache import cache
import requests

def get_query_string(request):
    """
    :param request: Request object
    :return: The URL query string
    """
    return urlparse(request.get_full_path()).query

def get_query_as_dict(request):
    """
    :param request: Request object
    :return: The dictionary containing URL query parameters
    """
    return dict(urllib.parse.parse_qs(urllib.parse.urlsplit(request.get_full_path()).query))


def JsonErrorResponse(message: str, status: int = 400):
    return JsonResponse({
        "error": {
            "code": status,
            "message": message
        }
    }, status=status)

def dictfetchall(cursor):
    """
    :param cursor: Database cursor
    :return: Returns all rows from the cursor as a list of dicts
    """
    columns = [col[0] for col in cursor.description]
    return [
        dict(zip(columns, row))
        for row in cursor.fetchall()
    ]

def test_all(request):
    test_type = request.GET.get('type', '')
    test_tab = request.GET.get('tab', '')
    test_overlay = request.GET.get('overlay', '')
    test_page = request.GET.get('page', '')
    test_compare = request.GET.get('compare', '')

    if not test_tab and test_type == 'map':
        test_tab = 'map'
    elif not test_tab and test_type:
        test_tab = 'chart'

    if not test_page:
        test_page = 1
    else:
        try:
            test_page = int(test_page)
        except ValueError:
            test_page = 1

    if test_compare == '1':
        test_compare = 1
    else:
        test_compare = 0

    charts_per_page = 20

    query = Chart.objects.filter(config__isPublished=True).order_by('-created_at')

    if test_type and test_type != 'map':
        if test_type == "stacked":
            query = query.filter(config__type="StackedArea")
        elif test_type == "scatter":
            query = query.filter(config__type="ScatterPlot")
        elif test_type == "line":
            query = query.filter(config__type="LineChart")
        else:
            query = query.filter(config__type=test_type)

    urls = []
    count = 0

    for each in query:
        configfile = each.config
        if test_type == 'map' and not configfile.get('hasMapTab'):
            continue
        elif test_type and not configfile.get('hasChartTab'):
            continue

        count += 1
        local_url = request.build_absolute_uri('/grapher/') + each.config['slug']
        live_url = "https://ourworldindata.org/grapher/" + each.config['slug']
        local_url_png = local_url + '.png'
        live_url_png = live_url + '.png'

        if test_tab:
            local_url = local_url + '?tab=' + test_tab
            live_url = live_url + '?tab=' + test_tab
            local_url_png = local_url_png + '?tab=' + test_tab
            live_url_png = live_url_png + '?tab=' + test_tab

        if test_overlay:
            local_url = local_url + '?overlay=' + test_overlay
            live_url = live_url + '?overlay=' + test_overlay
            local_url_png = local_url_png + '?overlay=' + test_overlay
            live_url_png = live_url_png + '?overlay=' + test_overlay

        urls.append({'local_url': local_url, 'live_url': live_url, 'local_url_png': local_url_png,
                     'live_url_png': live_url_png})

    num_pages = -(-count // charts_per_page)


    next_page_url = None
    if test_page < num_pages:
        next_page_params = request.GET.copy()
        next_page_params['page'] = test_page+1
        next_page_url = request.build_absolute_uri('/grapher/admin/testall') + "?" + urllib.parse.urlencode(next_page_params)

    prev_page_url = None
    if test_page > 1:
        prev_page_params = request.GET.copy()
        prev_page_params['page'] = test_page-1
        prev_page_url = request.build_absolute_uri('/grapher/admin/testall') + "?" + urllib.parse.urlencode(prev_page_params)

    starting_point = (test_page - 1) * charts_per_page
    end_point = ((test_page - 1) * charts_per_page) + charts_per_page
    links = urls[starting_point:end_point]

    return render(request, 'testall.html', context={'urls': links, 'next_page_url': next_page_url,
                                                            'prev_page_url': prev_page_url, 'compare': test_compare,
                                                    })

def testsome(request):
    ids = [563, 646, 292, 51, 72, 132, 144, 194, 197, 864, 190, 302, 1690]
    charts = sorted(Chart.objects.filter(id__in=ids), key=lambda c: ids.index(c.id))

    urls = []
    for chart in charts:
        configfile = chart.config
        configfile['id'] = chart.id

        local_url = request.build_absolute_uri('/grapher/') + chart.config['slug']
        live_url = "https://ourworldindata.org/grapher/" + chart.config['slug']
        local_url_png = local_url + '.png'
        live_url_png = live_url + '.png'

        urls.append({'local_url': local_url, 'live_url': live_url, 'local_url_png': local_url_png,
                     'live_url_png': live_url_png})

    return render(request, 'testsome.html', context={'urls': urls})

def custom_login(request: HttpRequest):
    """
    Redirects to index page if the user is already logged in
    :param request: Request object
    :return: Redirects to index page if the user is logged in, otherwise will show the login page
    """
    if request.user.is_authenticated():
        return HttpResponseRedirect("/admin/charts")
    else:
        setattr(request, '_dont_enforce_csrf_checks', True)
        return loginview(request)

def importdata(request: HttpRequest):
    datasets = Dataset.objects.filter(namespace='owid').order_by('name').values()
    datasetlist = []
    for each in datasets:
        each['subcategoryId'] = each['subcategoryId_id'] # XXX
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
    # we probably don't need SourceTemplate anymore
    source_template = dict(Setting.objects.filter(meta_name='sourceTemplate').values().first())
    source_template['created_at'] = str(source_template['created_at'])
    source_template['updated_at'] = str(source_template['updated_at'])

    categories = DatasetSubcategory.objects.all().select_related().filter(
        categoryId__fetcher_autocreated=False).order_by('categoryId__pk').order_by('pk')
    category_list = []
    for each in categories:
        category_list.append({'name': each.name, 'id': each.pk, 'parent': each.categoryId.name})
    entitynames = Entity.objects.all().iterator()
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
                                'categoryId': DatasetSubcategory.objects.get(pk=datasetmeta['subcategoryId']).categoryId,
                                'subcategoryId': DatasetSubcategory.objects.get(pk=datasetmeta['subcategoryId'])
                                }

                if datasetmeta['id']:
                    dataset = Dataset.objects.get(pk=datasetmeta['id'])
                    dataset_old_name = dataset.name  # needed for version tracking csv export
                    Dataset.objects.filter(pk=datasetmeta['id']).update(updated_at=timezone.now(), **datasetprops)
                else:
                    dataset = Dataset(**datasetprops)
                    dataset_old_name = None
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
                        source_desc = {
                            'dataPublishedBy': None if not variable['source']['dataPublishedBy'] else variable['source']['dataPublishedBy'],
                            'dataPublisherSource': None if not variable['source']['dataPublisherSource'] else variable['source']['dataPublisherSource'],
                            'link': None if not variable['source']['link'] else variable['source']['link'],
                            'retrievedDate': None if not variable['source']['retrievedDate'] else variable['source']['retrievedDate'],
                            'additionalInfo': None if not variable['source']['additionalInfo'] else variable['source']['additionalInfo']
                        }
                        if source_id:
                            existing_source = Source.objects.get(pk=source_id)
                            existing_source.name = variable['source']['name']
                            existing_source.updated_at = timezone.now()
                            existing_source.description = json.dumps(source_desc)
                            existing_source.save()
                        else:
                            new_source = Source(datasetId=dataset_id, name=source_name, description=json.dumps(source_desc))
                            new_source.save()
                            source_id = new_source.pk
                            source_ids_by_name[source_name] = source_id

                    values = variable['values']
                    variableprops = {'name': variable['name'], 'description': variable['description'], 'unit': variable['unit'],
                                     'coverage': variable['coverage'], 'timespan': variable['timespan'],
                                     'variableTypeId': VariableType.objects.get(pk=3),
                                     'datasetId': Dataset.objects.get(pk=dataset_id),
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
                    while DataValue.objects.filter(variableId__pk=varid).first():
                        with connection.cursor() as c:
                            c.execute('DELETE FROM %s WHERE variableId = %s LIMIT 10000;' %
                                      (DataValue._meta.db_table, varid))
                            # the LIMIT is here so that the database doesn't try to delete a large number of values at
                            # once and becomes unresponsive

                    insert_string = 'INSERT into data_values (value, year, entityId, variableId) VALUES (%s, %s, %s, %s)'
                    data_values_tuple_list = []
                    for i in range(0, len(years)):
                        if values[i] == '':
                            continue
                        data_values_tuple_list.append((values[i], years[i],
                                                       entitiy_name_to_id[entitynames[entities[i]]],
                                                       varid))

                        if len(data_values_tuple_list) > 3000:  # insert when the length of the list goes over 3000
                            with connection.cursor() as dbconnection:
                                dbconnection.executemany(insert_string, data_values_tuple_list)
                            data_values_tuple_list = []

                    if len(data_values_tuple_list):  # insert any leftover data_values
                        with connection.cursor() as dbconnection:
                            dbconnection.executemany(insert_string, data_values_tuple_list)
                    with connection.cursor() as cursor:
                        cursor.execute("DELETE FROM sources WHERE sources.id NOT IN (SELECT variables.sourceId FROM variables)")

                write_dataset_csv(dataset.pk, datasetprops['name'],
                                  dataset_old_name, request.user.get_full_name(), request.user.email)

                return JsonResponse({'datasetId': dataset_id}, safe=False)
        except Exception as e:
            if len(e.args) > 1:
                error_m = str(e.args[0]) + ' ' + str(e.args[1])
            else:
                error_m = e.args[0]
            return HttpResponse(error_m, status=500)


def dataset_csv(request: HttpRequest, datasetid: str):
    try:
        dataset = Dataset.objects.get(pk=int(datasetid))
    except Dataset.DoesNotExist:
        return HttpResponseNotFound('Dataset does not exist!')
    # all variables that belong to a dataset being downloaded
    allvariables = Variable.objects.filter(datasetId=dataset)

    datasetvarlist = []

    for var in allvariables.values('id', 'name'):
        datasetvarlist.append({'id': var['id'], 'name': var['name']})

    datasetvarlist = sorted(datasetvarlist, key=lambda k: k['id'])

    id_tuple = ''
    varlist = []
    headerlist = ['Entity', 'Year']

    for each in datasetvarlist:
        id_tuple += str(each['id']) + ','
        headerlist.append(each['name'])
        varlist.append(each['id'])
    # removing that last comma
    id_tuple = id_tuple[:-1]
    # get all entity ids that have data values in the current dataset
    with connection.cursor() as entity_cursor:
        entity_cursor.execute('select distinct entityId from data_values where variableId in (%s);' % ','.join([str(item['id']) for item in allvariables.values('id')]))
        dataset_entities_list = [item[0] for item in entity_cursor.fetchall()]
    # get the names for entity ids
    allentities = Entity.objects.filter(pk__in=dataset_entities_list).values('id', 'name')
    allentities_dict = {item['id']: item['name'] for item in allentities}
    allentities_list = []
    for each in allentities:
        allentities_list.append({'id': each['id'], 'name': each['name']})
    allentities_list = sorted(allentities_list, key=lambda k: k['name'])
    allentities_list = [item['id'] for item in allentities_list]
    # we are splitting the entities to groups of 3 for querying
    # this is still not very efficient, but better than querying values for each entity separately
    # if we don't set this limitation and query for values from all entities, th db usually hangs -
    # - when there are many rows present
    entity_chunks = [allentities_list[x:x + 3] for x in range(0, len(allentities_list), 3)]

    sql_query = 'SELECT `value`, `year`, data_values.`variableId` as var_id, data_values.`entityId` as entity_id ' \
                ' from data_values ' \
                ' WHERE ' \
                'data_values.`variableId` in (%s) AND data_values.`entityId` in (%s) ORDER BY entityId, year, variableId;'

    # our csv streaming function

    def stream():
        buffer_ = StringIO()
        writer = csv.writer(buffer_)
        writer.writerow(headerlist)
        current_row = None

        for chunk in entity_chunks:
            with connection.cursor() as outer_cursor:
                outer_cursor.execute(sql_query % (id_tuple, ','.join([str(x) for x in chunk])))
                rows = outer_cursor.fetchall()
            for row in rows:
                if not current_row or current_row[0] != row[3] or current_row[1] != row[1]:
                    if current_row:
                        current_row[0] = allentities_dict[current_row[0]]
                        writer.writerow(current_row)
                        buffer_.seek(0)
                        data = buffer_.read()
                        buffer_ = StringIO()
                        writer = csv.writer(buffer_)
                        yield data

                    current_row = [row[3], row[1]]
                    for i in range(0, len(varlist)):
                        current_row.append("")

                theindex = 2 + varlist.index(row[2])
                current_row[theindex] = row[0]

        current_row[0] = allentities_dict[current_row[0]]
        writer.writerow(current_row)
        buffer_.seek(0)
        data = buffer_.read()
        yield data

    response = StreamingHttpResponse(
        stream(), content_type='text/csv'
    )
    ascii_filename = unidecode(dataset.name)
    disposition = "attachment; filename='%s.csv'" % ascii_filename
    response['Content-Disposition'] = disposition
    response['Cache-Control'] = 'public, max-age=0, s-maxage=604800'
    return response


def dataset_json(request: HttpRequest, datasetid: str):
    try:
        dataset = Dataset.objects.get(pk=int(datasetid))
    except Dataset.DoesNotExist:
        return HttpResponseNotFound('Dataset does not exist!')

    data = {'name': dataset.name, 'description': dataset.description, 'categoryId': dataset.categoryId_id,
            'subcategoryId': dataset.subcategoryId_id, 'variables': []}

    allchart_dimensions = ChartDimension.objects.all().values('chartId', 'variableId')
    var_to_chart = {}
    for each in allchart_dimensions:
        if var_to_chart.get(each['variableId'], 0):
            var_to_chart[each['variableId']].append(each['chartId'])
        else:
            var_to_chart[each['variableId']] = []
            var_to_chart[each['variableId']].append(each['chartId'])

    variables = Variable.objects.filter(datasetId=dataset.id).select_related('sourceId')

    for var in variables:
        source_description = json.loads(var.sourceId.description)
        sourcedata = {
            'id': var.sourceId.pk,
            'name': var.sourceId.name,
            'dataPublishedBy': "" if not source_description['dataPublishedBy'] else source_description['dataPublishedBy'],
            'dataPublisherSource': "" if not source_description['dataPublisherSource'] else source_description['dataPublisherSource'],
            'link': "" if not source_description['link'] else source_description['link'],
            'retrievedDate': "" if not source_description['retrievedDate'] else source_description['retrievedDate'],
            'additionalInfo': "" if not source_description['additionalInfo'] else source_description['additionalInfo']
        }

        chartdata = []

        for onechart in var_to_chart.get(var.pk, []):
            chart = Chart.objects.get(pk=onechart)
            chartdata.append({
                'id': chart.pk,
                'name': chart.config['title']
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


def listcategories(request: HttpRequest):
    categories = DatasetCategory.objects.values()
    return render(request, 'admin.categories.html', context={'current_user': request.user.name,
                                                             'categories': categories
                                                             })


def showcategory(request: HttpRequest, catid: str):
    try:
        catobj = DatasetCategory.objects.get(pk=int(catid))
    except DatasetCategory.DoesNotExist:
        return HttpResponseNotFound('Category does not exist!')

    subcategories = DatasetSubcategory.objects.filter(categoryId=catobj).values()
    category = DatasetCategory.objects.filter(pk=int(catid)).values()[0]
    category['subcategories'] = subcategories

    return render(request, 'admin.categories.show.html', context={'current_user': request.user.name,
                                                                  'category': category
                                                                  })


def managecategory(request: HttpRequest, catid: str):
    try:
        category = DatasetCategory.objects.get(pk=int(catid))
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
            subcategory = DatasetSubcategory.objects.filter(categoryId=category)
            try:
                for each in subcategory:
                    each.delete()
                category.delete()
            except Exception as e:
                messages.error(request, e.args[1])
                return HttpResponseRedirect(reverse('editcategory', args=[catid]))
            messages.success(request, 'Category deleted!')
            return HttpResponseRedirect(reverse('listcategories'))


def editcategory(request: HttpRequest, catid: str):
    try:
        category = DatasetCategory.objects.get(pk=int(catid))
    except DatasetCategory.DoesNotExist:
        return HttpResponseNotFound('Category does not exist!')
    category = DatasetCategory.objects.filter(pk=int(catid)).values()[0]
    return render(request, 'admin.categories.edit.html', context={'current_user': request.user.name,
                                                                  'category': category
                                                                  })


def editsubcategory(request: HttpRequest, subcatid: str):
    try:
        subcat = DatasetSubcategory.objects.get(pk=int(subcatid))
    except DatasetSubcategory.DoesNotExist:
        return HttpResponseNotFound('Subcategory does not exist!')

    subcategory = {'id': subcat.pk, 'name': subcat.name, 'category': subcat.categoryId.pk}
    categories = DatasetCategory.objects.values()
    category = {'id': subcat.categoryId.pk}

    return render(request, 'admin.subcategories.edit.html', context={'current_user': request.user.name,
                                                                     'subcategory': subcategory,
                                                                     'categories': categories,
                                                                     'category': category})


def managesubcategory(request: HttpRequest, subcatid: str):
    try:
        subcat = DatasetSubcategory.objects.get(pk=int(subcatid))
    except DatasetSubcategory.DoesNotExist:
        return HttpResponseNotFound('Subcategory does not exist!')

    parent_cat = subcat.categoryId.pk

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


def createsubcategory(request: HttpRequest):
    categories = DatasetCategory.objects.values()
    return render(request, 'admin.subcategories.create.html',context={'current_user': request.user.name,
                                                                      'categories': categories
                                                                      })


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
        subcat.categoryId = DatasetCategory.objects.get(pk=int(request.POST['categoryId']))
        subcat.save()
        messages.success(request, 'Subcategory created!')
        return HttpResponseRedirect(reverse('listcategories'))

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


def write_dataset_csv(datasetid: int, new_dataset_name, old_dataset_name, committer, committer_email):

    """
    The function to write a dataset's csv file to a git repo
    :param datasetid: ID of a dataset to export
    :param new_dataset_name: The name of the file that will be written to disk
    :param old_dataset_name: If the dataset is being updated, we need its old name
    :param committer: Committer's name will show up in repo's commit info
    :param committer_email: Committer's email
    :return:
    """

    try:
        dataset = Dataset.objects.get(pk=datasetid)
    except Dataset.DoesNotExist:
        return

    # This location (base_repo_folder) shouldn't be a repo
    # All repos will be created automatically by the script on first export
    base_repo_folder = settings.DATASETS_REPO_LOCATION
    current_dataset_folder = os.path.abspath(os.path.join(base_repo_folder, dataset.namespace))
    temp_dataset_folder = os.path.abspath(settings.DATASETS_TMP_LOCATION)
    if not os.path.exists(base_repo_folder):
        os.makedirs(base_repo_folder)

    if not os.path.exists(current_dataset_folder):
        os.makedirs(current_dataset_folder)
        subprocess.check_output(
            'git init && '
            'git config user.name "%s" && '
            'git config user.email "%s"' %
            (settings.DATASETS_REPO_USERNAME, settings.DATASETS_REPO_EMAIL), shell=True,
            cwd=current_dataset_folder)
    else:
        if not os.path.exists(os.path.join(current_dataset_folder, '.git')):
            subprocess.check_output(
                'git init && '
                'git config user.name "%s" && '
                'git config user.email "%s"' %
                (settings.DATASETS_REPO_USERNAME, settings.DATASETS_REPO_EMAIL), shell=True,
                cwd=current_dataset_folder)

    allvariables = Variable.objects.filter(datasetId=dataset)

    if not allvariables:
        # if the dataset does not contain any data, no need to export it, just stop the script here
        return

    datasetvarlist = []
    vardata = []
    source_ids = []
    for var in allvariables.values('id', 'name', 'unit', 'description', 'code', 'coverage', 'timespan', 'sourceId__name', 'sourceId__id'):
        datasetvarlist.append({'id': var['id'], 'name': var['name']})
        vardata.append({
            'name': var['name'], 'unit': var['unit'], 'description': var['description'],
            'code': var['code'], 'coverage': var['coverage'], 'timespan': var['timespan'],
            'source_id': var['sourceId__name']
        })
        source_ids.append(var['sourceId__id'])

    datasetvarlist = sorted(datasetvarlist, key=lambda k: k['id'])

    id_tuple = ''
    varlist = []
    headerlist = ['Entity', 'Year']

    for each in datasetvarlist:
        id_tuple += str(each['id']) + ','
        headerlist.append(each['name'])
        varlist.append(each['id'])
    # removing that last comma
    id_tuple = id_tuple[:-1]
    # get all entity ids that have data values in the current dataset
    with connection.cursor() as entity_cursor:
        entity_cursor.execute('select distinct entityId from data_values where variableId in (%s);' %
                              ','.join([str(item['id']) for item in allvariables.values('id')]))
        dataset_entities_list = [item[0] for item in entity_cursor.fetchall()]
    # get the names for entity ids
    allentities = Entity.objects.filter(pk__in=dataset_entities_list).values('id', 'name')
    allentities_dict = {item['id']: item['name'] for item in allentities}
    allentities_list = []
    for each in allentities:
        allentities_list.append({'id': each['id'], 'name': each['name']})
    allentities_list = sorted(allentities_list, key=lambda k: k['name'])
    allentities_list = [item['id'] for item in allentities_list]
    # we are splitting the entities to groups of 3 for querying
    # this is still not very efficient, but better than querying values for each entity separately
    # if we don't set this limitation and query for values from all entities, th db usually hangs -
    # - when there are many rows present
    entity_chunks = [allentities_list[x:x + 3] for x in range(0, len(allentities_list), 3)]

    dataset_meta = {}

    with connection.cursor() as source_cursor:
        source_cursor.execute('select name, description from sources where id in (%s);' % ','.join([str(x) for x in source_ids]))
        dataset_meta['sources'] = [{'name': item[0], 'description': item[1]} for item in source_cursor.fetchall()]

    counter = 0
    source_name_to_id = {}
    for each in dataset_meta['sources']:
        each['id'] = counter
        source_name_to_id[each['name']] = counter
        counter += 1

    for each in vardata:
        each['source_id'] = source_name_to_id[each['source_id']]

    dataset_meta['variables'] = vardata

    sql_query = 'SELECT `value`, `year`, data_values.`variableId` as var_id, data_values.`entityId` as entity_id ' \
                ' from data_values ' \
                ' WHERE data_values.`variableId` in (%s) AND ' \
                'data_values.`entityId` in (%s) ORDER BY entityId, year, variableId;'

    metadata_filename = (unidecode(new_dataset_name) + '.json').replace('/', '_')
    dataset_filename = (unidecode(new_dataset_name) + '.csv').replace('/', '_')

    if old_dataset_name:
        old_metadata_name = (unidecode(old_dataset_name) + '.json').replace('/', '_')
        old_dataset_name = (unidecode(old_dataset_name) + '.csv').replace('/', '_')
        old_metadata_file_path = os.path.join(current_dataset_folder, old_metadata_name)
        old_dataset_file_path = os.path.join(current_dataset_folder, old_dataset_name)
        old_metadata_file_path_escaped = shlex.quote(os.path.join(current_dataset_folder, old_metadata_name))
        old_dataset_file_path_escaped = shlex.quote(os.path.join(current_dataset_folder, old_dataset_name))

    metadata_file_path_escaped = shlex.quote(os.path.join(current_dataset_folder, metadata_filename))
    dataset_file_path_escaped = shlex.quote(os.path.join(current_dataset_folder, dataset_filename))

    delete_previous = False
    if old_dataset_name is not None:
        if os.path.isfile(old_dataset_file_path):
            delete_previous = True
            commit_message = 'Updating: %s'
        else:
            commit_message = 'Creating: %s'
    else:
        commit_message = 'Creating: %s'

    # now saving the dataset to tmp dir

    with open(os.path.join(temp_dataset_folder, dataset_filename), 'w', newline='', encoding='utf8') as f:
        writer = csv.writer(f)
        writer.writerow(headerlist)
        current_row = None

        for chunk in entity_chunks:
            with connection.cursor() as outer_cursor:
                outer_cursor.execute(sql_query % (id_tuple, ','.join([str(x) for x in chunk])))
                rows = outer_cursor.fetchall()
            for row in rows:
                if not current_row or current_row[0] != row[3] or current_row[1] != row[1]:
                    if current_row:
                        current_row[0] = allentities_dict[current_row[0]]
                        writer.writerow(current_row)

                    current_row = [row[3], row[1]]
                    for i in range(0, len(varlist)):
                        current_row.append("")

                theindex = 2 + varlist.index(row[2])
                current_row[theindex] = row[0]

        current_row[0] = allentities_dict[current_row[0]]
        writer.writerow(current_row)

    with open(os.path.join(temp_dataset_folder, metadata_filename), 'w', encoding='utf8') as f:
        json.dump(dataset_meta, f, indent=4)

    try:
        if delete_previous:
            commit_hash = subprocess.check_output('git rm %s %s --quiet && '
                                                  'mv %s %s && mv %s %s && '
                                                  'git add %s %s && '
                                                  'git commit -m %s %s %s %s %s --quiet --author="%s <%s>" && '
                                                  'git rev-parse HEAD' %
                                                  (old_dataset_file_path_escaped,
                                                   old_metadata_file_path_escaped,
                                                   shlex.quote(os.path.join(temp_dataset_folder, dataset_filename)),
                                                   dataset_file_path_escaped,
                                                   shlex.quote(os.path.join(temp_dataset_folder, metadata_filename)),
                                                   metadata_file_path_escaped,
                                                   dataset_file_path_escaped,
                                                   metadata_file_path_escaped,
                                                   shlex.quote(commit_message % unidecode(dataset.name)),
                                                   dataset_file_path_escaped,
                                                   metadata_file_path_escaped,
                                                   old_metadata_file_path_escaped,
                                                   old_dataset_file_path_escaped,
                                                   committer, committer_email,
                                                   ), shell=True, cwd=current_dataset_folder)
        else:
            commit_hash = subprocess.check_output('mv %s %s && mv %s %s && '
                                                  'git add %s %s && '
                                                  'git commit -m %s %s %s --quiet --author="%s <%s>" && '
                                                  'git rev-parse HEAD' %
                                                  (shlex.quote(os.path.join(temp_dataset_folder, dataset_filename)),
                                                   dataset_file_path_escaped,
                                                   shlex.quote(os.path.join(temp_dataset_folder, metadata_filename)),
                                                   metadata_file_path_escaped,
                                                   dataset_file_path_escaped,
                                                   metadata_file_path_escaped,
                                                   shlex.quote(commit_message % unidecode(dataset.name)),
                                                   metadata_file_path_escaped,
                                                   dataset_file_path_escaped,
                                                   committer, committer_email,
                                                   ), shell=True, cwd=current_dataset_folder)
    except subprocess.CalledProcessError as e:
        if 'nothing to commit' in e.output.decode('utf-8').lower():
            return
        else:
            raise Exception('An error occured while exporting the dataset to the git repo.')

    commit_hash = commit_hash.decode('utf-8').strip()
    # now saving the diff show output to html
    conv = Ansi2HTMLConverter()
    commit_info = subprocess.check_output('git -C %s show --color %s'
                                          % (current_dataset_folder, commit_hash), shell=True)
    html = conv.convert(commit_info.decode('utf-8'))
    if not os.path.exists(os.path.join(settings.DATASETS_DIFF_HTML_LOCATION, dataset.namespace)):
        os.makedirs(os.path.join(settings.DATASETS_DIFF_HTML_LOCATION, dataset.namespace))
    with open(os.path.join(settings.DATASETS_DIFF_HTML_LOCATION, dataset.namespace, '%s.html' % commit_hash),
              'w', encoding='utf8') as f:
        f.write(html)


def show_dataset_history(request: HttpRequest, datasetid: str):
    try:
        dataset = Dataset.objects.get(pk=int(datasetid))
    except Dataset.DoesNotExist:
        return HttpResponseNotFound('Dataset does not exist!')

    repo_folder = os.path.join(settings.DATASETS_REPO_LOCATION, dataset.namespace)
    history = None
    meta_history = None
    commit_fields = ['commit_hash', 'commit_made_by', 'commit_date']
    log_format = ['%H', '%an', '%ad']
    # %x1f and %x1e are for delimiting and separating each record
    log_format = '%x1f'.join(log_format) + '%x1e'
    if os.path.exists(repo_folder):
        try:
            history = subprocess.check_output('git log --format="%s" --follow %s ' %
                                              (log_format, shlex.quote(dataset.name + '.csv')), shell=True,
                                              cwd=repo_folder)
        except subprocess.CalledProcessError:
            # subprocess will raise exception if git doesn't find any commits related to the given file name
            pass
        try:
            meta_history = subprocess.check_output('git log --format="%s" --follow %s ' %
                                                   (log_format, shlex.quote(dataset.name + '.json')), shell=True,
                                                   cwd=repo_folder)
        except subprocess.CalledProcessError:
            pass

    if history:
        history = history.decode('utf-8').strip('\n\x1e').split("\x1e")
        history = [row.strip().split("\x1f") for row in history]
        history = [dict(zip(commit_fields, row)) for row in history]
        # we will need to parse the date string returned by git
        for each in history:
            each['commit_date'] = parser.parse(each['commit_date'])
            each['namespace'] = dataset.namespace
    if meta_history:
        meta_history = meta_history.decode('utf-8').strip('\n\x1e').split("\x1e")
        meta_history = [row.strip().split("\x1f") for row in meta_history]
        meta_history = [dict(zip(commit_fields, row)) for row in meta_history]
        # we will need to parse the date string returned by git
        for each in meta_history:
            each['commit_date'] = parser.parse(each['commit_date'])
            each['namespace'] = dataset.namespace

    return render(request, 'admin.datasets.history.html', context={'current_user': request.user.name,
                                                                   'dataset_name': dataset.name,
                                                                   'history': history,
                                                                   'meta_history': meta_history,
                                                                   'datasetid': dataset.id
                                                                   })


def serve_diff_html(request: HttpRequest, namespace: str, commit_hash: str):
    if os.path.isfile(os.path.join(settings.DATASETS_DIFF_HTML_LOCATION, namespace, '%s.html' % commit_hash)):
        return HttpResponse(open(os.path.join(settings.DATASETS_DIFF_HTML_LOCATION, namespace, '%s.html' % commit_hash),
                                 'r', encoding='utf8').read())
    else:
        return HttpResponse('No diff file found for that commit!')


def all_dataset_history(request: HttpRequest):

    items_per_page = 50

    namespaces = Dataset.objects.all().values('namespace').distinct()

    history = []

    commit_fields = ['commit_hash', 'commit_made_by', 'commit_date', 'message']
    log_format = ['%H', '%an', '%ad', '%s']
    # %x1f and %x1e are for delimiting and separating each record
    log_format = '%x1f'.join(log_format) + '%x1e'

    for namespace in namespaces:
        if os.path.exists(os.path.join(settings.DATASETS_REPO_LOCATION, namespace['namespace'])):
            try:
                output = subprocess.check_output('git log --format="%s"' %
                                                 log_format, shell=True,
                                                 cwd=os.path.join(settings.DATASETS_REPO_LOCATION, namespace['namespace']))
            except subprocess.CalledProcessError:
                # subprocess will raise exception if git doesn't find any commits
                # we then give back a None
                output = None

            if output:
                output = output.decode('utf-8').strip('\n\x1e').split("\x1e")
                output = [row.strip().split("\x1f") for row in output]
                output = [dict(zip(commit_fields, row)) for row in output]
                # we will need to parse the date string returned by git
                for each in output:
                    each['commit_date'] = parser.parse(each['commit_date'])
                    each['namespace'] = namespace['namespace']
                    history.append(each)

    # sort everything by date
    history = sorted(history, key=lambda k: k['commit_date'], reverse=True)

    total_rows = len(history)
    total_pages = -(-len(history) // items_per_page)
    page_number = get_query_as_dict(request).get('page', [0])

    try:
        page_number = int(page_number[0])
    except ValueError:
        page_number = 0

    if page_number > 1:
        vals = history[(page_number - 1) * items_per_page:page_number * items_per_page]
    else:
        vals = history[:items_per_page]

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

    return render(request, 'admin.datasets.all_history.html', context={'current_user': request.user.name,
                                                                       'history_items': vals,
                                                                       'nav_pages': nav_pages,
                                                                       'current_page': page_number,
                                                                       'total_rows': total_rows
                                                                       })


def serve_commit_file(request: HttpRequest, namespace: str, commit_hash: str, filetype: str):

    repo_folder = os.path.join(settings.DATASETS_REPO_LOCATION, namespace)

    files_list = subprocess.check_output(
        'git diff-tree --no-commit-id --name-status  -r %s' % commit_hash,
        shell=True,
        cwd=repo_folder
    )

    if not files_list:  # the commit might be the very first commit
        files_list = subprocess.check_output(
            'git diff-tree --no-commit-id --name-status  --root %s' % commit_hash,
            shell=True,
            cwd=repo_folder
        )

    files_list = files_list.decode('utf-8').splitlines()

    file_type_dict = {}
    for each in files_list:
        status = each.split('\t')[0]
        filename = each.split('\t')[1]
        if status != 'D':
            file_type_dict[os.path.splitext(filename)[1]] = filename

    filetype = '.%s' % filetype
    if filetype in file_type_dict:
        file_contents = subprocess.check_output('git show %s:%s' % (commit_hash, shlex.quote(file_type_dict[filetype])),
                                                shell=True, cwd=repo_folder)
        file_contents = file_contents.decode('utf-8')
        response = HttpResponse(file_contents)
        ascii_filename = unidecode(file_type_dict[filetype])
        disposition = "attachment; filename='%s'" % ascii_filename
        response['Content-Disposition'] = disposition
        return response
    else:
        return HttpResponse('Could not get file contents.')


def treeview_datasets(request: HttpRequest):
    tree = []
    tree_dict = {}
    all_variables = Variable.objects.all().values('id', 'name', 'datasetId__categoryId__name',
                                                  'datasetId__subcategoryId__name', 'datasetId__name', 'datasetId').iterator()

    for var in all_variables:
        if var['datasetId__categoryId__name'] not in tree_dict:
            tree_dict[var['datasetId__categoryId__name']] = {}

        if var['datasetId__subcategoryId__name'] not in tree_dict[var['datasetId__categoryId__name']]:
            tree_dict[var['datasetId__categoryId__name']][var['datasetId__subcategoryId__name']] = {}

        if var['datasetId__name'] not in tree_dict[var['datasetId__categoryId__name']][
            var['datasetId__subcategoryId__name']]:
            tree_dict[var['datasetId__categoryId__name']][var['datasetId__subcategoryId__name']][
                var['datasetId__name']] = {'id': var['datasetId'], 'vars': []}

        tree_dict[var['datasetId__categoryId__name']][var['datasetId__subcategoryId__name']][
            var['datasetId__name']]['vars'].append({'varname': var['name'], 'varid': var['id']})
    cat_id_count = 0
    subcat_id_count = 0
    for cat, catcontent in tree_dict.items():
        subcatlist = []
        subcatcount = 0
        cat_id_count += 1
        for subcat, subcatcontent in catcontent.items():
            datasetlist = []
            datasetcount = 0
            subcat_id_count += 1
            for dataset, datasetcontent in subcatcontent.items():
                varlist = []
                varcount = 0
                for onevar in datasetcontent['vars']:
                    varlist.append({'text': onevar['varname'], 'selectable': False, 'backColor': "#FF5C5C",
                                    'href': reverse('showvariable', args=(onevar['varid'], ))})
                    varcount += 1
                datasetlist.append({'text': dataset + ' - (%s)' % str(varcount), 'selectable': False,
                                    'backColor': "#5697FF",
                                    'href': reverse('showdataset', args=(datasetcontent['id'], )), 'nodes': varlist})
                datasetcount += 1
            subcatlist.append({'text': subcat + ' - (%s)' % str(datasetcount),
                               'selectable': False, 'backColor': "#AAFF5C", 'href': "#subcat%s" % subcat_id_count,
                               'nodes': datasetlist})
            subcatcount += 1
        tree.append({'text': cat + ' - (%s)' % str(subcatcount), 'selectable': False, 'href': "#cat%s" % cat_id_count,
                     'nodes': subcatlist})

    for cat in tree:
        cat['nodes'] = sorted(cat['nodes'], key=lambda k: k['text'])
        for subcat in cat['nodes']:
            subcat['nodes'] = sorted(subcat['nodes'], key=lambda k: k['text'])
            for dataset in subcat['nodes']:
                dataset['nodes'] = sorted(dataset['nodes'], key=lambda k: k['text'])

    tree = sorted(tree, key=lambda k: k['text'])

    tree_json = json.dumps(tree)

    return render(request, 'admin.datasets.by.category.html', context={'current_user': request.user.name,
                                                                       'tree_json': tree_json
                                                                       })

def redirect_404(request: HttpRequest, path: str = ""):
    return HttpResponseRedirect('/admin/' + path)
