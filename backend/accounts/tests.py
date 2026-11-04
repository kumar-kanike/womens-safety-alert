from rest_framework.test import APITestCase
from rest_framework import status

class AccountApiTests(APITestCase):
    def test_register_account(self):
        response = self.client.post("/api/accounts/register/", {
            "username": "newuser",
            "email": "newuser@example.com",
            "password": "StrongPassword123!",
        }, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertNotIn("password", response.data)

    def test_profile_requires_authentication(self):
        response = self.client.get("/api/accounts/profile/")
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
