from django import forms
from crispy_forms.helper import FormHelper
from crispy_forms.layout import Submit, HTML, Layout, Div


class InviteUserForm(forms.Form):

    email = forms.EmailField(max_length=255, widget=forms.EmailInput, label="Enter email of the user to invite", required=True)
    name = forms.CharField(max_length=255, label="Enter the username for the user", required=True)
    helper = FormHelper()
    helper.form_method = 'POST'
    helper.layout = Layout(
        Div(
            HTML(
                "{% if messages %} {% for each in messages %} <div class='alert alert-{{ each.tags }}'>{{ each }}</div> {% endfor %} {% endif %}"),
            'email',
            'name',
            Submit('submit', 'Send invite'),
        )
    )


class InvitedUserRegisterForm(forms.Form):
    name = forms.CharField(max_length=255, label="Enter your username", required=True)
    password1 = forms.CharField(required=True, widget=forms.PasswordInput)
    password2 = forms.CharField(required=True, widget=forms.PasswordInput)
    helper = FormHelper()
    helper.form_method = 'POST'
    helper.layout = Layout(
        Div(
            HTML(
                "{% if messages %} {% for each in messages %} <div class='alert alert-{{ each.tags }}'>{{ each }}</div> {% endfor %} {% endif %}"),
            'name',
            'password1',
            'password2',
            Submit('submit', 'Create Account'),
        )
    )
