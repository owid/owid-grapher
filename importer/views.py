from django.shortcuts import render
from django.http import HttpRequest, HttpResponse
from grapher_admin.models import Variable
from typing import Dict
from openpyxl import Workbook
from openpyxl.writer.excel import save_virtual_workbook
from importer.models import AdditionalCountryInfo


def listwdidatasets(request: HttpRequest):
    variables = Variable.objects.filter(fk_dst_id__namespace='wdi')
    datasets: Dict = {}

    for each in variables:
        if datasets.get(each.fk_dst_id.fk_dst_subcat_id.name):
            datasets[each.fk_dst_id.fk_dst_subcat_id.name].append({'id': each.pk, 'name': each.name, 'code': each.code})
        else:
            datasets[each.fk_dst_id.fk_dst_subcat_id.name] = []
            datasets[each.fk_dst_id.fk_dst_subcat_id.name].append({'id': each.pk, 'name': each.name, 'code': each.code})

    return render(request, 'admin.worldbank.data.html', context={'current_user': request.user.name,
                                                           'datasets': datasets})


def listunwppdatasets(request: HttpRequest):
    variables = Variable.objects.filter(fk_dst_id__namespace='unwpp')
    datasets: Dict = {}

    for each in variables:
        if datasets.get(each.fk_dst_id.fk_dst_subcat_id.name):
            datasets[each.fk_dst_id.fk_dst_subcat_id.name].append({'id': each.pk, 'name': each.name, 'code': each.code})
        else:
            datasets[each.fk_dst_id.fk_dst_subcat_id.name] = []
            datasets[each.fk_dst_id.fk_dst_subcat_id.name].append({'id': each.pk, 'name': each.name, 'code': each.code})

    return render(request, 'admin.unwpp.data.html', context={'current_user': request.user.name,
                                                           'datasets': datasets})


def listqogdatasets(request: HttpRequest):
    variables = Variable.objects.filter(fk_dst_id__namespace='qog')
    datasets: Dict = {}

    for each in variables:
        if datasets.get(each.fk_dst_id.fk_dst_subcat_id.name):
            datasets[each.fk_dst_id.fk_dst_subcat_id.name].append({'id': each.pk, 'name': each.name, 'code': each.code})
        else:
            datasets[each.fk_dst_id.fk_dst_subcat_id.name] = []
            datasets[each.fk_dst_id.fk_dst_subcat_id.name].append({'id': each.pk, 'name': each.name, 'code': each.code})

    return render(request, 'admin.qog.data.html', context={'current_user': request.user.name,
                                                           'datasets': datasets})


def serve_wdi_country_info_xls(request: HttpRequest):

    wb = Workbook()

    ws = wb.worksheets[0]

    all_wdi_additional_country_info = AdditionalCountryInfo.objects.all()

    ws.cell(column=1, row=1, value="Country")
    ws.cell(column=2, row=1, value="Country's World Bank Region")
    ws.cell(column=3, row=1, value="Country's World Bank income group")
    ws.cell(column=4, row=1, value="Special notes")
    ws.cell(column=5, row=1, value="Latest population census")
    ws.cell(column=6, row=1, value="Latest household survey")
    ws.cell(column=7, row=1, value="Source of most recent Income and expenditure data")

    row = 2
    for each in all_wdi_additional_country_info:
        ws.cell(column=1, row=row, value="{0}".format(each.country_name))
        ws.cell(column=2, row=row, value="{0}".format(each.country_wb_region))
        ws.cell(column=3, row=row, value="{0}".format(each.country_wb_income_group))
        ws.cell(column=4, row=row, value="{0}".format(each.country_special_notes))
        ws.cell(column=5, row=row, value="{0}".format(each.country_latest_census))
        ws.cell(column=6, row=row, value="{0}".format(each.country_latest_survey))
        ws.cell(column=7, row=row, value="{0}".format(each.country_recent_income_source))

        row += 1

    response = HttpResponse(save_virtual_workbook(wb), content_type='application/vnd.ms-excel')
    response['Content-Disposition'] = 'attachment; filename="WDI_Country_info.xlsx"'
    return response
