from django.contrib.auth.models import User
from rest_framework.test import APITestCase
from rest_framework import status

class EmergencyContactApiTests(APITestCase):
    def setUp(self):
        User.objects.create_user(username="contactuser", password="SafePassword123!")
        response = self.client.post("/api/token/", {
            "username": "contactuser",
            "password": "SafePassword123!",
        }, format="json")
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {response.data['access']}")

    def test_create_and_list_contact(self):
        response = self.client.post("/api/contacts/", {
            "name": "Trusted Person",
            "phone": "+91 98765 43210",
            "relationship": "Friend",
        }, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        listing = self.client.get("/api/contacts/")
        self.assertEqual(listing.status_code, status.HTTP_200_OK)
        self.assertEqual(len(listing.data), 1)

    def test_reject_invalid_phone(self):
        response = self.client.post("/api/contacts/", {
            "name": "Bad Number",
            "phone": "abc",
            "relationship": "Friend",
        }, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
