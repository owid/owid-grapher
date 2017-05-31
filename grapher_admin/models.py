import json
import subprocess
import hashlib
import os.path
import shlex
from django.db import models
from django.core.mail import send_mail
from django.contrib.auth.models import PermissionsMixin
from django.contrib.auth.base_user import AbstractBaseUser
from django.contrib.auth.base_user import BaseUserManager
from django.conf import settings


# contains helper methods for the User model
class UserManager(BaseUserManager):
    use_in_migrations = True

    def _create_user(self, email, password, **extra_fields):
        if not email:
            raise ValueError('Please provide an email address')
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_user(self, email, password=None, **extra_fields):
        extra_fields.setdefault('is_superuser', False)
        return self._create_user(email, password, **extra_fields)

    def create_superuser(self, email, password, **extra_fields):
        extra_fields.setdefault('is_superuser', True)

        if extra_fields.get('is_superuser') is not True:
            raise ValueError('The field is_superuser should be set to True.')

        return self._create_user(email, password, **extra_fields)


class User(AbstractBaseUser, PermissionsMixin):
    class Meta:
        db_table = "users"

    email = models.EmailField(max_length=255, unique=True)
    name = models.CharField(max_length=255, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    is_active = models.BooleanField(default=True)

    objects = UserManager()

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = []

    def get_full_name(self):
        return self.name

    def get_short_name(self):
        return self.name

    def email_user(self, subject, message, from_email=None, **kwargs):
        send_mail(subject, message, from_email, [self.email], **kwargs)


class PasswordReset(models.Model):
    class Meta:
        db_table = "password_resets"

    email = models.CharField(max_length=255)
    token = models.CharField(max_length=255)
    created_at = models.DateTimeField(auto_now_add=True)


class Chart(models.Model):
    class Meta:
        db_table = "charts"
        unique_together = (('slug', 'published'),)

    id = models.AutoField(primary_key=True)
    name = models.CharField(max_length=255)
    config = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    last_edited_by = models.ForeignKey(User, to_field='name', on_delete=models.DO_NOTHING, blank=True, null=True,
                                       db_column='last_edited_by')
    last_edited_at = models.DateTimeField(auto_now=True)
    origin_url = models.CharField(max_length=255)
    notes = models.TextField()
    slug = models.CharField(max_length=255, blank=True, null=True)
    # Null/True due to the behavior of mysql unique indexes (we only want slugs to conflict if not published)
    published = models.NullBooleanField(default=None, choices=((None, 'false'), (True, 'true')))
    starred = models.BooleanField(default=False)
    type = models.CharField(max_length=255, choices=(('LineChart', 'Line chart'), ('ScatterPlot', 'Scatter plot'),
                                                     ('StackedArea', 'Stacked area'), ('MultiBar', 'Multi bar'),
                                                     ('HorizontalMultiBar', 'Horizontal Multi bar'),
                                                     ('DiscreteBar', 'Discrete bar'),
                                                     ('SlopeChart', 'Slope chart')), blank=True, null=True)

    def export_image(self, query: str, format: str, is_async: bool = False):
        screenshot = settings.BASE_DIR + "/js/screenshot.js"
        target = settings.BASE_URL + "/" + self.slug + ".export" + "?" + query
        m = hashlib.md5()
        m.update(query.encode(encoding='utf-8'))
        query_hash = m.hexdigest()
        png_file = settings.BASE_DIR + "/public/exports/" + self.slug + "-" + query_hash + ".png"
        return_file = settings.BASE_DIR + "/public/exports/" + self.slug + "-" + query_hash + "." + format

        if not os.path.isfile(return_file):
            command = "LIGHTHOUSE_CHROMIUM_PATH=/usr/bin/chromium-browser node %s --url=%s --output=%s" % \
                      (screenshot, shlex.quote(target), shlex.quote(png_file))
            print(command)

            if is_async:
                subprocess.Popen(command, shell=True)
            else:
                try:
                    subprocess.check_output(command, shell=True, stderr=subprocess.STDOUT)
                except subprocess.CalledProcessError as e:
                    raise Exception(e.output)

        return return_file

    @classmethod
    def owid_commit(cls):
        """
        :return: Will return latest commit revision for the repo
        """
        git_commit = subprocess.check_output(['git', 'rev-parse', 'HEAD'], shell=False)
        return str(git_commit)

    def make_cache_tag(self):
        """
        :return: A cache tag we can send along to the client. This uniquely identifies a particular
        combination of dataset variables, and is sent along to servevariables view when the chart requests
        all of its data. Allows us to reduce chart loading times by caching most of the data in
        Cloudflare or the browser.
        """
        variable_cache_tag = str(self.updated_at) + ' + ' + Chart.owid_commit()
        config = json.loads(self.config)
        dims = config['chart-dimensions']
        varids = [int(d['variableId']) for d in dims if 'variableId' in d]
        vartimestamps = Variable.objects.filter(pk__in=varids)
        updated_at_list = []
        for each in vartimestamps:
            updated_at_list.append(str(each.updated_at))
        variable_cache_tag += ' + '.join(updated_at_list)
        m = hashlib.md5()
        m.update(variable_cache_tag.encode(encoding='utf-8'))
        variable_cache_tag = m.hexdigest()
        return variable_cache_tag

    def get_config(self):
        """
        :return: A Chart's config dictionary
        """
        config = json.loads(self.config)
        config['id'] = self.pk
        config['title'] = self.name
        config['chart-type'] = self.type
        config['internalNotes'] = self.notes
        config['slug'] = self.slug
        config['data-entry-url'] = self.origin_url
        config['published'] = self.published
        logos = []
        for each in list(Logo.objects.filter(name__in=config['logos'])):
            logos.append(each.svg)
        config['logosSVG'] = logos
        config['chart-dimensions'] = list(self.chartdimension_set.values())
        # XXX
        for dim in config['chart-dimensions']:
            dim['chartId'] = dim.pop('chartId_id')
            dim['variableId'] = dim.pop('variableId_id')
        return config

    def show_type(self):
        config = json.loads(self.config)
        type = "Unknown"

        if self.type == "LineChart":
            type = "Line Chart"
        elif self.type == "ScatterPlot":
            type = "Scatter Plot"
        elif self.type == "StackedArea":
            type = "Stacked Area"
        elif self.type == "MultiBar":
            type = "Multi Bar"
        elif self.type == "HorizontalMultiBar":
            type = "Horizontal Multi Bar"
        elif self.type == "DiscreteBar":
            type = "Discrete Bar"
        elif self.type == "SlopeChart":
            type = "Slope Chart"

        if config.get("default-tab", 0) and config.get("default-tab", 0) == "map":
            if "chart" in config.get("tabs", ""):
                return "Map + " + type
            else:
                return "Map"
        else:
            if "map" in config.get("tabs", ""):
                return type + " + Map"
            else:
                return type


class DatasetCategory(models.Model):
    class Meta:
        db_table = "dataset_categories"

    name = models.CharField(max_length=255, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)


class DatasetSubcategory(models.Model):
    class Meta:
        db_table = "dataset_subcategories"
        unique_together = (('name', 'fk_dst_cat_id'),)

    name = models.CharField(max_length=255)
    fk_dst_cat_id = models.ForeignKey(DatasetCategory, blank=True, null=True, on_delete=models.DO_NOTHING,
                                      db_column='fk_dst_cat_id')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)


class Dataset(models.Model):
    class Meta:
        db_table = "datasets"
        unique_together = (('name', 'namespace'),)

    name = models.CharField(max_length=255)
    description = models.CharField(max_length=255)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    fk_dst_cat_id = models.ForeignKey(DatasetCategory, blank=True, null=True, on_delete=models.DO_NOTHING,
                                      db_column='fk_dst_cat_id')
    fk_dst_subcat_id = models.ForeignKey(DatasetSubcategory, blank=True, null=True, on_delete=models.DO_NOTHING,
                                         db_column='fk_dst_subcat_id')
    namespace = models.CharField(max_length=255, default='owid')


class Source(models.Model):
    class Meta:
        db_table = 'sources'
        unique_together = (('name', 'datasetId'),)

    name = models.CharField(max_length=255)
    description = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    datasetId = models.IntegerField(db_column='datasetId', blank=True, null=True)


class VariableType(models.Model):
    class Meta:
        db_table = 'variable_types'

    name = models.CharField(max_length=255)
    isSortable = models.BooleanField(db_column='isSortable', default=False)


class Variable(models.Model):
    class Meta:
        db_table = 'variables'
        unique_together = (('code', 'fk_dst_id'), ('name', 'fk_dst_id'),)

    name = models.CharField(max_length=255)
    unit = models.CharField(max_length=255)
    description = models.TextField(blank=True, null=True)
    fk_dst_id = models.ForeignKey(Dataset, on_delete=models.CASCADE, db_column='fk_dst_id')
    sourceId = models.ForeignKey(Source, on_delete=models.DO_NOTHING, db_column='sourceId')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    fk_var_type_id = models.ForeignKey(VariableType, on_delete=models.DO_NOTHING, db_column='fk_var_type_id')
    uploaded_by = models.ForeignKey(User, to_field='name', on_delete=models.DO_NOTHING, db_column='uploaded_by',
                                    blank=True, null=True)
    uploaded_at = models.DateTimeField(auto_now_add=True)
    code = models.CharField(max_length=255, blank=True, null=True)
    coverage = models.CharField(max_length=255)
    timespan = models.CharField(max_length=255)


class ChartDimension(models.Model):
    class Meta:
        db_table = "chart_dimensions"

    chartId = models.ForeignKey(Chart, on_delete=models.CASCADE, db_column='chartId')
    order = models.IntegerField()
    variableId = models.ForeignKey(Variable, models.DO_NOTHING, db_column='variableId')
    property = models.CharField(max_length=255)
    unit = models.CharField(max_length=255)
    displayName = models.CharField(max_length=255, db_column='displayName')
    targetYear = models.IntegerField(db_column='targetYear', blank=True, null=True)
    isProjection = models.BooleanField(default=False)
    tolerance = models.IntegerField(blank=True, default=5)
    color = models.CharField(max_length=255)


class ChartSlugRedirect(models.Model):
    class Meta:
        db_table = 'chart_slug_redirects'

    slug = models.CharField(unique=True, max_length=255)
    chart_id = models.IntegerField()


class Entity(models.Model):
    class Meta:
        db_table = "entities"

    code = models.CharField(max_length=255, blank=True, null=True, unique=True)
    name = models.CharField(max_length=255, unique=True)
    validated = models.BooleanField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    displayName = models.CharField(db_column='displayName', max_length=255)


class DataValue(models.Model):
    class Meta:
        db_table = "data_values"
        unique_together = (('fk_ent_id', 'fk_var_id', 'year'),)

    value = models.CharField(max_length=255)
    fk_ent_id = models.ForeignKey(Entity, blank=True, null=True, on_delete=models.DO_NOTHING, db_column='fk_ent_id')
    fk_var_id = models.ForeignKey(Variable, on_delete=models.CASCADE, db_column='fk_var_id')
    year = models.IntegerField()


class InputFile(models.Model):
    class Meta:
        db_table = 'input_files'

    raw_data = models.TextField()
    fk_user_id = models.ForeignKey(User, on_delete=models.DO_NOTHING, db_column='fk_user_id')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)


class License(models.Model):
    class Meta:
        db_table = 'licenses'

    name = models.CharField(max_length=255)
    description = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)


class Logo(models.Model):
    class Meta:
        db_table = 'logos'

    name = models.CharField(max_length=100)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    svg = models.TextField()


class Setting(models.Model):
    class Meta:
        db_table = 'settings'

    meta_name = models.CharField(max_length=255)
    meta_value = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)


class UserInvitation(models.Model):
    class Meta:
        db_table = 'user_invitations'

    code = models.CharField(max_length=255)
    email = models.CharField(max_length=255)
    user_id = models.ForeignKey(User, on_delete=models.DO_NOTHING, db_column='user_id')
    status = models.CharField(max_length=10, choices=(('pending', 'pending'), ('successful', 'successful'),
                                                      ('canceled', 'canceled'), ('expired', 'expired')))
    valid_till = models.DateTimeField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
