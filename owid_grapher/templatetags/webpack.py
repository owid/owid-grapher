from django import template
from django.template.defaultfilters import stringfilter
from django.conf import settings
from django.contrib.staticfiles.templatetags.staticfiles import static
import os
import json

register = template.Library()


@register.simple_tag
def webpack(asset_name: str) -> str:
    if settings.DEBUG:
        return f"http://localhost:8090/{asset_name}"
    else:
        # Read version-stamped urls from manifest.json once and cache for process lifetime
        if not hasattr(webpack, 'manifest'):
            webpack.manifest = json.loads(open(os.path.join(settings.BASE_DIR, "public/build/manifest.json")).read())
        return static(f"/build/" + webpack.manifest[asset_name])