from django import forms
from crispy_forms.helper import FormHelper
from crispy_forms.layout import Submit


def input_choices():
    return [
        ('country_name', 'COUNTRY NAME'),
        ('owid_name', 'OUR WORLD IN DATA NAME'),
        ('owid_code', 'OUR WORLD IN DATA CODE'),
        ('iso_alpha3', 'ISO 3166-1 ALPHA-3 CODE'),
        ('iso_alpha2', 'ISO 3166-1 ALPHA-2 CODE'),
        ('imf_code', 'IMF COUNTRY CODE'),
        ('cow_letter', 'COW LETTERS'),
        ('cow_code', 'COW CODES'),
        ('unctad_code', 'UNCTAD 3-LETTER CODE'),
        ('marc_code', 'MARC COUNTRY CODES (LIBRARY OF CONGRESS)'),
        ('ncd_code', 'NATIONAL CAPABILITIES DATASET CODES'),
        ('kansas_code', 'KANSAS EVENT DATA SYSTEM, CAMEO COUNTRY CODES'),
        ('penn_code', 'PENN WORLD TABLE 7.0')
            ]


def output_choices():
    return [
        ('owid_name', 'OUR WORLD IN DATA NAME'),
        ('owid_code', 'OUR WORLD IN DATA CODE'),
        ('iso_alpha3', 'ISO 3166-1 ALPHA-3 CODE'),
        ('iso_alpha2', 'ISO 3166-1 ALPHA-2 CODE'),
        ('continent_name', 'CONTINENT NAME'),
        ('continent_code', 'CONTINENT CODE'),
        ('imf_code', 'IMF COUNTRY CODE'),
        ('cow_letter', 'COW LETTERS'),
        ('cow_code', 'COW CODES'),
        ('unctad_code', 'UNCTAD 3-LETTER CODE'),
        ('marc_code', 'MARC COUNTRY CODES (LIBRARY OF CONGRESS)'),
        ('ncd_code', 'NATIONAL CAPABILITIES DATASET CODES'),
        ('kansas_code', 'KANSAS EVENT DATA SYSTEM, CAMEO COUNTRY CODES'),
        ('penn_code', 'PENN WORLD TABLE 7.0')
            ]


class StandardizeCountries(forms.Form):
    input_type = forms.ChoiceField(choices=input_choices(), label='Input Type')
    output_type = forms.ChoiceField(choices=output_choices(), label='Output Type')
    result_type = forms.ChoiceField(choices=[('file', 'Download as a file'), ('display', 'Show on the page')], label='Result format')
    file = forms.FileField()
    helper = FormHelper()
    helper.form_method = 'POST'
    helper.add_input(Submit('submit', 'Submit'))


class UploadNewData(forms.Form):
    file = forms.FileField()
    helper = FormHelper()
    helper.form_method = 'POST'
    helper.add_input(Submit('submit', 'Submit'))
