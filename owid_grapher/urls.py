"""owid_grapher URL Configuration

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/1.11/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  url(r'^$', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  url(r'^$', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.conf.urls import url, include
    2. Add a URL to urlpatterns:  url(r'^blog/', include('blog.urls'))
"""
from django.conf.urls import url, include
from django.contrib import admin
from owid_grapher import views
from django.contrib.auth.views import login, logout

urlpatterns = [
    url(r'^$', views.index, name="index"),
    url(r'^charts/$', views.listcharts, name="listcharts"),
    url(r'^users/$', views.listusers, name="listusers"),
    url(r'^admin/', include(admin.site.urls)),
    url(r'^login/$', login, {'template_name': 'grapher/login.html'}, name='login'),
    url(r'^logout/$', logout, {'next_page': '/'}, name="logout"),
    url(r'^config/(?P<configid>.+\.js)$', views.config, name="serveconfig"),
    url(r'^data/variables/(?P<ids>[\w\+]+)', views.variables, name="servevariables"),
    url(r'^latest/$', views.latest, name="latestchart"),
    url(r'^testall', views.test_all, name="testall"),
    url(r'^invite/$', views.invite_user, name="inviteuser"),
    url(r'^invitation/(?P<code>[\w]+)$', views.register_by_invite, name="registerbyinvite"),
    url(r'^(?P<slug>.+)\.export', views.show, name="exportchart"),
    url(r'^(?P<slug>.+)\.(?P<fileformat>.+)', views.exportfile, name="exportfile"),
    url(r'^(?P<slug>.+)/$', views.show, name="showchart"),
]
