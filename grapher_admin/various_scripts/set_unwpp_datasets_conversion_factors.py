import os
import sys
sys.path.insert(1, os.path.join(sys.path[0], '../..'))
import grapher_admin.wsgi
from grapher_admin.models import Variable

# use this script to set the conversion factors for unwpp variables

all_unwpp_variables = Variable.objects.filter(datasetId__namespace__contains='unwpp')

for each in all_unwpp_variables:
    if each.unit == 'thousands':
        each.display['conversionFactor'] = 1000
        each.save()

