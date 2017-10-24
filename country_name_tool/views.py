import csv
import json
import os
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


def contains_alphabetic(country_name: str):
    return any(each.isalpha() for each in country_name)


def process_countries(country_list, input_type, output_type):
    all_matched = True
    result_list = []

    if input_type == 'country_name' and output_type == 'owid_name':
        all_country_names = CountryName.objects.all()
        all_country_dict = {}
        for each in all_country_names:
            all_country_dict[each.country_name.lower()] = each.owid_country

        all_owid_country_names = CountryData.objects.values('id', 'owid_name')
        all_owid_country_names_dict = {each['id']: each['owid_name'] for each in all_owid_country_names}
        unique_country_names = {}
        for each in country_list:
            if "----custom_name----" not in each:
                if contains_alphabetic(each):
                    if each not in unique_country_names:
                        if all_country_dict.get(each.lower(), 0) and each.lower().strip() != 'micronesia':
                            result_list.append(
                                {'matched': True, 'country': all_country_dict[each.lower()].owid_name})
                            unique_country_names[each] = {'matched': True, 'country': all_country_dict[each.lower()].owid_name}
                        else:
                            all_matched = False
                            result_list.append({'matched': False, 'country': []})
                            scores_for_owid_names = {}
                            scores_for_variations = {}
                            for one in all_owid_country_names:
                                scores_for_owid_names[one['id']] = {'score': fuzz.partial_ratio(each.lower(), one['owid_name'].lower())}

                            for countryname, countryobject in all_country_dict.items():
                                if countryobject.pk in scores_for_variations:
                                    scores_for_variations[countryobject.pk]['score'] = (scores_for_variations[countryobject.pk][
                                                                                            'score'] + fuzz.partial_ratio(each.lower(),
                                                                                                                          countryname.lower())) / 2
                                else:
                                    scores_for_variations[countryobject.pk] = {
                                        'score': fuzz.partial_ratio(each.lower(), countryname.lower())}
                            for country_id, country_score in scores_for_owid_names.items():
                                result_list[len(result_list) - 1]['country'].append(
                                    {'score': (country_score['score'] +
                                               scores_for_variations.get(country_id, {'score': country_score['score']})['score']) / 2,
                                     'countryid': country_id})
                            result_list[len(result_list) - 1]['country'] = sorted(result_list[len(result_list) - 1]['country'],
                                                                           key=lambda x: x['score'], reverse=True)
                            unique_country_names[each] = result_list[len(result_list) - 1]
                    else:
                        result_list.append(unique_country_names[each])
                else:
                    result_list.append({'matched': True, 'country': each, 'nonalphanumeric': 1})
            else:
                result_list.append({'matched': True, 'country': each})
    else:
        all_country_names = CountryData.objects.all()
        all_country_dict = {}
        if input_type == 'country_name':
            for each in CountryName.objects.all():
                all_country_dict[each.country_name.lower()] = each.owid_country
        if input_type == 'owid_name':
            for each in all_country_names:
                if each.owid_name:
                    all_country_dict[each.owid_name.lower()] = each
        if input_type == 'iso_alpha3':
            for each in all_country_names:
                if each.iso_alpha3:
                    all_country_dict[each.iso_alpha3.lower()] = each
        if input_type == 'iso_alpha2':
            for each in all_country_names:
                if each.iso_alpha2:
                    all_country_dict[each.iso_alpha2.lower()] = each
        if input_type == 'imf_code':
            for each in all_country_names:
                if each.imf_code:
                    all_country_dict[str(each.imf_code).lower()] = each
        if input_type == 'cow_letter':
            for each in all_country_names:
                if each.cow_letter:
                    all_country_dict[each.cow_letter.lower()] = each
        if input_type == 'cow_code':
            for each in all_country_names:
                if each.cow_code:
                    all_country_dict[str(each.cow_code).lower()] = each
        if input_type == 'unctad_code':
            for each in all_country_names:
                if each.unctad_code:
                    all_country_dict[each.unctad_code.lower()] = each
        if input_type == 'marc_code':
            for each in all_country_names:
                if each.marc_code:
                    all_country_dict[each.marc_code.lower()] = each
        if input_type == 'ncd_code':
            for each in all_country_names:
                if each.ncd_code:
                    all_country_dict[each.ncd_code.lower()] = each
        if input_type == 'kansas_code':
            for each in all_country_names:
                if each.kansas_code:
                    all_country_dict[each.kansas_code.lower()] = each
        if input_type == 'penn_code':
            for each in all_country_names:
                if each.penn_code:
                    all_country_dict[each.penn_code.lower()] = each

    if (input_type != 'country_name') or (input_type == 'country_name' and all_matched and output_type == 'owid_name') or (input_type == 'country_name' and output_type != 'owid_name'):
        result_list = []
        for each in country_list:
            if "----custom_name----" in each:
                result_list.append(each.split("----custom_name----")[1])
            elif all_country_dict.get(each.lower(), 0):
                if output_type == 'owid_name':
                    if all_country_dict[each.lower()].owid_name:
                        result_list.append(all_country_dict[each.lower()].owid_name)
                    else:
                        result_list.append('')
                if output_type == 'iso_alpha2':
                    if all_country_dict[each.lower()].iso_alpha2:
                        result_list.append(all_country_dict[each.lower()].iso_alpha2)
                    else:
                        result_list.append('')
                if output_type == 'iso_alpha3':
                    if all_country_dict[each.lower()].iso_alpha3:
                        result_list.append(all_country_dict[each.lower()].iso_alpha3)
                    else:
                        result_list.append('')
                if output_type == 'continent_name':
                    if all_country_dict[each.lower()].continent.continent_name:
                        result_list.append(all_country_dict[each.lower()].continent.continent_name)
                    else:
                        result_list.append('')
                if output_type == 'continent_code':
                    if all_country_dict[each.lower()].continent.continent_code:
                        result_list.append(all_country_dict[each.lower()].continent.continent_code)
                    else:
                        result_list.append('')
                if output_type == 'imf_code':
                    if all_country_dict[each.lower()].imf_code:
                        result_list.append(all_country_dict[each.lower()].imf_code)
                    else:
                        result_list.append('')
                if output_type == 'cow_letter':
                    if all_country_dict[each.lower()].cow_letter:
                        result_list.append(all_country_dict[each.lower()].cow_letter)
                    else:
                        result_list.append('')
                if output_type == 'cow_code':
                    if all_country_dict[each.lower()].cow_code:
                        result_list.append(all_country_dict[each.lower()].cow_code)
                    else:
                        result_list.append('')
                if output_type == 'unctad_code':
                    if all_country_dict[each.lower()].unctad_code:
                        result_list.append(all_country_dict[each.lower()].unctad_code)
                    else:
                        result_list.append('')
                if output_type == 'marc_code':
                    if all_country_dict[each.lower()].marc_code:
                        result_list.append(all_country_dict[each.lower()].marc_code)
                    else:
                        result_list.append('')
                if output_type == 'ncd_code':
                    if all_country_dict[each.lower()].ncd_code:
                        result_list.append(all_country_dict[each.lower()].ncd_code)
                    else:
                        result_list.append('')
                if output_type == 'kansas_code':
                    if all_country_dict[each.lower()].kansas_code:
                        result_list.append(all_country_dict[each.lower()].kansas_code)
                    else:
                        result_list.append('')
                if output_type == 'penn_code':
                    if all_country_dict[each.lower()].penn_code:
                        result_list.append(all_country_dict[each.lower()].penn_code)
                    else:
                        result_list.append('')
            else:
                result_list.append('')
    if input_type == 'country_name' and output_type == 'owid_name':
        return {'result': result_list, 'all_matched': all_matched,
                'all_owid_country_names': all_owid_country_names_dict}
    else:
        return {'result': result_list, 'all_matched': all_matched}


def country_tool_page(request):
    if request.method == 'GET':
        form = StandardizeCountries()
        return render(request, 'country_tool.index.html', context={'current_user': request.user.name, 'form': form})
    if request.method == 'POST':
        if len(request.FILES):  # if the request was made from the file upload page
            form = StandardizeCountries(request.POST, request.FILES)
            if form.is_valid():
                country_list = []
                other_data = {}
                file = form.cleaned_data['file'].read()
                original_filename = os.path.splitext(form.cleaned_data['file'].name)[0]
                try:
                    file = file.decode('utf-8')
                except UnicodeDecodeError:
                    file = file.decode('latin1')
                file = '\n'.join(file.splitlines())
                input_type = form.cleaned_data['input_type']
                output_type = form.cleaned_data['output_type']
                country_dict = csv.DictReader(StringIO(file))
                csv_headers = country_dict.fieldnames
                if 'Country' not in csv_headers:
                    messages.error(request, "We couldn't find the input in your file. Please check column headers and upload again")
                    return render(request, 'country_tool.index.html',
                                  context={'current_user': request.user.name, 'form': form})
                for each_header in csv_headers:
                    if each_header != 'Country':
                        other_data[each_header] = []
                for row in country_dict:
                    for each_header in csv_headers:
                        if each_header == 'Country':
                            country_list.append(unidecode.unidecode(row.get('Country', None)))
                        else:
                            other_data[each_header].append(row.get(each_header, None))

                result_list = process_countries(country_list, input_type, output_type)

                if result_list['all_matched']:
                    result_list = result_list['result']
                    data = []
                    data.append(['Country', output_type])
                    for each_header in csv_headers:
                        if each_header != 'Country':
                            data[0].append(each_header)
                    for i in range(0, len(result_list)):
                        data.append([country_list[i], result_list[i]])
                        for each_header in csv_headers:
                            if each_header != 'Country':
                                data[i+1].append(other_data[each_header][i])
                    response = HttpResponse(content_type='text/csv')
                    response['Content-Disposition'] = 'attachment; filename="%s_countries_standardized.csv"' % original_filename

                    writer = csv.writer(response)

                    for each in data:
                        writer.writerow(each)

                    return response

                else:
                    owid_countries_dict = result_list['all_owid_country_names']
                    result_list = result_list['result']
                    results = []
                    unique_country_names = {}
                    selections = {}
                    for i in range(0, len(result_list)):
                        if not result_list[i]['matched']:
                            if country_list[i] not in unique_country_names:
                                results.append({'original': country_list[i], 'new': result_list[i]})
                                unique_country_names[country_list[i]] = 1
                                selections[country_list[i]] = 'not selected'
                        elif result_list[i].get('nonalphanumeric'):
                            if country_list[i] not in unique_country_names:
                                results.append({'original': country_list[i], 'new': result_list[i], 'nonalphanumeric': 1})
                                unique_country_names[country_list[i]] = 1
                    data = []
                    data.append(['Country', 'OWID_NAME'])
                    for each_header in csv_headers:
                        if each_header != 'Country':
                            data[0].append(each_header)
                    for i in range(0, len(result_list)):
                        data.append([country_list[i], result_list[i]['country'] if result_list[i]['matched'] else ''])
                        for each_header in csv_headers:
                            if each_header != 'Country':
                                data[i+1].append(other_data[each_header][i])
                        if result_list[i]['matched']:
                            data[i + 1].append(1)
                        else:
                            data[i + 1].append(0)
                    return render(request, 'country_tool.match.html',
                                  context={'current_user': request.user.name, 'results': results,
                                           'owid_countries_dict': owid_countries_dict,
                                           'data': json.dumps({'selections': selections, 'country_data': data,
                                                               'output_type': output_type,
                                                               'filename': original_filename})})

            else:
                return render(request, 'country_tool.index.html', context={'current_user': request.user.name, 'form': form})

        else:  # if the request was made from the country matching page
            try:
                jsdata = json.loads(request.body)
            except ValueError:
                return HttpResponse('Invalid request.')

            country_tool_csv_save_location = settings.BASE_DIR + '/data/country_tool/csvs/'
            if not os.path.exists(country_tool_csv_save_location):
                os.makedirs(country_tool_csv_save_location)

            output_type = jsdata['output_type']
            selections = jsdata['selections']
            json_data = jsdata['country_data']
            original_filename = jsdata['filename']
            csv_headers = json_data[0][2:]
            country_list = []
            other_data = {}

            for variable in csv_headers:
                other_data[variable] = []

            for i in range(1, len(json_data)):
                if not json_data[i][len(json_data[i]) - 1] and json_data[i][0] not in country_list:
                    if not isinstance(selections[json_data[i][0]],
                                      dict) and json_data[i][0].lower().strip() != 'micronesia':
                        # checking if the selection contains a custom name or the name micronesia
                        new_country_name = CountryName()
                        owid_country_name = CountryData.objects.filter(owid_name=selections[json_data[i][0]])
                        if not owid_country_name:
                            return JsonResponse({'error': 'An error occurred'}, safe=False)
                        else:
                            owid_country_name = owid_country_name[0]
                        new_country_name.country_name = unidecode.unidecode(json_data[i][0])
                        new_country_name.owid_country = owid_country_name

                        new_country_name.save()

                if selections.get(json_data[i][0]):
                    if not isinstance(selections[json_data[i][0]],
                                      dict) and json_data[i][0].lower().strip() != 'micronesia':
                        # checking if the selection contains a custom name or the name micronesia
                        country_list.append(json_data[i][0])
                    else:
                        # sending the custom name to process_countries with a special separator, so that we can skip matching these countries
                        if isinstance(selections[json_data[i][0]], dict):
                            # if the custom name was entered in the text box
                            country_list.append(json_data[i][0] + "----custom_name----" + selections[json_data[i][0]]["custom_name"])
                        else:
                            # this should happen rarely. For instance, when matching the name Micronesia
                            country_list.append(
                                json_data[i][0] + "----custom_name----" + selections[json_data[i][0]])
                else:
                    country_list.append(json_data[i][0])
                varcounter = 0
                for variable in csv_headers:
                    other_data[variable].append(json_data[i][2 + varcounter])
                    varcounter += 1
            jsdata = None
            result_list = process_countries(country_list, 'country_name', output_type)
            if result_list['all_matched']:
                result_list = result_list['result']
                data = []
                data.append(['Country', output_type])
                for each_header in csv_headers:
                    data[0].append(each_header)
                for i in range(0, len(result_list)):
                    data.append([country_list[i] if "----custom_name----" not in country_list[i] else country_list[i].split("----custom_name----")[0], result_list[i]])
                    for each_header in csv_headers:
                        data[i + 1].append(other_data[each_header][i])
                filename = "%s_countries_standardized.csv" % original_filename
                file = os.path.join(country_tool_csv_save_location, filename)

                with open(file, 'w', encoding='utf8') as f:
                    writer = csv.writer(f)
                    for each in data:
                        writer.writerow(each)

                return JsonResponse({'filename': reverse("servecsv", args=[filename])}, safe=False)
            else:
                return JsonResponse({'error': 'An error occurred'}, safe=False)


def servecsv(request, filename):
    country_tool_csv_save_location = settings.BASE_DIR + '/data/country_tool/csvs/'
    if os.path.isfile(os.path.join(country_tool_csv_save_location, filename)):
        response = HttpResponse(content_type='text/csv')
        response['Content-Disposition'] = 'attachment; filename="%s"' % filename
        with open(os.path.join(country_tool_csv_save_location, filename), 'r', encoding='utf8') as f:
            response.write(f.read())
        return response


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
                            newname.country_name = unidecode.unidecode(row['country_name'])
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
                            newname.country_name = unidecode.unidecode(row['country_name'])
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


def serve_country_tool_data(request):
    all_country_data = CountryName.objects.all()

    response = HttpResponse(content_type='text/csv')
    response['Content-Disposition'] = 'attachment; filename="data_for_country_tool.csv"'

    writer = csv.writer(response)
    writer.writerow(['country_name', 'owid_name', 'iso_alpha3', 'iso_alpha2', 'imf_code', 'cow_letter',
                     'cow_code', 'unctad_code', 'marc_code', 'ncd_code', 'kansas_code', 'penn_code', 'continent'])
    for each in all_country_data:
        writer.writerow([each.country_name, each.owid_country.owid_name,
                         each.owid_country.iso_alpha3, each.owid_country.iso_alpha2, each.owid_country.imf_code,
                         each.owid_country.cow_letter, each.owid_country.cow_code, each.owid_country.unctad_code,
                         each.owid_country.marc_code, each.owid_country.ncd_code, each.owid_country.kansas_code,
                         each.owid_country.penn_code, each.owid_country.continent.continent_code if each.owid_country.continent else ''])

    return response


def serve_instructions(request):
    return render(request, 'country_tool_instructions.html', context={'current_user': request.user.name,
                                                                      'images_folder': settings.BASE_URL + '/public/img/'})
