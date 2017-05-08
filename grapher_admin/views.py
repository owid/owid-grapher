import copy
import datetime
import json
import os
import re
from urllib.parse import urlparse
from django.conf import settings
from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.contrib.auth.views import login as loginview
from django.db.models import Q
from django.http import HttpResponseRedirect, HttpResponse, HttpResponseNotFound, JsonResponse, QueryDict
from django.template.response import TemplateResponse
from django.shortcuts import render
from django.urls import reverse
from django.utils import timezone
from django.utils.crypto import get_random_string
from .forms import InviteUserForm, InvitedUserRegisterForm
from .models import Chart, Variable, User, UserInvitation, Logo, ChartSlugRedirect, ChartDimension, Dataset, Setting, DatasetSubcategory, Entity
from owid_grapher.views import get_query_string

# putting these into global scope for reuse
manifest = json.loads(open(os.path.join(settings.BASE_DIR, "public/build/manifest.json")).read())
jspath = "/build/%s" % (manifest['charts.js'])
csspath = "/build/%s" % (manifest['charts.css'])
adminjspath = "/build/%s" % (manifest['admin.js'])
admincsspath = "/build/%s" % (manifest['admin.css'])
rootrequest = settings.BASE_URL


def custom_login(request):
    """
    Redirects to index page if the user is already logged in
    :param request: Request object
    :return: Redirects to index page if the user is logged in, otherwise will show the login page
    """
    if request.user.is_authenticated():
        return HttpResponseRedirect('/')
    else:
        return loginview(request)


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
        each['id'] = chart.pk
        each['published'] = chart.published
        each['starred'] = chart.starred
        each['name'] = chart.name
        each['type'] = chart.type
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
        return render(request, 'admin.charts.html', context={'adminjspath': adminjspath,
                                                             'admincsspath': admincsspath,
                                                             'rootrequest': rootrequest,
                                                             'current_user': request.user.name,
                                                             'charts': chartlist
                                                             })


@login_required
def storechart(request):
    if request.method == 'POST':
        chart = Chart()
        data = json.loads(request.body)
        return savechart(chart, data, request.user)
    else:
        return HttpResponseRedirect(reverse('listcharts'))


@login_required
def createchart(request):

    data = editor_data()
    logos = []
    for each in list(Logo.objects.filter(name='OWD')):
        logos.append(each.svg)

    chartconfig = {}
    chartconfig['logosSVG'] = logos
    chartconfig = json.dumps(chartconfig)

    if '.json' in urlparse(request.get_full_path()).path:
        return JsonResponse({'data': data, 'config': chartconfig}, safe=False)
    else:
        return render(request, 'admin.edit_chart.html', context={'adminjspath': adminjspath,
                                                                 'admincsspath': admincsspath,
                                                                 'rootrequest': rootrequest,
                                                                 'current_user': request.user.name,
                                                                 'data': data, 'chartconfig': chartconfig
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
            newresult['name'] = result['dataset'] + result['name']

        optgroups[newresult['subcategory']]['variables'].append(newresult)

    data['optgroups'] = optgroups
    return data


@login_required
def editchart(request, chartid):
    try:
        chartid = int(chartid)
    except ValueError:
        return HttpResponseNotFound('Invalid chart id!')

    try:
        chart = Chart.objects.get(pk=chartid)
    except Chart.DoesNotExist:
        return HttpResponseNotFound('Invalid chart id!')

    data = editor_data()
    chartconfig = json.dumps(chart.get_config_with_url())

    if '.json' in urlparse(request.get_full_path()).path:
        return JsonResponse({'data': data, 'config': chartconfig}, safe=False)
    else:
        return render(request, 'admin.edit_chart.html', context={'adminjspath': adminjspath,
                                                            'admincsspath': admincsspath,
                                                            'rootrequest': rootrequest,
                                                            'current_user': request.user.name,
                                                            'data': data, 'chartconfig': chartconfig})


def savechart(chart, data, user):
    if data.get('published', 0):
        if ChartSlugRedirect.objects.filter(~Q(chart_id=chart.pk)).filter(Q(slug=data['slug'])):
            return HttpResponse("This chart slug was previously used by another chart: %s" % data["slug"], status=402)
        elif Chart.objects.filter(~Q(pk=chart.pk)).filter(Q(slug=data['slug'])):
            return HttpResponse("This chart slug is currently in use by another chart: %s" % data["slug"], status=402)
        elif chart.published and chart.slug and chart.slug != data['slug']:
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
        newdim.chartid = chart
        newdim.color = dim.get('color', "")
        newdim.tolerance = dim.get('tolerance', None)
        newdim.targetyear = dim.get('targetYear', None)
        newdim.displayname = dim.get('displayName', "")
        newdim.unit = dim.get('unit', None)
        newdim.property = dim.get('property', None)
        newdim.variableid = Variable.objects.get(pk=int(dim.get('variableId', None)))
        dims.append(newdim)
        i += 1

    """
    TO DO: Implement png and svg file purging
    """

    """
    TO DO: Cloudflare cache invalidation
    """

    for each in ChartDimension.objects.filter(chartid=chart.pk):
        each.delete()
    for each in dims:
        each.save()

    return JsonResponse({'success': True, 'data': {'id': chart.pk}}, safe=False)


@login_required
def managechart(request, chartid):
    try:
        chart = Chart.objects.get(pk=int(chartid))
    except Chart.DoesNotExist:
        return HttpResponseNotFound('No such chart!')
    except ValueError:
        return HttpResponseNotFound('No such chart!')
    if request.method == 'PUT':
        data = json.loads(request.body)
        return savechart(chart, data, request.user)
    if request.method == 'POST':
        data = QueryDict(request.body)
        if data.get('_method', '0') == 'DELETE':
            chart.delete()
            messages.success(request, 'Chart deleted successfully')
        return HttpResponseRedirect(reverse('listcharts'))
    if request.method == 'GET':
        return HttpResponseRedirect(reverse('showchartinternal', args=(chartid,)))


@login_required
def showchart(request, chartid):
    try:
        chart = Chart.objects.get(pk=int(chartid))
    except Chart.DoesNotExist:
        return HttpResponseNotFound('No such chart!')
    except ValueError:
        return HttpResponseNotFound('No such chart!')
    if request.method != 'GET':
        return JsonResponse(chart.get_config_with_url(), safe=False)
    else:
        # this part was lifted directly from the public facing side
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

        response = TemplateResponse(request, 'show_chart.html',
                                    context={'chartmeta': chartmeta, 'configpath': configpath,
                                             'jspath': jspath, 'csspath': csspath,
                                             'query': query_string,
                                             'rootrequest': rootrequest})
        return response


@login_required
def starchart(request, chartid):
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
def unstarchart(request, chartid):
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
def importdata(request):
    datasets = Dataset.objects.filter(namespace='owid').order_by('name').values()
    datasetlist = []
    for each in datasets:
        each['created_at'] = str(each['created_at'])
        each['updated_at'] = str(each['updated_at'])
        each['fk_dst_cat_id'] = each['fk_dst_cat_id_id']
        each['fk_dst_subcat_id'] = each['fk_dst_subcat_id_id']
        each.pop('fk_dst_subcat_id_id', None)
        each.pop('fk_dst_cat_id_id', None)
        datasetlist.append(each)

    vartypes = Variable.objects.values()
    vartypeslist = []
    for each in vartypes:
        each['fk_dst_id'] = each['fk_dst_id_id']
        each['fk_var_type_id'] = each['fk_var_type_id_id']
        each['sourceId'] = each['sourceid_id']
        each['uploaded_by'] = each['uploaded_by_id']
        each.pop('fk_dst_id_id', None)
        each.pop('fk_var_type_id_id', None)
        each.pop('sourceid_id', None)
        each.pop('uploaded_by_id', None)
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

    data = json.dumps({'datasets': datasetlist, 'categories': category_list, 'varTypes': vartypeslist, 'sourceTemplate': source_template,
            'entityNames': all_entitynames})

    return render(request, 'admin.importer.html', context={'adminjspath': adminjspath,
                                                           'admincsspath': admincsspath,
                                                           'rootrequest': rootrequest,
                                                           'current_user': request.user.name,
                                                           'importerdata': data})


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

    if '.json' in urlparse(request.get_full_path()).path:
        return JsonResponse(userlist, safe=False)
    else:
        return render(request, 'admin.users.html', context={'adminjspath': adminjspath,
                                                                'admincsspath': admincsspath,
                                                                'rootrequest': rootrequest,
                                                                'current_user': request.user.name,
                                                                'users': userlist
                                                                })


@login_required
def invite_user(request):
    if request.method == 'GET':
        if not request.user.is_superuser:
            return HttpResponse('Permission denied!')
        else:
            form = InviteUserForm()
            return render(request, 'admin.invite_user.html', context={'form': form, 'adminjspath': adminjspath,
                                                                 'admincsspath': admincsspath,
                                                                 'rootrequest': rootrequest,
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
                    return render(request, 'admin.invite_user.html', context={'form': form, 'adminjspath': adminjspath,
                                                                 'admincsspath': admincsspath,
                                                                 'rootrequest': rootrequest,
                                                                 'current_user': request.user.name})
                except User.DoesNotExist:
                    pass
                try:
                    newuser = User.objects.get(name=name)
                    messages.error(request, 'The user with that name is registered in the system.')
                    return render(request, 'admin.invite_user.html', context={'form': form, 'adminjspath': adminjspath,
                                                                 'admincsspath': admincsspath,
                                                                 'rootrequest': rootrequest,
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
                                   (newuser.name, settings.BASE_URL + reverse('registerbyinvite', args=[invitation.code])),
                                   'no-reply@ourworldindata.org')
                messages.success(request, 'The invite was sent successfully.')
                return render(request, 'admin.invite_user.html', context={'form': InviteUserForm(), 'adminjspath': adminjspath,
                                                                            'admincsspath': admincsspath,
                                                                            'rootrequest': rootrequest,
                                                                            'current_user': request.user.name, })
            else:
                return render(request, 'admin.invite_user.html', context={'form': form, 'adminjspath': adminjspath,
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