from django.db import models


class Continent(models.Model):
    continent_code = models.CharField(max_length=255, unique=True)
    continent_name = models.CharField(max_length=255, unique=True)


class CountryData(models.Model):
    owid_name = models.CharField(max_length=255, unique=True)
    iso_alpha2 = models.CharField(max_length=255, unique=True, blank=True, null=True)
    iso_alpha3 = models.CharField(max_length=255, unique=True, blank=True, null=True)
    continent = models.ForeignKey(Continent, db_column='continent', on_delete=models.CASCADE, null=True)
    imf_code = models.IntegerField(unique=True, blank=True, null=True)
    cow_letter = models.CharField(max_length=255, unique=True, blank=True, null=True)
    cow_code = models.IntegerField(unique=True, blank=True, null=True)
    unctad_code = models.CharField(max_length=255, unique=True, blank=True, null=True)
    marc_code = models.CharField(max_length=255, unique=True, blank=True, null=True)
    ncd_code = models.CharField(max_length=255, unique=True, blank=True, null=True)
    kansas_code = models.CharField(max_length=255, unique=True, blank=True, null=True)
    penn_code = models.CharField(max_length=255, unique=True, blank=True, null=True)


class CountryName(models.Model):
    country_name = models.CharField(max_length=255, unique=True)
    owid_country = models.ForeignKey(CountryData, db_column='owid_country', on_delete=models.CASCADE)
