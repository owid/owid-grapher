import os
import sys
sys.path.insert(1, os.path.join(sys.path[0], '../..'))
import owid_grapher.wsgi
from grapher_admin.models import CloudflarePurgeQueue
from django.conf import settings
import CloudFlare


def purge_cloudflare_cache_queue():
    while CloudflarePurgeQueue.objects.first():
        cf = CloudFlare.CloudFlare(email=settings.CLOUDFLARE_EMAIL, token=settings.CLOUDFLARE_KEY)
        counter = 0
        urls_to_purge = []
        url_objects_in_db = []
        all_urls = CloudflarePurgeQueue.objects.all()
        for oneurl in all_urls:
            urls_to_purge.append(oneurl.url)
            url_objects_in_db.append(oneurl)
            counter += 1
            if counter == 30:
                try:
                    cf.zones.purge_cache.delete(settings.CLOUDFLARE_ZONE_ID, data={"files": urls_to_purge})
                    CloudflarePurgeQueue.objects.filter(id__in=[item.pk for item in url_objects_in_db]).delete()
                except CloudFlare.exceptions.CloudFlareAPIError:  # one of the links caused an exception
                    for onelink in urls_to_purge:
                        try:
                            cf.zones.purge_cache.delete(settings.CLOUDFLARE_ZONE_ID, data={"files": [onelink]})
                            CloudflarePurgeQueue.objects.filter(url=onelink).delete()
                        except CloudFlare.exceptions.CloudFlareAPIError:
                            CloudflarePurgeQueue.objects.filter(url=onelink).delete()
                urls_to_purge = []
                url_objects_in_db = []
                break
        if urls_to_purge:
            try:
                cf.zones.purge_cache.delete(settings.CLOUDFLARE_ZONE_ID, data={"files": urls_to_purge})
                CloudflarePurgeQueue.objects.filter(id__in=[item.pk for item in url_objects_in_db]).delete()
            except CloudFlare.exceptions.CloudFlareAPIError:  # one of the links caused an exception
                for onelink in urls_to_purge:
                    try:
                        cf.zones.purge_cache.delete(settings.CLOUDFLARE_ZONE_ID, data={"files": [onelink]})
                        CloudflarePurgeQueue.objects.filter(url=onelink).delete()
                    except CloudFlare.exceptions.CloudFlareAPIError:
                        CloudflarePurgeQueue.objects.filter(url=onelink).delete()


if __name__ == "__main__":
    purge_cloudflare_cache_queue()
