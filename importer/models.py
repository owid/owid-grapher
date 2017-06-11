from django.db import models


class ImportHistory(models.Model):
    import_type = models.CharField(max_length=255)
    import_time = models.DateTimeField()
    import_notes = models.TextField()
    import_state = models.TextField()
