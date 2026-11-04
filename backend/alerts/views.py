from rest_framework import generics, permissions
from rest_framework.response import Response
from rest_framework.views import APIView
from .models import EmergencyAlert
from .serializers import EmergencyAlertSerializer

class SOSCreateView(generics.CreateAPIView):
    serializer_class = EmergencyAlertSerializer
    permission_classes = [permissions.IsAuthenticated]

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

class AlertHistoryView(generics.ListAPIView):
    serializer_class = EmergencyAlertSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return EmergencyAlert.objects.filter(user=self.request.user).order_by("-created_at")
