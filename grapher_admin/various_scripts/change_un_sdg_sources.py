import os
import sys
sys.path.insert(1, os.path.join(sys.path[0], '../..'))
import grapher_admin.wsgi
from grapher_admin.models import Source, Variable
import unidecode
import json

count = 0

to_change = ['2.1.1', '2.1.2', '2.5.1', '2.5.2', '2.a.1', '2.c.1', '14.4.1', '15.1.1', '15.2.1', '15.4.2']
all_sdg_vars = Variable.objects.filter(datasetId__namespace='un_sdg')

for each in all_sdg_vars:
    for eachone in to_change:
        if each.name.startswith(eachone):
            count += 1
            source_desc = json.loads(each.sourceId.description)
            source_desc['dataPublishedBy'] = 'United Nations Food and Agriculture Division (FAO)'
            source_desc['link'] = 'http://www.fao.org/sustainable-development-goals/indicators/en/ \n https://unstats.un.org/sdgs/indicators/database/'
            each.sourceId.description = json.dumps(source_desc)
            each.sourceId.save()
    if each.name.startswith('6.1.1'):
        count += 1
        source_desc = json.loads(each.sourceId.description)
        source_desc['dataPublishedBy'] = 'WHO/UNICEF Joint Monitoring Programme for Water Supply, Sanitation and Hygiene (JMP)'
        source_desc[
            'link'] = 'https://washdata.org/ \n https://unstats.un.org/sdgs/indicators/database/'
        each.sourceId.description = json.dumps(source_desc)
        each.sourceId.save()

print(count)


