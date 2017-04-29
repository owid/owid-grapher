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
from django.contrib.auth.views import login

urlpatterns = [
    url(r'^admin/', include(admin.site.urls)),
    url(r'^accounts/login/$', login, {'template_name': 'admin/login.html'}, name='login'),
    url(r'^config/(?P<configid>.+\.js)$', views.config, name="serveconfig"),
    url(r'^data/variables/(?P<ids>[\w\+]+)', views.variables, name="servevariables"),
    url(r'^latest/$', views.latest, name="latestchart"),
    url(r'^testall', views.test_all, name="testall"),
    url(r'^(?P<slug>.+)/$', views.show, name="showchart"),
]
