from django.conf import settings
from django.db import models

class EmergencyAlert(models.Model):
    STATUS_CHOICES = [
        ("created", "Created"),
        ("resolved", "Resolved"),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="emergency_alerts"
    )
    latitude = models.FloatField(null=True, blank=True)
    longitude = models.FloatField(null=True, blank=True)
    message = models.CharField(max_length=255, default="Emergency SOS alert")
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="created")
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"SOS - {self.user.username} - {self.created_at}"
