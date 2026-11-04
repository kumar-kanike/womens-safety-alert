from django.urls import path
from .views import SOSCreateView, AlertHistoryView

urlpatterns = [
    path("sos/", SOSCreateView.as_view(), name="sos"),
    path("history/", AlertHistoryView.as_view(), name="alert-history"),
]
