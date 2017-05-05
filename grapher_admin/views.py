import datetime
import json
import os
from django.conf import settings
from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.contrib.auth.views import login as loginview
from django.http import HttpResponseRedirect, HttpResponse, HttpResponseNotFound
from django.shortcuts import render
from django.urls import reverse
from django.utils import timezone
from django.utils.crypto import get_random_string
from .forms import InviteUserForm, InvitedUserRegisterForm
from .models import Chart, Variable, User, UserInvitation

# putting these into global scope for reuse
manifest = json.loads(open(os.path.join(settings.BASE_DIR, "public/build/manifest.json")).read())
jspath = "/build/%s" % (manifest['charts.js'])
csspath = "/build/%s" % (manifest['charts.css'])
adminjspath = "/build/%s" % (manifest['admin.js'])
admincsspath = "/build/%s" % (manifest['admin.css'])
rootrequest = settings.BASE_URL


def custom_login(request):
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
    return render(request, 'admin.charts.html', context={'adminjspath': adminjspath,
                                                                 'admincsspath': admincsspath,
                                                                 'rootrequest': rootrequest,
                                                                 'current_user': request.user.name,
                                                                 'charts': chartlist
                                                                 })


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