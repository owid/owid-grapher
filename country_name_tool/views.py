import csv
import json
from io import StringIO
from django.shortcuts import render
from django.http import HttpResponse
from .forms import StandardizeCountries, UploadNewData
from .models import Continent, CountryData, CountryName
from django.db import transaction
from django.contrib import messages
from django.contrib.auth.decorators import login_required


def process_countries(country_list, input_type, output_type):

    result_list = []

    if input_type == 'country_name':
        all_country_names = CountryName.objects.all()
        all_country_dict = {}
        for each in all_country_names:
            all_country_dict[each.country_name] = each.owid_country
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
        return render(request, 'country_tool.index.html', context={'current_user': 'anonymous', 'form': form})
    if request.method == 'POST':
        form = StandardizeCountries(request.POST, request.FILES)
        if form.is_valid():
            country_list = []
            file = form.cleaned_data['file'].read().decode('utf-8')
            input_type = form.cleaned_data['input_type']
            output_type = form.cleaned_data['output_type']
            result_type = form.cleaned_data['result_type']
            country_dict = csv.DictReader(StringIO(file))
            for row in country_dict:
                country_list.append(row.get('Country', None))
            result_list = process_countries(country_list, input_type, output_type)
            results = []
            for i in range(0, len(result_list)):
                results.append({'original': country_list[i], 'new': result_list[i]})
            if result_type == 'display':
                return render(request, 'country_tool.show.html', context={'current_user': 'anonymous', 'results': results})
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
            return render(request, 'country_tool.index.html', context={'current_user': 'anonymous', 'form': form})


def country_tool_update(request):
    if request.method == 'GET':
        form = UploadNewData()
        return render(request, 'country_tool.update.html', context={'current_user': 'anonymous', 'form': form})
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
                                              context={'current_user': 'anonymous', 'form': form})
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
                                              context={'current_user': 'anonymous', 'form': form})
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
                                              context={'current_user': 'anonymous', 'form': form})
                    messages.success(request, 'Data Updated!')
                    return render(request, 'country_tool.update.html',
                                  context={'current_user': 'anonymous', 'form': form})
            except Exception as e:
                return render(request, 'country_tool.update.html',
                              context={'current_user': 'anonymous', 'form': form})

        else:
            return render(request, 'country_tool.update.html', context={'current_user': 'anonymous', 'form': form})
