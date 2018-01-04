import os
import json
import re
import urllib
import csv
from io import StringIO
from multiprocessing import Process
from urllib.parse import urlparse
from django.shortcuts import render, redirect
from django.conf import settings
from django.db import connection
from django.db.models import Q
from django.http import HttpResponse, JsonResponse, HttpResponseNotFound, HttpResponseRedirect, StreamingHttpResponse
from django.template.response import TemplateResponse
from django.contrib.auth.decorators import login_required
from django.urls import reverse
from django.utils.encoding import smart_str
from grapher_admin.models import Chart, Variable, License, ChartSlugRedirect
from django.views.decorators.clickjacking import xframe_options_exempt
from owid_grapher.templatetags.webpack import webpack
from django.conf import settings
import hashlib

@login_required
def index(request):
    return redirect('listcharts')

def embed_snippet(request):
    chartsJs = webpack("charts.js")
    chartsCss = webpack("charts.css")

    script = """
        window.App = {};
        window.Global = { rootUrl: '""" + settings.BASE_URL + """' };

        var link = document.createElement('link');
        link.type = 'text/css';
        link.rel = 'stylesheet';
        link.href = '""" + chartsCss + """';
        document.head.appendChild(link);

        var hasPolyfill = false;
        var hasGrapher = false;

        var script = document.createElement('script');
        script.type = 'text/javascript';
        script.onload = function() {
            hasPolyfill = true;
            if (hasGrapher)
                window.Grapher.embedAll();
        }
        script.src = "https://cdn.polyfill.io/v2/polyfill.min.js?features=es6,fetch"
        document.head.appendChild(script);

        var script = document.createElement('script');
        script.type = 'text/javascript';
        script.onload = function() {
            hasGrapher = true;
            if (hasPolyfill)
                window.Grapher.embedAll();
        }
        script.src = '""" + chartsJs + """';
        document.head.appendChild(script);
    """

    response = HttpResponse(script, content_type="application/javascript")
    response['Cache-Control'] = 'public, max-age=0, s-maxage=604800'
    response['Access-Control-Allow-Origin'] = '*'
    return response

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

    charts_per_page = 5

    query = Chart.objects.filter(config__isPublished=True).exclude(origin_url='').order_by('-created_at')

    if test_type and test_type != 'map':
        query = query.filter(type=test_type)

    urls = []
    count = 0

    for each in query:
        configfile = each.config
        if test_type == 'map' and not configfile.get('hasMapTab'):
            continue
        elif test_type and not configfile.get('hasChartTab'):
            continue

        count += 1
        local_url = request.build_absolute_uri('/grapher/') + each.slug
        live_url = "https://ourworldindata.org/grapher/" + each.slug
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
        next_page_url = request.build_absolute_uri('/grapher/testall') + "?" + urllib.parse.urlencode(next_page_params)

    prev_page_url = None
    if test_page > 1:
        prev_page_params = request.GET.copy()
        prev_page_params['page'] = test_page-1
        prev_page_url = request.build_absolute_uri('/grapher/testall') + "?" + urllib.parse.urlencode(prev_page_params)

    starting_point = (test_page - 1) * charts_per_page
    end_point = ((test_page - 1) * charts_per_page) + charts_per_page
    links = urls[starting_point:end_point]

    return render(request, 'testall.html', context={'urls': links, 'next_page_url': next_page_url,
                                                            'prev_page_url': prev_page_url, 'compare': test_compare,
                                                    })

def testsome(request):
    ids = [563, 646, 292, 51, 72, 132, 144, 194, 197, 864, 190, 302]
    charts = sorted(Chart.objects.filter(id__in=ids), key=lambda c: ids.index(c.id))

    urls = []
    for chart in charts:
        configfile = chart.config

        local_url = request.build_absolute_uri('/grapher/') + chart.config['slug']
        live_url = "https://ourworldindata.org/grapher/" + chart.config['slug']
        local_url_png = local_url + '.png'
        live_url_png = live_url + '.png'

        urls.append({'local_url': local_url, 'live_url': live_url, 'local_url_png': local_url_png,
                     'live_url_png': live_url_png})

    return render(request, 'testsome.html', context={'urls': urls})


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

@xframe_options_exempt # Allow embedding
def showchart(request, chart):
    """
    :param request: Request object
    :param chart: Chart model object
    :return: Rendered Chart page
    """

    configfile = chart.config
    canonicalurl = request.build_absolute_uri('/grapher/') + configfile['slug']
    baseurl = request.build_absolute_uri('/grapher/') + configfile['slug']

    chartmeta = {}

    title = configfile['title']
    chartmeta['title'] = title
    if configfile.get('subtitle', ''):
        chartmeta['description'] = configfile['subtitle']
    else:
        chartmeta['description'] = 'An interactive visualization from Our World in Data.'
    query_string = get_query_string(request)

    chartmeta['canonicalUrl'] = canonicalurl
    cachetag = hashlib.md5(json.dumps(configfile).encode('utf-8')).hexdigest()
    chartmeta['imageUrl'] = baseurl + '.png?v=' + cachetag

    configpath = "%s/config/%s.js" % (settings.BASE_URL, chart.pk)

    response = TemplateResponse(request, 'show_chart.html',
                                context={'chartmeta': chartmeta, 'configpath': configpath,
                                         'query': query_string,
                                         })

    if '.export' not in urlparse(request.get_full_path()).path:
        # Spawn an image exporting process in advance (in case the user then requests an export)
        query_str = get_query_string(request)
        chart.export_image(query_str, 'png', is_async=True)
        response['Cache-Control'] = 'public, max-age=0, s-maxage=604800'
    else:
        response['Cache-Control'] = 'no-cache'

    return response


def find_with_redirects(slug):
    """
    :param slug: Slug for the requested Chart
    :return: Chart object
    """
    chart = None
    redirect_chart = None

    try:
        intslug = int(slug)
        chart = Chart.objects.filter(id=intslug, config__isPublished=True).first()
    except ValueError:
        intslug = None

    if not chart:
        chart = Chart.objects.filter(config__slug=slug, config__isPublished=True).first()
        if not chart:
            redirect_chart = ChartSlugRedirect.objects.filter(slug=slug).first()
            if redirect_chart:
                chart = Chart.objects.filter(id=redirect_chart.chart_id, config__isPublished=True).first()

    return chart


def show(request, slug):
    """
    :param request: Request object
    :param slug: Chart slug
    :return: Rendered Chart page
    """
    chart = find_with_redirects(slug)
    if not chart:
        return HttpResponseNotFound('No such chart!')
    return showchart(request, chart)


def config_json_by_slug(request, slug):
    """
    :param request: Request object
    :param slug: Chart slug
    :return: config json
    """
    chart = find_with_redirects(slug)
    if not chart:
        return HttpResponseNotFound('No such chart!')

    response = JsonResponse(chart.config)
    response['Cache-Control'] = 'public, max-age=0, s-maxage=604800'
    response['Access-Control-Allow-Origin'] = '*'

    return response


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


def variables(request, ids):
    """
    :param request: Request object
    :param ids: ids of requested variables
    :return: json file of requested variables in plain text format
    """
    meta = { "variables": {} }

    # First, grab all the variable metadata needed by the frontend
    variable_ids = [int(idStr) for idStr in ids.split('+')]
    variables = Variable.objects.filter(id__in=variable_ids).select_related('fk_dst_id', 'sourceId').values(
        'id', 'name', 'description', 'unit', 'short_unit',
        'displayName', 'displayUnit', 'displayShortUnit', 'displayUnitConversionFactor', 'displayTolerance', 'displayIsProjection',
        'fk_dst_id__name', 'sourceId__pk', 'sourceId__name', 'sourceId__description'
    )

    # Process the metadata into a nicer form
    for variable in variables:
        variable['shortUnit'] = variable.pop('short_unit')
        variable['datasetName'] = variable.pop('fk_dst_id__name')
        source_description = json.loads(variable.pop('sourceId__description'))
        variable['source'] = source_description
        variable['source']['id'] = variable.pop('sourceId__pk')
        variable['source']['name'] = variable.pop('sourceId__name')
        variable['source']['dataPublishedBy'] = "" if not source_description['dataPublishedBy'] else source_description['dataPublishedBy']
        variable['source']['dataPublisherSource'] = "" if not source_description['dataPublisherSource'] else source_description[
            'dataPublisherSource']
        variable['source']['link'] = "" if not source_description['link'] else source_description['link']
        variable['source']['retrievedDate'] = "" if not source_description['retrievedDate'] else source_description['retrievedDate']
        variable['source']['additionalInfo'] = "" if not source_description['additionalInfo'] else source_description[
            'additionalInfo']
        meta['variables'][variable['id']] = variable

    # Now fetch the actual data, using a custom csv-like transfer format
    # for efficiency (this is the most common expensive operation in the grapher)
    varstring = ""
    with connection.cursor() as cursor:
        cursor.execute("""
            SELECT value, year, fk_var_id as var_id, entities.id as entity_id, 
            entities.name as entity_name, entities.code as entity_code 
            FROM data_values 
            LEFT JOIN entities ON data_values.fk_ent_id = entities.id 
            WHERE data_values.fk_var_id IN %s 
            ORDER BY var_id ASC, year ASC
        """, [variable_ids])
        rows = dictfetchall(cursor)

    def stream():
        yield json.dumps(meta)

        entitykey = {}
        seen_variables = {}
        for row in rows:
            if row['var_id'] not in seen_variables:
                seen_variables[row['var_id']] = True
                yield "\r\n"
                yield str(row['var_id'])

            yield f";{row['year']},{row['entity_id']},{row['value']}"

            if row['entity_id'] not in entitykey:
                entitykey[row['entity_id']] = {'name': row['entity_name'], 'code': row['entity_code']}

        yield "\r\n"
        yield json.dumps(entitykey)

    response = StreamingHttpResponse(stream(), content_type="text/plain")

    if get_query_string(request):
        response['Cache-Control'] = 'max-age=31536000 public'
    else:
        response['Cache-Control'] = 'no-cache'
    response['Access-Control-Allow-Origin'] = '*'

    return response


def latest(request):
    """
    :param request: Request object
    :return: Redirects to the Chart page with the latest published chart
    """
    chart = Chart.objects.filter(config__isPublished=True).order_by("-starred", "-created_at").first()
    slug = chart.config.get('slug')
    return HttpResponseRedirect(reverse('showchart', args=[slug]))


def exportfile(request, slug, fileformat):
    """
    :param request: Request object
    :param slug: Chart slug
    :param fileformat: Requested format of the file: [png, svg, csv]
    :return: Returns the file for download
    """
    if fileformat not in ['png', 'svg']:
        return HttpResponseNotFound('Unknown chart export format.')

    if fileformat in ['png', 'svg']:
        chart = find_with_redirects(slug)
        querydict = get_query_as_dict(request)
        querystring = get_query_string(request)
        if chart:
            downloadfile = chart.export_image(querystring, fileformat)
        else:
            return HttpResponseNotFound('No such chart!')

        if fileformat == 'png':
            content_type = 'image/png'
        elif fileformat == 'svg':
            content_type = 'image/svg+xml'

        # If this is a cachebuster url, go for maximum caching.
        if 'v' in request.GET:
            caching = 'public, max-age=31536000'
        else:
            caching = 'public, max-age=7200, s-maxage=604800'

        with open(downloadfile, 'rb') as f:
            response = HttpResponse(f, content_type=content_type)
            response['Cache-Control'] = caching
            # Allow 'view' parameter to override download behavior for debugging
            if 'view' not in request.GET:
                response['Content-Disposition'] = 'attachment; filename=%s' % smart_str(slug + "." + fileformat)
            return response
