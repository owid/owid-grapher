import os
import sys
sys.path.insert(1, os.path.join(sys.path[0], '../..'))
import grapher_admin.wsgi
from grapher_admin.models import Source
import unidecode
import json

count = 0
all_sources = Source.objects.all()
for each in all_sources:
    if 'iea.org' in each.description.lower() or 'iea stat' in each.description.lower() or 'iea 2014' in each.description.lower():
        the_json = json.loads(each.description)
        if the_json['dataPublishedBy'] == 'World Bank – World Development Indicators':
            the_json['dataPublishedBy'] = 'International Energy Agency (IEA) via The World Bank'
            each.description = json.dumps(the_json)
            each.save()
        if the_json['dataPublishedBy'] == 'World Bank Climate Change Data':
            the_json['dataPublishedBy'] = 'International Energy Agency (IEA) via The World Bank'
            each.description = json.dumps(the_json)
            each.save()
        if the_json['dataPublishedBy'] == 'United Nations Environment Programme':
            the_json['dataPublishedBy'] = 'International Energy Agency (IEA) via United Nations Environment Programme'
            each.description = json.dumps(the_json)
            each.save()

        count += 1

print(count)
