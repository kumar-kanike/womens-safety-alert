from rest_framework import serializers
from .models import EmergencyAlert

class EmergencyAlertSerializer(serializers.ModelSerializer):
    class Meta:
        model = EmergencyAlert
        fields = [
            "id", "latitude", "longitude", "message", "status", "created_at"
        ]
        read_only_fields = ["id", "status", "created_at"]
