from rest_framework import serializers
from .models import EmergencyAlert

class EmergencyAlertSerializer(serializers.ModelSerializer):
    class Meta:
        model = EmergencyAlert
        fields = ["id", "latitude", "longitude", "message", "status", "created_at"]
        read_only_fields = ["id", "status", "created_at"]

    def validate_latitude(self, value):
        if value is not None and not -90 <= value <= 90:
            raise serializers.ValidationError("Latitude must be between -90 and 90.")
        return value

    def validate_longitude(self, value):
        if value is not None and not -180 <= value <= 180:
            raise serializers.ValidationError("Longitude must be between -180 and 180.")
        return value
