from django.db import models


class ImportHistory(models.Model):
    import_type = models.CharField(max_length=255)
    import_time = models.DateTimeField()
    import_notes = models.TextField()
    import_state = models.TextField()


class AdditionalCountryInfo(models.Model):
    country_code = models.CharField(max_length=255)
    country_name = models.CharField(max_length=255)
    country_wb_region = models.CharField(max_length=255, null=True)
    country_wb_income_group = models.CharField(max_length=255, null=True)
    country_special_notes = models.TextField(null=True)
    country_latest_census = models.CharField(max_length=255, null=True)
    country_latest_survey = models.CharField(max_length=255, null=True)
    country_recent_income_source = models.CharField(max_length=255, null=True)
    dataset = models.CharField(max_length=255, default='wdi')
