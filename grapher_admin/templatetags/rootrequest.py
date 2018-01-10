from django import template
from django.conf import settings


register = template.Library()


@register.simple_tag
def rootrequest():
    return settings.BASE_URL
