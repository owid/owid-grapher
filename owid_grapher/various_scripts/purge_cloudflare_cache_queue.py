import os
import sys
sys.path.insert(1, os.path.join(sys.path[0], '../..'))
import owid_grapher.wsgi
from grapher_admin.models import CloudflarePurgeQueue
from django.conf import settings
import CloudFlare


def purge_cloudflare_cache_queue():
    all_urls = CloudflarePurgeQueue.objects.all().values('url')
    urls_to_purge = [item['url'] for item in all_urls]
    try:
        cf = CloudFlare.CloudFlare(email=settings.CLOUDFLARE_EMAIL, token=settings.CLOUDFLARE_KEY)
        cf.zones.purge_cache.delete(settings.CLOUDFLARE_ZONE_ID, data={"files": urls_to_purge})
        CloudflarePurgeQueue.objects.filter(url__in=urls_to_purge).delete()
    except CloudFlare.exceptions.CloudFlareAPIError:
        pass


purge_cloudflare_cache_queue()
