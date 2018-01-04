import json
import subprocess
import hashlib
import os.path
import shlex
import gevent
from django.db import models
from django_mysql.models import JSONField, Model
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
    full_name = models.CharField(max_length=255, null=True)

    objects = UserManager()

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = []

    def get_full_name(self):
        if self.full_name is not None:
            return self.full_name
        else:
            return self.name

    def get_short_name(self):
        return self.name

    def email_user(self, subject, message, from_email=None, **kwargs):
        send_mail(subject, message, from_email, [self.email], **kwargs)


class PasswordReset(Model):
    class Meta:
        db_table = "password_resets"

    email = models.CharField(max_length=255)
    token = models.CharField(max_length=255)
    created_at = models.DateTimeField(auto_now_add=True)


class Chart(Model):
    class Meta:
        db_table = "charts"
        unique_together = (('slug', 'published'),)

    id = models.AutoField(primary_key=True)
    name = models.CharField(max_length=255)
    config = JSONField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    last_edited_by = models.ForeignKey(User, to_field='name', on_delete=models.DO_NOTHING, blank=True, null=True,
                                       db_column='last_edited_by')
    last_edited_at = models.DateTimeField()
    origin_url = models.CharField(max_length=255)
    notes = models.TextField()
    slug = models.CharField(max_length=255, blank=True, null=True)
    # Null/True due to the behavior of mysql unique indexes (we only want slugs to conflict if published)
    published = models.NullBooleanField(default=None, choices=((None, 'false'), (True, 'true')))
    starred = models.BooleanField(default=False)
    type = models.CharField(max_length=255, choices=(('LineChart', 'Line chart'), ('ScatterPlot', 'Scatter plot'),
                                                     ('StackedArea', 'Stacked area'), ('MultiBar', 'Multi bar'),
                                                     ('HorizontalMultiBar', 'Horizontal Multi bar'),
                                                     ('DiscreteBar', 'Discrete bar'),
                                                     ('SlopeChart', 'Slope chart')), blank=True, null=True)


    max_exports_per_worker = 2
    exports_in_progress = 0
    def export_image(self, query: str, format: str, is_async: bool = False):
        screenshot = settings.BASE_DIR + "/dist/js/exportChart.js"
#        targetSrc = settings.BASE_URL + "/" + self.config['slug'] + "?" + query
#        m = hashlib.md5()
#        m.update(query.encode(encoding='utf-8'))
#        query_hash = m.hexdigest()
#        png_file = settings.BASE_DIR + "/public/exports/" + self.config['slug'] + "-" + query_hash + ".png"
#        return_file = settings.BASE_DIR + "/public/exports/" + self.config['slug'] + "-" + query_hash + "." + format
        targetSrc = settings.BASE_URL + "/" + self.config['slug']
        png_file = settings.BASE_DIR + "/public/exports/" + self.config['slug'] + ".png"
        return_file = settings.BASE_DIR + "/public/exports/" + self.config['slug'] + "." + format


        if Chart.exports_in_progress >= Chart.max_exports_per_worker:
            if is_async: return return_file
            else:
                while Chart.exports_in_progress >= Chart.max_exports_per_worker:
                    gevent.sleep(0.5)

        Chart.exports_in_progress += 1

        try:
            if not os.path.isfile(return_file):
                command = "nice node %s --baseUrl=%s --targetSrc=%s --output=%s" % \
                        (screenshot, shlex.quote(settings.BASE_URL), shlex.quote(targetSrc), shlex.quote(png_file))
                print(command)

                if is_async:
                    subprocess.Popen(command, shell=True)
                else:
                    try:
                        subprocess.check_output(command, shell=True, stderr=subprocess.STDOUT)
                    except subprocess.CalledProcessError as e:
                        raise Exception(e.output)
        finally:
            Chart.exports_in_progress -= 1

        return return_file

    def bake(self, user):
        email = shlex.quote(user.email)
        name = shlex.quote(user.get_full_name())
        slug = shlex.quote(self.config['slug'])
        cmd = f"node {settings.BASE_DIR}/dist/src/chartUpdatedHook.js {settings.DB_NAME} {email} {name} {slug} >> /tmp/{settings.DB_NAME}-static.log 2>&1"

        print(cmd)
        subprocess.Popen(cmd, shell=True)

    @classmethod
    def owid_commit(cls):
        """
        :return: Will return latest commit revision for the repo
        """
        git_commit = subprocess.check_output(['git', 'rev-parse', 'HEAD'], shell=False)
        return str(git_commit)

    def show_type(self):
        type = "Unknown"
        config = self.config

        if config['type'] == "LineChart":
            type = "Line Chart"
        elif config['type'] == "ScatterPlot":
            type = "Scatter Plot"
        elif config['type'] == "StackedArea":
            type = "Stacked Area"
        elif config['type'] == "MultiBar":
            type = "Multi Bar"
        elif config['type'] == "HorizontalMultiBar":
            type = "Horizontal Multi Bar"
        elif config['type'] == "DiscreteBar":
            type = "Discrete Bar"
        elif config['type'] == "SlopeChart":
            type = "Slope Chart"

        if config.get("tab") == "map":
            if config.get("hasChartTab"):
                return "Map + " + type
            else:
                return "Map"
        else:
            if config.get("hasMapTab"):
                return type + " + Map"
            else:
                return type


class DatasetCategory(Model):
    class Meta:
        db_table = "dataset_categories"

    name = models.CharField(max_length=255, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    fetcher_autocreated = models.BooleanField(default=False)


class DatasetSubcategory(Model):
    class Meta:
        db_table = "dataset_subcategories"
        unique_together = (('name', 'fk_dst_cat_id'),)

    name = models.CharField(max_length=255)
    fk_dst_cat_id = models.ForeignKey(DatasetCategory, blank=True, null=True, on_delete=models.DO_NOTHING,
                                      db_column='fk_dst_cat_id')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)


class Dataset(Model):
    class Meta:
        db_table = "datasets"
        unique_together = (('name', 'namespace'),)

    name = models.CharField(max_length=255)
    description = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    fk_dst_cat_id = models.ForeignKey(DatasetCategory, blank=True, null=True, on_delete=models.DO_NOTHING,
                                      db_column='fk_dst_cat_id')
    fk_dst_subcat_id = models.ForeignKey(DatasetSubcategory, blank=True, null=True, on_delete=models.DO_NOTHING,
                                         db_column='fk_dst_subcat_id')
    namespace = models.CharField(max_length=255, default='owid')


class Source(Model):
    class Meta:
        db_table = 'sources'
        unique_together = (('name', 'datasetId'),)

    name = models.CharField(max_length=255)
    description = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    datasetId = models.IntegerField(db_column='datasetId', blank=True, null=True)


class VariableType(Model):
    class Meta:
        db_table = 'variable_types'

    name = models.CharField(max_length=255)
    isSortable = models.BooleanField(db_column='isSortable', default=False)


class Variable(Model):
    class Meta:
        db_table = 'variables'
        unique_together = (('code', 'fk_dst_id'), ('name', 'fk_dst_id'),)

    name = models.CharField(max_length=255)
    unit = models.CharField(max_length=255)
    short_unit = models.CharField(max_length=255, null=True)

    # Separate "display" properties to allow overriding metadata for
    # display on charts while also preserving the original source metadata
    displayName = models.CharField(max_length=255, null=True)
    displayUnit = models.CharField(max_length=255, null=True)
    displayShortUnit = models.CharField(max_length=255, null=True)
    displayUnitConversionFactor = models.FloatField(null=True)
    displayIsProjection = models.NullBooleanField(null=True)
    displayTolerance = models.IntegerField(null=True)

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


class ChartDimension(Model):
    class Meta:
        db_table = "chart_dimensions"

    chartId = models.ForeignKey(Chart, on_delete=models.CASCADE, db_column='chartId')
    variableId = models.ForeignKey(Variable, models.DO_NOTHING, db_column='variableId')
    order = models.IntegerField()
    property = models.CharField(max_length=255)

    # These fields override the variable metadata on a per-chart basis
    unit = models.CharField(max_length=255, null=True)
    shortUnit = models.CharField(max_length=255, null=True)
    displayName = models.CharField(max_length=255, db_column='displayName', null=True)
    isProjection = models.NullBooleanField(null=True)
    tolerance = models.IntegerField(null=True)
    conversionFactor = models.FloatField(null=True)

    # XXX todo move this elsewhere
    targetYear = models.IntegerField(db_column='targetYear', blank=True, null=True)

class ChartSlugRedirect(Model):
    class Meta:
        db_table = 'chart_slug_redirects'

    slug = models.CharField(unique=True, max_length=255)
    chart_id = models.IntegerField()


class Entity(Model):
    class Meta:
        db_table = "entities"

    code = models.CharField(max_length=255, blank=True, null=True, unique=True)
    name = models.CharField(max_length=255, unique=True)
    validated = models.BooleanField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    displayName = models.CharField(db_column='displayName', max_length=255)


class DataValue(Model):
    class Meta:
        db_table = "data_values"
        unique_together = (('fk_ent_id', 'fk_var_id', 'year'),)

    value = models.CharField(max_length=255)
    fk_ent_id = models.ForeignKey(Entity, blank=True, null=True, on_delete=models.DO_NOTHING, db_column='fk_ent_id')
    fk_var_id = models.ForeignKey(Variable, on_delete=models.CASCADE, db_column='fk_var_id')
    year = models.IntegerField()


class InputFile(Model):
    class Meta:
        db_table = 'input_files'

    raw_data = models.TextField()
    fk_user_id = models.ForeignKey(User, on_delete=models.DO_NOTHING, db_column='fk_user_id')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)


class License(Model):
    class Meta:
        db_table = 'licenses'

    name = models.CharField(max_length=255)
    description = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)


class Logo(Model):
    class Meta:
        db_table = 'logos'

    name = models.CharField(max_length=100)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    svg = models.TextField()


class Setting(Model):
    class Meta:
        db_table = 'settings'

    meta_name = models.CharField(max_length=255)
    meta_value = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)


class UserInvitation(Model):
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


class CloudflarePurgeQueue(Model):
    url = models.CharField(max_length=255, unique=True)
