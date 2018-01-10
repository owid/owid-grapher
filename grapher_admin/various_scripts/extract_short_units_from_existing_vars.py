import os
import sys
sys.path.insert(1, os.path.join(sys.path[0], '../..'))
import grapher_admin.wsgi
from grapher_admin.models import Variable

# use this script to extract and write short forms of unit of measurement for all variables that already exit in the db

common_short_units = ['$', '£', '€', '%']

all_variables = Variable.objects.filter(fk_dst_id__namespace='wdi')

for each in all_variables:
    if each.unit and not each.short_unit:
        if ' per ' in each.unit:
            short_form = each.unit.split(' per ')[0]
            if any(w in short_form for w in common_short_units):
                for x in common_short_units:
                    if x in short_form:
                        each.short_unit = x
                        each.save()
                        break
            else:
                each.short_unit = short_form
                each.save()
        elif any(x in each.unit for x in common_short_units):
            for y in common_short_units:
                if y in each.unit:
                    each.short_unit = y
                    each.save()
                    break
        elif len(each.unit) < 9:  # this length is sort of arbitrary at this point, taken from the unit 'hectares'
            each.short_unit = each.unit
            each.save()
