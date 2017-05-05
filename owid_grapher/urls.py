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
from grapher_admin import views as admin_views
from owid_grapher import views as owid_views
from django.contrib.auth.views import logout

urlpatterns = [
    url(r'^$', owid_views.index, name="index"),
    url(r'^charts/$',  admin_views.listcharts, name="listcharts"),
    url(r'^users/$', admin_views.listusers, name="listusers"),
    url(r'^login/$', admin_views.custom_login, name='login'),
    url(r'^logout/$', logout, {'next_page': '/'}, name="logout"),
    url(r'^config/(?P<configid>.+\.js)$', owid_views.config, name="serveconfig"),
    url(r'^data/variables/(?P<ids>[\w\+]+)', owid_views.variables, name="servevariables"),
    url(r'^latest/$', owid_views.latest, name="latestchart"),
    url(r'^testall', owid_views.test_all, name="testall"),
    url(r'^invite/$', admin_views.invite_user, name="inviteuser"),
    url(r'^invitation/(?P<code>[\w]+)$', admin_views.register_by_invite, name="registerbyinvite"),
    url(r'^(?P<slug>.+)\.export', owid_views.show, name="exportchart"),
    url(r'^(?P<slug>.+)\.(?P<fileformat>.+)', owid_views.exportfile, name="exportfile"),
    url(r'^(?P<slug>.+)/$', owid_views.show, name="showchart"),
]
