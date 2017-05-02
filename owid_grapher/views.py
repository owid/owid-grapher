import os
import json
import re
import datetime
from urllib.parse import urlparse
from django import forms
from django.shortcuts import render
from django.conf import settings
from django.contrib import messages
from django.http import HttpResponse, HttpResponseNotFound, HttpResponseRedirect
from django.contrib.auth.decorators import login_required
from django.urls import reverse
from django.utils.crypto import get_random_string
from grapher_admin.models import Chart, Variable, License, DataValue, Entity, UserInvitation, User
from owid_grapher.forms import InviteUserForm, InvitedUserRegisterForm

# putting these into global scope for reuse
manifest = json.loads(open(os.path.join(settings.BASE_DIR, "public/build/manifest.json")).read())
jspath = "/build/%s" % (manifest['charts.js'])
csspath = "/build/%s" % (manifest['charts.css'])


@login_required
def index(request):
    return HttpResponse('This is a main page placeholder')


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

    rootrequest = request.build_absolute_uri('/')[:-1]  # removing that last slash from URL

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
        config = Chart.get_config_with_url(chart)
        canonicalurl = request.build_absolute_uri('/') + chart.slug
        baseurl = request.build_absolute_uri('/') + chart.slug
        rootrequest = request.build_absolute_uri('/')[:-1]  # removing that last slash from URL

        chartmeta = {}

        title = config['title']
        title = re.sub("/, \*time\*/", " over time", title)
        title = re.sub("/\*time\*/", "over time", title)
        chartmeta['title'] = title
        if config.get('subtitle', ''):
            chartmeta['description'] = config['subtitle']
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

        return render(request, 'grapher/show_chart.html', context={'chartmeta': chartmeta,
                                                                            'configpath': configpath,
                                                                            'jspath': jspath, 'csspath': csspath,
                                                                            'query': query_string,
                                                                            'rootrequest': rootrequest})
    else:
        return HttpResponseNotFound('No chart found to view')


@login_required
def show(request, slug):
    """
    :param request: Request object
    :param slug: Chart slug
    :return: Rendered Chart page
    """
    chart = Chart.find_with_redirects(slug)
    if not chart:
        return HttpResponseNotFound('No such chart!')
    return showchart(request, chart)


@login_required
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


@login_required
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

    # Using the DataValue model here temporarily for testing
    # Will switch to pure SQL soon
    for each in varids:
        varobj = DataValue.objects.filter(fk_var_id_id=each).select_related('fk_ent_id').order_by('year')

        varstring += str(each)
        for row in varobj:
            varstring += ';' + str(row.year) + ',' + str(row.fk_ent_id.pk) + ',' + str(row.value)
            if not entitykey.get(str(row.fk_ent_id.pk), 0):
                entitykey[str(row.fk_ent_id.pk)] = {'name': row.fk_ent_id.name, 'code': row.fk_ent_id.code}
        varstring += "\r\n"

    return HttpResponse(json.dumps(meta) + varstring + json.dumps(entitykey), content_type="text/plain")


@login_required
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
            return render(request, 'grapher/invite_user.html', context={'form': form})
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
                    return render(request, 'grapher/invite_user.html', context={'form': form})
                except User.DoesNotExist:
                    pass
                try:
                    newuser = User.objects.get(name=name)
                    messages.error(request, 'The user with that name is registered in the system.')
                    return render(request, 'grapher/invite_user.html', context={'form': form})
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
                invitation.valid_till = datetime.datetime.now() + datetime.timedelta(days=2)
                invitation.save()
                newuser.email_user('Invitation to join OWID', 'Hi %s, please follow this link in order '
                                                              'to register on owid-grapher: %s' % (newuser.name, settings.BASE_URL + '/invitation/' + invitation.code),
                                   'no-reply@ourworldindata.org')
                return HttpResponse('Invite was sent successfully!')
            else:
                return render(request, 'grapher/invite_user.html', context={'form': form})


def register_by_invite(request, code):
    try:
        invite = UserInvitation.objects.get(code=code)
    except UserInvitation.DoesNotExist:
        return HttpResponseNotFound('Your invitation code does not exist in the system.')
    newuser = invite.user_id

    if request.method == 'GET':
        if invite.status == 'successful':
            return HttpResponse('Your invitation code has already been used.')
        if invite.status == 'expired':
            return HttpResponse('Your invitation code has expired.')
        if invite.status == 'cancelled':
            return HttpResponse('Your invitation code has been cancelled.')
        form = InvitedUserRegisterForm(data={'name': newuser.name})
        return render(request, 'grapher/register_invited_user.html', context={'form': form})
    if request.method == 'POST':
        form = InvitedUserRegisterForm(request.POST)
        if form.is_valid():
            name = form.cleaned_data['name']
            try:
                newuser = User.objects.get(name=name)
                messages.error(request, 'The username you chose is not available. Please choose another username.')
                return render(request, 'grapher/register_invited_user.html', context={'form': form})
            except User.DoesNotExist:
                pass
            if form.cleaned_data['password1'] == form.cleaned_data['password2']:
                newuser.name = name
                newuser.set_password(form.cleaned_data['password1'])
                newuser.is_active = True
                newuser.save()
                return HttpResponseRedirect(reverse("login"))
            else:
                messages.error(request, "Passwords don't match!")
                return render(request, 'grapher/register_invited_user.html', context={'form': form})
