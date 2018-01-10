from django import template
from django.conf import settings


register = template.Library()


@register.simple_tag
def isdebug():
    if settings.DEBUG:
        return 'true'
    else:
        return 'false'
