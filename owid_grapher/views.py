import os
import json
import re
import datetime
import urllib
from io import StringIO
import csv
from urllib.parse import urlparse
from django import forms
from django.shortcuts import render, redirect
from django.conf import settings
from django.contrib import messages
from django.db import connection
from django.db.models import Q
from django.http import HttpResponse, HttpResponseNotFound, HttpResponseRedirect, StreamingHttpResponse
from django.contrib.auth.decorators import login_required
from django.urls import reverse
from django.utils import timezone
from django.utils.crypto import get_random_string
from django.utils.encoding import smart_str
from grapher_admin.models import Chart, Variable, License, UserInvitation, User, ChartSlugRedirect
from owid_grapher.forms import InviteUserForm, InvitedUserRegisterForm

# putting these into global scope for reuse
manifest = json.loads(open(os.path.join(settings.BASE_DIR, "public/build/manifest.json")).read())
jspath = "/build/%s" % (manifest['charts.js'])
csspath = "/build/%s" % (manifest['charts.css'])
adminjspath = "/build/%s" % (manifest['admin.js'])
admincsspath = "/build/%s" % (manifest['admin.css'])
rootrequest = settings.BASE_URL


@login_required
def index(request):
    return redirect('listcharts')


def check_invitation_statuses():
    invites = UserInvitation.objects.filter(status='pending')
    for each in invites:
        if each.valid_till <= timezone.now():
            each.status = 'expired'
            each.save()


@login_required
def listusers(request):
    check_invitation_statuses()
    users = User.objects.all().order_by('created_at')
    userlist = []

    for each in users:
        userlist.append({'name': each.name, 'created_at': each.created_at})

    return render(request, 'grapher/admin.users.html', context={'adminjspath': adminjspath,
                                                                'admincsspath': admincsspath,
                                                                'rootrequest': rootrequest,
                                                                'current_user': request.user.name,
                                                                'users': userlist,
                                                                })


@login_required
def listcharts(request):
    charts = Chart.objects.all().order_by('-last_edited_at')
    allvariables = Variable.objects.all()
    vardict = {}
    for var in allvariables:
        vardict[var.pk] = {'id': var.pk, 'name': var.name}

    chartlist = []
    for chart in charts:
        each = {}
        each['published'] = chart.published
        each['starred'] = chart.starred
        each['name'] = chart.name
        each['type'] = chart.type
        each['slug'] = chart.slug
        each['notes'] = chart.notes
        each['origin_url'] = chart.origin_url
        each['last_edited_at'] = chart.last_edited_at
        each['last_edited_by'] = chart.last_edited_by
        each['variables'] = []
        configfile = json.loads(chart.config)
        for chartvar in configfile['chart-dimensions']:
            if vardict.get(int(chartvar['variableId']), 0):
                each['variables'].append(vardict[int(chartvar['variableId'])])
        chartlist.append(each)
    return render(request, 'grapher/admin.charts.html', context={'adminjspath': adminjspath,
                                                                 'admincsspath': admincsspath,
                                                                 'rootrequest': rootrequest,
                                                                 'current_user': request.user.name,
                                                                 'charts': chartlist,
                                                                 })


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
        local_url = request.build_absolute_uri('/') + each.slug
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
            next_page_url = request.build_absolute_uri('/testall') + '?page=%s' % (test_page + 1) + '&' +\
                            query_string

    prev_page_url = None
    if test_page > 1:
        if not query_string:
            prev_page_url = request.get_full_path() + '?page=%s' % (test_page - 1)
        else:
            prev_page_url = request.build_absolute_uri('/testall') + '?page=%s' % (test_page - 1) + '&' +\
                            query_string

    starting_point = (test_page - 1) * charts_per_page
    end_point = ((test_page - 1) * charts_per_page) + charts_per_page
    links = urls[starting_point:end_point]

    return render(request, 'grapher/testall.html', context={'urls': links, 'next_page_url': next_page_url,
                                                            'prev_page_url': prev_page_url, 'compare': test_compare,
                                                            'jspath': jspath, 'csspath': csspath,
                                                            'rootrequest': rootrequest})


def get_query_string(request):
    """
    :param request: Request object
    :return: The URL query string
    """
    return urlparse(request.get_full_path()).query


def get_query_as_dict(request):
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
            and 'slides' not in referer_s and 'blog' not in referer_s and 'testall' not in referer_s):
            origin_url = 'https://' + root.netloc + referer.path
            if chart.origin_url != origin_url:
                chart.origin_url = origin_url
                chart.save()

    if chart:
        configfile = chart.get_config_with_url()
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

        return render(request, 'grapher/show_chart.html', context={'chartmeta': chartmeta,'configpath': configpath,
                                                                   'jspath': jspath, 'csspath': csspath,
                                                                   'query': query_string,
                                                                   'rootrequest': rootrequest})
    else:
        return HttpResponseNotFound('No chart found to view')


def find_with_redirects(slug):
    """
    :param slug: Slug for the requested Chart
    :return: Chart object
    """
    try:
        intslug = int(slug)
    except ValueError:
        intslug = None
    try:
        chart = Chart.objects.get((Q(slug=slug) | Q(pk=intslug)), published__isnull=False)
    except Chart.DoesNotExist:
        try:
            redirect_chart = ChartSlugRedirect.objects.get(slug=slug)
        except ChartSlugRedirect.DoesNotExist:
            return False
        chart = Chart.objects.get(pk=redirect_chart.chart_id, published__isnull=False)
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

    if '.js' not in configid:
        return HttpResponseNotFound('Nothing here')
    else:
        chartid = int(configid[:configid.find('.js')])
        try:
            chartobj = Chart.objects.get(pk=chartid)
        except Chart.DoesNotExist:
            return HttpResponseNotFound('Config file does not exist!')

        configdict = Chart.get_config_with_url(chartobj)
        configdict['variableCacheTag'] = chartobj.make_cache_tag()

        config = 'App.loadChart(' + json.dumps(configdict) + ')'

        response = HttpResponse(config, content_type="application/javascript")
        response['Cache-Control'] = 'public, max-age=0, s-maxage=604800'

        return response


def dictfetchall(cursor):
    "Return all rows from a cursor as a dict"
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

    varstring = ""

    with connection.cursor() as cursor:
        cursor.execute("SELECT value, year, fk_var_id_id as var_id, entities.id as entity_id, "
                       "entities.name as entity_name, entities.displayName as entity_displayName, "
                       "entities.code as entity_code "
                       "FROM data_values "
                       "LEFT JOIN entities ON data_values.fk_ent_id_id = entities.id "
                       "WHERE data_values.fk_var_id_id IN %s "
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

    return HttpResponse(json.dumps(meta) + varstring + json.dumps(entitykey), content_type="text/plain")


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


@login_required
def invite_user(request):
    if request.method == 'GET':
        if not request.user.is_superuser:
            return HttpResponse('Permission denied!')
        else:
            form = InviteUserForm()
            return render(request, 'grapher/invite_user.html', context={'form': form, 'adminjspath': adminjspath,
                                                                 'admincsspath': admincsspath,
                                                                 'rootrequest': rootrequest,
                                                                 'current_user': request.user.name,})
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
                    return render(request, 'grapher/invite_user.html', context={'form': form, 'adminjspath': adminjspath,
                                                                 'admincsspath': admincsspath,
                                                                 'rootrequest': rootrequest,
                                                                 'current_user': request.user.name,})
                except User.DoesNotExist:
                    pass
                try:
                    newuser = User.objects.get(name=name)
                    messages.error(request, 'The user with that name is registered in the system.')
                    return render(request, 'grapher/invite_user.html', context={'form': form, 'adminjspath': adminjspath,
                                                                 'admincsspath': admincsspath,
                                                                 'rootrequest': rootrequest,
                                                                 'current_user': request.user.name,})
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
                                   (newuser.name, settings.BASE_URL + reverse('registerbyinvite', args=[invitation.code])),
                                   'no-reply@ourworldindata.org')
                messages.success(request, 'The invite was sent successfully.')
                return render(request, 'grapher/invite_user.html', context={'form': InviteUserForm(), 'adminjspath': adminjspath,
                                                                            'admincsspath': admincsspath,
                                                                            'rootrequest': rootrequest,
                                                                            'current_user': request.user.name, })
            else:
                return render(request, 'grapher/invite_user.html', context={'form': form, 'adminjspath': adminjspath,
                                                                            'admincsspath': admincsspath,
                                                                            'rootrequest': rootrequest,
                                                                            'current_user': request.user.name, })


def register_by_invite(request, code):
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
        return render(request, 'grapher/register_invited_user.html', context={'form': form})
    if request.method == 'POST':
        form = InvitedUserRegisterForm(request.POST)
        if form.is_valid():
            name = form.cleaned_data['name']
            try:
                newuser = User.objects.get(name=name)
                if newuser != invited_user:
                    messages.error(request, 'The username you chose is not available. Please choose another username.')
                    return render(request, 'grapher/register_invited_user.html', context={'form': form})
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
                return render(request, 'grapher/register_invited_user.html', context={'form': form})
        else:
            return render(request, 'grapher/register_invited_user.html', context={'form': form})


def exportfile(request, slug, fileformat):
    if fileformat not in ['csv', 'png', 'svg']:
        return HttpResponseNotFound('Not Found.')
    if fileformat in ['png', 'svg']:
        chart = find_with_redirects(slug)
        querydict = get_query_as_dict(request)
        querystring = get_query_string(request)
        if 'size' in querystring:
            width = querydict['size'][0].split('x')[0]
            height = querydict['size'][0].split('x')[1]
        else:
            width = '1200'
            height = '800'
        if chart:
                downloadfile = chart.export_image(querystring, width, height, fileformat)

        with open(downloadfile, 'rb') as f:
            response = HttpResponse(f, content_type='application/force-download')
            response['Content-Disposition'] = 'attachment; filename=%s' % smart_str(slug + "." + fileformat)
            return response

    if fileformat == 'csv':
        try:
            chart = find_with_redirects(slug)
        except Chart.DoesNotExist:
            return HttpResponseNotFound('No such chart!')
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

            join_string += 'LEFT JOIN (SELECT * FROM data_values WHERE fk_var_id_id = %s) as table%s on ' \
                           'maintable.`fk_ent_id_id` = table%s.`fk_ent_id_id` and ' \
                           'maintable.year = table%s.year ' % (each['id'], table_counter, table_counter,
                                                               table_counter)

            table_counter += 1
            id_tuple += str(each['id']) + ','
            headerlist.append(each['name'])

        id_tuple = id_tuple[:-1]
        sql_query += ' FROM (SELECT fk_ent_id_id, entities.name as entity, year, entities.code as ' \
                     'country_code FROM data_values LEFT OUTER JOIN entities on data_values.fk_ent_id_id = entities.id ' \
                     'WHERE fk_var_id_id in (%s) ORDER BY entity, year, data_values.fk_var_id_id) as maintable ' % id_tuple

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
