from django.contrib.auth.models import User
from rest_framework.test import APITestCase
from rest_framework import status

class SOSApiTests(APITestCase):
    def setUp(self):
        User.objects.create_user(username="safetyuser", password="SafePassword123!")
        response = self.client.post("/api/token/", {
            "username": "safetyuser",
            "password": "SafePassword123!",
        }, format="json")
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {response.data['access']}")

    def test_create_sos_event(self):
        response = self.client.post("/api/alerts/sos/", {
            "latitude": 15.8281,
            "longitude": 78.0373,
            "message": "Test alert",
        }, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["message"], "Test alert")

    def test_reject_invalid_coordinates(self):
        response = self.client.post("/api/alerts/sos/", {
            "latitude": 120,
            "longitude": 78,
            "message": "Invalid location",
        }, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
