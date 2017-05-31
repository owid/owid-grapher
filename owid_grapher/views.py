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
from django.http import HttpResponse, HttpResponseNotFound, HttpResponseRedirect, StreamingHttpResponse
from django.template.response import TemplateResponse
from django.contrib.auth.decorators import login_required
from django.urls import reverse
from django.utils.encoding import smart_str
from grapher_admin.models import Chart, Variable, License, ChartSlugRedirect


@login_required
def index(request):
    return redirect('listcharts')


def test_all(request):
    test_type = request.GET.get('type', '')
    test_tab = request.GET.get('tab', '')
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

    query = Chart.objects.filter(published=True).exclude(origin_url='')

    if test_type and test_type != 'map':
        query = query.filter(type=test_type)

    urls = []
    count = 0

    for each in query:
        configfile = json.loads(each.config)
        tabs = configfile['tabs']
        if test_type == 'map' and 'map' not in tabs:
            continue
        elif test_type and 'chart' not in tabs:
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

        urls.append({'local_url': local_url, 'live_url': live_url, 'local_url_png': local_url_png,
                     'live_url_png': live_url_png})

    num_pages = -(-count // charts_per_page)

    query_string = get_query_string(request)
    # removing the existing page parameter
    if 'page=' in query_string:
        query_string = query_string[7:]

    next_page_url = None
    if test_page < num_pages:
        if not query_string:
            next_page_url = request.get_full_path() + '?page=%s' % (test_page + 1)
        else:
            next_page_url = request.build_absolute_uri('/grapher/testall') + '?page=%s' % (test_page + 1) + '&' +\
                            query_string

    prev_page_url = None
    if test_page > 1:
        if not query_string:
            prev_page_url = request.get_full_path() + '?page=%s' % (test_page - 1)
        else:
            prev_page_url = request.build_absolute_uri('/grapher/testall') + '?page=%s' % (test_page - 1) + '&' +\
                            query_string

    starting_point = (test_page - 1) * charts_per_page
    end_point = ((test_page - 1) * charts_per_page) + charts_per_page
    links = urls[starting_point:end_point]

    return render(request, 'testall.html', context={'urls': links, 'next_page_url': next_page_url,
                                                            'prev_page_url': prev_page_url, 'compare': test_compare,
                                                    })


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


def showchart(request, chart):
    """
    :param request: Request object
    :param chart: Chart model object
    :return: Rendered Chart page
    """

    # saving chart's referer URL
    referer_s = request.META.get('HTTP_REFERER')
    if referer_s:
        root = urlparse(request.build_absolute_uri('/'))
        referer = urlparse(referer_s)
        if (root.netloc == referer.netloc and len(referer.path) > 1 and
            '.html' not in referer_s and 'wp-admin' not in referer_s and
            'preview=true' not in referer_s and 'how-to' not in referer_s and
            'grapher' not in referer_s and 'about' not in referer_s and 'roser/' not in referer_s
            and 'slides' not in referer_s and 'blog' not in referer_s):
            origin_url = 'https://' + root.netloc + referer.path
            if chart.origin_url != origin_url:
                chart.origin_url = origin_url
                chart.save()

    configfile = chart.get_config()
    canonicalurl = request.build_absolute_uri('/grapher/') + chart.slug
    baseurl = request.build_absolute_uri('/grapher/') + chart.slug

    chartmeta = {}

    title = configfile['title']
    title = re.sub("/, \*time\*/", "", title)
    title = re.sub("/\*time\*/", "", title)
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
        imagequery = query_string + '&' + "v=" + chart.make_cache_tag()
    else:
        imagequery = "v=" + chart.make_cache_tag()

    chartmeta['imageUrl'] = baseurl + '.png?' + imagequery

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
    except ValueError:
        intslug = None
    chart = Chart.objects.filter((Q(slug=slug) | Q(pk=intslug)), published__isnull=False).first()
    if not chart:
        redirect_chart = ChartSlugRedirect.objects.filter(slug=slug).first()
        if redirect_chart:
            chart = Chart.objects.filter(pk=redirect_chart.chart_id, published__isnull=False).first()

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


def config(request, configid):
    """
    :param request: Request object
    :param configid: id of the config.js file being requested
    :return: config.js file
    """

    chartid = int(configid)
    try:
        chartobj = Chart.objects.get(pk=chartid)
    except Chart.DoesNotExist:
        return HttpResponseNotFound('Config file does not exist!')

    configdict = chartobj.get_config()
    configdict['variableCacheTag'] = chartobj.make_cache_tag()

    configfile = 'App.loadChart(' + json.dumps(configdict) + ')'

    response = HttpResponse(configfile, content_type="application/javascript")
    response['Cache-Control'] = 'public, max-age=0, s-maxage=604800'

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
    varids = []
    meta = {}
    entitykey = {}
    meta['variables'] = {}
    meta['license'] = License.objects.values().first()
    meta['license']['created_at'] = str(meta['license']['created_at'])
    meta['license']['updated_at'] = str(meta['license']['updated_at'])

    for each in ids.split('+'):
        varids.append(int(each))

    varids = sorted(varids)

    with connection.cursor() as cursor:
        cursor.execute("SELECT variables.id as var_id, variables.name as var_name, variables.description as var_desc, "
                       "variables.unit as var_unit, variables.created_at, sources.name as source_name, "
                       "sources.description as source_desc, datasets.name as dataset_name "
                       "FROM variables "
                       "JOIN datasets on variables.fk_dst_id = datasets.id "
                       "LEFT JOIN sources on variables.sourceId = sources.id "
                       "WHERE variables.id IN %s;", [varids])

        varrows = dictfetchall(cursor)


    for each in varrows:
        source = {}
        source['name'] = each['source_name']
        source['description'] = each['source_desc']

        var = {}
        var['id'] = int(each['var_id'])
        var['name'] = each['var_name']
        var['dataset_name'] = each['dataset_name']
        var['created_at'] = str(each['created_at'])
        var['description'] = each['var_desc']
        var['unit'] = each['var_unit']
        var['source'] = source
        var['entities'] = []
        var['years'] = []
        var['values'] = []
        meta['variables'][int(each['var_id'])] = var

    varstring = ""

    with connection.cursor() as cursor:
        cursor.execute("SELECT value, year, fk_var_id as var_id, entities.id as entity_id, "
                       "entities.name as entity_name, entities.displayName as entity_displayName, "
                       "entities.code as entity_code "
                       "FROM data_values "
                       "LEFT JOIN entities ON data_values.fk_ent_id = entities.id "
                       "WHERE data_values.fk_var_id IN %s "
                       "ORDER BY var_id ASC,  year ASC;", [varids])
        rows = dictfetchall(cursor)

    seen_variables = {}
    for each in rows:
        if not seen_variables.get(each['var_id'], 0):
            seen_variables[each['var_id']] = 1
            varstring += "\r\n"
            varstring += str(each['var_id'])

        varstring += ';' + str(each['year']) + ',' + str(each['entity_id']) + ',' + str(each['value'])

        if not entitykey.get(str(each['entity_id']), 0):
            entitykey[str(each['entity_id'])] = {'name': each['entity_name'], 'code': each['entity_code']}

    varstring += "\r\n"

    response = HttpResponse(json.dumps(meta) + varstring + json.dumps(entitykey), content_type="text/plain")

    if get_query_string(request):
        response['Cache-Control'] = 'max-age=31536000 public'
    else:
        response['Cache-Control'] = 'no-cache'

    return response


def latest(request):
    """
    :param request: Request object
    :return: Redirects to the Chart page with the latest published chart
    """
    chart = Chart.objects.filter(published__isnull=False).order_by("-created_at").first()
    slug = chart.slug
    query = get_query_string(request)
    if query:
        slug += '?' + query
    return HttpResponseRedirect(reverse('showchart', args=[slug]))


def exportfile(request, slug, fileformat):
    """
    :param request: Request object
    :param slug: Chart slug
    :param fileformat: Requested format of the file: [png, svg, csv]
    :return: Returns the file for download
    """
    if fileformat not in ['csv', 'png', 'svg']:
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

    if fileformat == 'csv':
        chart = find_with_redirects(slug)
        if chart:
            configfile = json.loads(chart.config)
            allvariables = Variable.objects.all()
            allvardict = {}
            chartvarlist = []

            for var in allvariables:
                allvardict[var.pk] = {'id': var.pk, 'name': var.name}

            for chartvar in configfile['chart-dimensions']:
                if allvardict.get(int(chartvar['variableId']), 0):
                    chartvarlist.append(allvardict[int(chartvar['variableId'])])

            chartvarlist = sorted(chartvarlist, key=lambda k: k['id'])

            sql_query = 'SELECT maintable.entity as entity, maintable.year as year, maintable.country_code as country_code'

            table_counter = 1
            join_string = ''
            id_tuple = ''
            headerlist = ['Entity', 'Year', 'Country code']
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
            sql_query += ' FROM (SELECT fk_ent_id, entities.name as entity, year, entities.code as ' \
                         'country_code FROM data_values LEFT OUTER JOIN entities on data_values.fk_ent_id = entities.id ' \
                         'WHERE fk_var_id in (%s) ORDER BY entity, year, data_values.fk_var_id) as maintable ' % id_tuple

            sql_query += join_string + 'GROUP BY entity, year, country_code;'

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
            disposition = "attachment; filename=%s.csv" % slug
            response['Content-Disposition'] = disposition
            return response
        else:
            HttpResponseNotFound('No such chart!')
