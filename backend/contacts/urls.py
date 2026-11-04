from rest_framework.routers import DefaultRouter
from .views import EmergencyContactViewSet

router = DefaultRouter()
router.register("", EmergencyContactViewSet, basename="contacts")

urlpatterns = router.urls
