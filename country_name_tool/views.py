import csv
import json
import country_name_tool
import os
import random
import string
import unidecode
from fuzzywuzzy import fuzz
from io import StringIO
from django.shortcuts import render
from django.http import HttpResponse, JsonResponse
from django.urls import reverse
from .forms import StandardizeCountries, UploadNewData
from .models import Continent, CountryData, CountryName
from django.db import transaction
from django.conf import settings
from django.contrib import messages
from django.contrib.auth.decorators import login_required


def randomword(length):
   return ''.join(random.choice(string.ascii_lowercase) for i in range(length))


def process_countries(country_list, input_type, output_type):

    result_list = []

    if input_type == 'country_name':
        all_country_names = CountryName.objects.all()
        all_owid_country_names = CountryData.objects.values('id', 'owid_name')
        all_country_dict = {}
        for each in all_country_names:
            all_country_dict[each.country_name.lower()] = each.owid_country
    else:
        all_country_names = CountryData.objects.all()
        all_country_dict = {}
        if input_type == 'owid_name':
            for each in all_country_names:
                all_country_dict[each.owid_name] = each
        if input_type == 'owid_code':
            for each in all_country_names:
                all_country_dict[each.owid_code] = each
        if input_type == 'iso_alpha3':
            for each in all_country_names:
                all_country_dict[each.iso_alpha3] = each
        if input_type == 'iso_alpha2':
            for each in all_country_names:
                all_country_dict[each.iso_alpha2] = each
        if input_type == 'imf_code':
            for each in all_country_names:
                all_country_dict[str(each.imf_code)] = each
        if input_type == 'cow_letter':
            for each in all_country_names:
                all_country_dict[each.cow_letter] = each
        if input_type == 'cow_code':
            for each in all_country_names:
                all_country_dict[str(each.cow_code)] = each
        if input_type == 'unctad_code':
            for each in all_country_names:
                all_country_dict[each.unctad_code] = each
        if input_type == 'marc_code':
            for each in all_country_names:
                all_country_dict[each.marc_code] = each
        if input_type == 'ncd_code':
            for each in all_country_names:
                all_country_dict[each.ncd_code] = each
        if input_type == 'kansas_code':
            for each in all_country_names:
                all_country_dict[each.kansas_code] = each
        if input_type == 'penn_code':
            for each in all_country_names:
                all_country_dict[each.penn_code] = each

    for each in country_list:
        if input_type == 'country_name':
            if all_country_dict.get(unidecode.unidecode(each.lower()), 0):
                result_list.append({'matched': True, 'country': all_country_dict[unidecode.unidecode(each.lower())].owid_name})
            else:
                result_list.append({'matched': False, 'country': []})
                for one in all_owid_country_names:
                    result_list[len(result_list)-1]['country'].append({'score': fuzz.partial_ratio(each, one['owid_name']), 'countryid': one['id']})
                result_list[len(result_list)-1]['country'] = sorted(result_list[len(result_list)-1]['country'], key=lambda x: x['score'], reverse=True)
        else:
            if all_country_dict.get(each, 0):
                if output_type == 'owid_name':
                    if all_country_dict[each].owid_name:
                        result_list.append(all_country_dict[each].owid_name)
                    else:
                        result_list.append('')
                if output_type == 'owid_code':
                    if all_country_dict[each].owid_code:
                        result_list.append(all_country_dict[each].owid_code)
                    else:
                        result_list.append('')
                if output_type == 'iso_alpha2':
                    if all_country_dict[each].iso_alpha2:
                        result_list.append(all_country_dict[each].iso_alpha2)
                    else:
                        result_list.append('')
                if output_type == 'iso_alpha3':
                    if all_country_dict[each].iso_alpha3:
                        result_list.append(all_country_dict[each].iso_alpha3)
                    else:
                        result_list.append('')
                if output_type == 'continent_name':
                    if all_country_dict[each].continent.continent_name:
                        result_list.append(all_country_dict[each].continent.continent_name)
                    else:
                        result_list.append('')
                if output_type == 'continent_code':
                    if all_country_dict[each].continent.continent_code:
                        result_list.append(all_country_dict[each].continent.continent_code)
                    else:
                        result_list.append('')
                if output_type == 'imf_code':
                    if all_country_dict[each].imf_code:
                        result_list.append(all_country_dict[each].imf_code)
                    else:
                        result_list.append('')
                if output_type == 'cow_letter':
                    if all_country_dict[each].cow_letter:
                        result_list.append(all_country_dict[each].cow_letter)
                    else:
                        result_list.append('')
                if output_type == 'cow_code':
                    if all_country_dict[each].cow_code:
                        result_list.append(all_country_dict[each].cow_code)
                    else:
                        result_list.append('')
                if output_type == 'unctad_code':
                    if all_country_dict[each].unctad_code:
                        result_list.append(all_country_dict[each].unctad_code)
                    else:
                        result_list.append('')
                if output_type == 'marc_code':
                    if all_country_dict[each].marc_code:
                        result_list.append(all_country_dict[each].marc_code)
                    else:
                        result_list.append('')
                if output_type == 'ncd_code':
                    if all_country_dict[each].ncd_code:
                        result_list.append(all_country_dict[each].ncd_code)
                    else:
                        result_list.append('')
                if output_type == 'kansas_code':
                    if all_country_dict[each].kansas_code:
                        result_list.append(all_country_dict[each].kansas_code)
                    else:
                        result_list.append('')
                if output_type == 'penn_code':
                    if all_country_dict[each].penn_code:
                        result_list.append(all_country_dict[each].penn_code)
                    else:
                        result_list.append('')
            else:
                result_list.append('')

    return result_list


def country_tool_page(request):
    if request.method == 'GET':
        form = StandardizeCountries()
        return render(request, 'country_tool.index.html', context={'current_user': request.user.name, 'form': form})
    if request.method == 'POST':
        form = StandardizeCountries(request.POST, request.FILES)
        if form.is_valid():
            country_list = []
            other_data = {}
            file = form.cleaned_data['file'].read()
            try:
                file = file.decode('utf-8')
            except UnicodeDecodeError:
                file = file.decode('latin1')
            file = '\n'.join(file.splitlines())
            input_type = form.cleaned_data['input_type']
            output_type = form.cleaned_data['output_type']
            result_type = form.cleaned_data['result_type']
            country_dict = csv.DictReader(StringIO(file))
            csv_headers = country_dict.fieldnames
            for each_header in csv_headers:
                if each_header != 'Country':
                    other_data[each_header] = []
            for row in country_dict:
                for each_header in csv_headers:
                    if each_header == 'Country':
                        country_list.append(row.get('Country', None))
                    else:
                        other_data[each_header].append(row.get(each_header, None))
            result_list = process_countries(country_list, input_type, output_type)

            results = []
            for i in range(0, len(result_list)):
                results.append({'original': country_list[i], 'new': result_list[i]})

            if input_type == 'country_name':
                data = []
                all_owid_country_names = CountryData.objects.values('id', 'owid_name')
                owid_countries_dict = {}
                for each in all_owid_country_names:
                    owid_countries_dict[each['id']] = each['owid_name']
                data.append(['Country', 'OWID_NAME'])
                for each_header in csv_headers:
                    if each_header != 'Country':
                        data[0].append(each_header)
                for i in range(0, len(results)):
                    data.append([results[i]['original'], results[i]['new']['country'] if results[i]['new']['matched'] else owid_countries_dict[results[i]['new']['country'][0]['countryid']]])
                    for each_header in csv_headers:
                        if each_header != 'Country':
                            data[i+1].append(other_data[each_header][i])
                    if results[i]['new']['matched']:
                        data[i + 1].append(1)
                    else:
                        data[i + 1].append(0)
                return render(request, 'country_tool.match.html',
                              context={'current_user': request.user.name, 'results': results, 'owid_countries_dict': owid_countries_dict, 'data': json.dumps(data)})

            if result_type == 'display':
                return render(request, 'country_tool.show.html', context={'current_user': request.user.name, 'results': results})
            if result_type == 'file':
                response = HttpResponse(content_type='text/csv')
                response['Content-Disposition'] = 'attachment; filename="countries.csv"'

                writer = csv.writer(response)
                writer.writerow(['Original country name', 'Standardized'])
                c = 0

                for each in country_list:
                    writer.writerow([country_list[c], result_list[c]])
                    c += 1

                return response
        else:
            return render(request, 'country_tool.index.html', context={'current_user': request.user.name, 'form': form})


def country_tool_update(request):
    if request.method == 'GET':
        form = UploadNewData()
        return render(request, 'country_tool.update.html', context={'current_user': request.user.name, 'form': form})
    if request.method == 'POST':
        form = UploadNewData(request.POST, request.FILES)
        if form.is_valid():
            try:
                with transaction.atomic():
                    CountryName.objects.all().delete()
                    CountryData.objects.all().delete()
                    file = form.cleaned_data['file'].read().decode('utf-8')
                    country_dict = csv.DictReader(StringIO(file))
                    seen_countries = {}
                    for row in country_dict:
                        if not seen_countries.get(row['owid_name'], 0):
                            newcountry = CountryData()
                            newcountry.owid_name = row['owid_name']
                            if row.get('owid_code', 0):
                                newcountry.owid_code = row['owid_code']
                            if row.get('iso_alpha2', 0):
                                newcountry.iso_alpha2 = row['iso_alpha2']
                            if row.get('iso_alpha3', 0):
                                newcountry.iso_alpha3 = row['iso_alpha3']
                            if row.get('imf_code', 0):
                                newcountry.imf_code = int(row['imf_code'])
                            if row.get('cow_letter', 0):
                                newcountry.cow_letter = row['cow_letter']
                            if row.get('cow_code', 0):
                                newcountry.cow_code = int(row['cow_code'])
                            if row.get('unctad_code', 0):
                                newcountry.unctad_code = row['unctad_code']
                            if row.get('marc_code', 0):
                                newcountry.marc_code = row['marc_code']
                            if row.get('ncd_code', 0):
                                newcountry.ncd_code = row['ncd_code']
                            if row.get('kansas_code', 0):
                                newcountry.kansas_code = row['kansas_code']
                            if row.get('penn_code', 0):
                                newcountry.penn_code = row['penn_code']
                            if row.get('continent', 0):
                                if row['continent'] == 'NA':
                                    newcountry.continent = Continent.objects.get(pk=1)
                                if row['continent'] == 'AS':
                                    newcountry.continent = Continent.objects.get(pk=2)
                                if row['continent'] == 'AF':
                                    newcountry.continent = Continent.objects.get(pk=3)
                                if row['continent'] == 'EU':
                                    newcountry.continent = Continent.objects.get(pk=4)
                                if row['continent'] == 'SA':
                                    newcountry.continent = Continent.objects.get(pk=5)
                                if row['continent'] == 'OC':
                                    newcountry.continent = Continent.objects.get(pk=6)
                                if row['continent'] == 'AN':
                                    newcountry.continent = Continent.objects.get(pk=7)
                            try:
                                newcountry.save()
                            except Exception as e:
                                if len(e.args) > 1:
                                    error_m = str(e.args[0]) + ' ' + str(e.args[1])
                                else:
                                    error_m = e.args[0]
                                messages.error(request, error_m)
                                return render(request, 'country_tool.update.html',
                                              context={'current_user': request.user.name, 'form': form})
                            newname = CountryName()
                            newname.country_name = row['country_name']
                            newname.owid_country = newcountry
                            try:
                                newname.save()
                            except Exception as e:
                                if len(e.args) > 1:
                                    error_m = str(e.args[0]) + ' ' + str(e.args[1])
                                else:
                                    error_m = e.args[0]
                                messages.error(request, error_m)
                                return render(request, 'country_tool.update.html',
                                              context={'current_user': request.user.name, 'form': form})
                            seen_countries[row['owid_name']] = 1
                        else:
                            country = CountryData.objects.filter(owid_name=row['owid_name'])[0]
                            newname = CountryName()
                            newname.country_name = row['country_name']
                            newname.owid_country = country
                            try:
                                newname.save()
                            except Exception as e:
                                if len(e.args) > 1:
                                    error_m = str(e.args[0]) + ' ' + str(e.args[1])
                                else:
                                    error_m = e.args[0]
                                messages.error(request, error_m)
                                return render(request, 'country_tool.update.html',
                                              context={'current_user': request.user.name, 'form': form})
                    messages.success(request, 'Data Updated!')
                    return render(request, 'country_tool.update.html',
                                  context={'current_user': request.user.name, 'form': form})
            except Exception as e:
                return render(request, 'country_tool.update.html',
                              context={'current_user': request.user.name, 'form': form})

        else:
            return render(request, 'country_tool.update.html', context={'current_user': request.user.name, 'form': form})


def newcountrynames(request):
    country_tool_csv_save_location = settings.BASE_DIR + '/data/country_tool/csvs/'
    if not os.path.exists(country_tool_csv_save_location):
        os.makedirs(country_tool_csv_save_location)
    if request.method == 'POST':
        json_data = json.loads(request.body)
        csv_headers = json_data[0][1:]
        csv_list = []

        for i in range(1, len(json_data)):
            if json_data[i][len(json_data[i]) - 1]:
                csv_list.append(json_data[i][1:-1])
            else:
                new_country_name = CountryName()
                owid_country_name = CountryData.objects.filter(owid_name=json_data[i][1])
                if not owid_country_name:
                    owid_country_name = CountryData(owid_name=json_data[i][1])
                    owid_country_name.save()
                else:
                    owid_country_name = owid_country_name[0]
                new_country_name.country_name = json_data[i][0]
                new_country_name.owid_country = owid_country_name
                new_country_name.save()
                csv_list.append(json_data[i][1:-1])

        filename = randomword(8) + '.csv'
        file = os.path.join(country_tool_csv_save_location, filename)

        with open(file, 'w') as f:
            writer = csv.writer(f)
            writer.writerow(csv_headers)

            for each in csv_list:
                writer.writerow(each)

        return JsonResponse({'filename': reverse("servecsv", args=[filename])}, safe=False)


def servecsv(request, filename):
    country_tool_csv_save_location = settings.BASE_DIR + '/data/country_tool/csvs/'
    if os.path.isfile(os.path.join(country_tool_csv_save_location, filename)):
        response = HttpResponse(content_type='text/csv')
        response['Content-Disposition'] = 'attachment; filename="%s"' % filename
        with open(os.path.join(country_tool_csv_save_location, filename), 'r') as f:
            response.write(f.read())
        return response
