import re
from rest_framework import serializers
from .models import EmergencyContact

class EmergencyContactSerializer(serializers.ModelSerializer):
    class Meta:
        model = EmergencyContact
        fields = ["id", "name", "phone", "relationship", "created_at"]
        read_only_fields = ["id", "created_at"]

    def validate_name(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("Contact name is required.")
        return value

    def validate_phone(self, value):
        value = value.strip()
        if not re.fullmatch(r"\+?[0-9][0-9\s().-]{5,18}", value):
            raise serializers.ValidationError("Enter a valid phone number.")
        return value
