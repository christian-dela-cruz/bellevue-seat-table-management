import { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import ReservationLanding from "../features/client/pages/ReservationLanding";
import ManageBooking from "../features/client/pages/ManageBooking";
import DynamicVenueReservation from "../features/client/pages/DynamicVenueReservation";
import ReservationDashboard from "../features/admin/pages/ReservationDashboard";
import UnifiedSeatMapEditor from "../features/admin/pages/UnifiedSeatMapEditor";
import NotificationDashboard from "../features/admin/pages/Notifications";
import CancelledDashboard from "../features/admin/pages/CancelledDashboard";
import Accounts from "../features/admin/pages/Accounts";
import RolesAndPermissions from "../features/admin/pages/RolesAndPermissions";
import AccountSettings from "../features/admin/pages/AccountSettings";
import Reports from "../features/admin/pages/Reports";
import OutletDashboard from "../features/admin/pages/OutletDashboard";
import FunctionRooms from "../features/admin/pages/FunctionRooms";
import EventManagement from "../features/admin/pages/EventManagement";
import EventBooking from "../features/client/pages/EventBooking";
import ForgotCode from "../features/client/pages/ForgotCode";
import LoginPage from "../features/auth/pages/LoginPage";
import ActivateAccount from "../features/auth/pages/ActivateAccount";
import { authAPI } from "../services/authAPI";
import SharedNavbar from "../components/SharedNavbar";
import { AdminThemeProvider } from "../context/AdminThemeContext";

function RequireAdminAuth({ children, permission }) {
  if (!authAPI.isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }

  if (permission && !authAPI.hasPermission(permission)) {
    return <Navigate to="/admin/reservations" replace />;
  }

  return children;
}

function AdminClassWrapper({ children }) {
  const location = useLocation();
  useEffect(() => {
    if (location.pathname.startsWith("/admin")) {
      document.body.classList.add("bellevue-admin-page");
    } else {
      document.body.classList.remove("bellevue-admin-page");
    }
  }, [location.pathname]);
  return children;
}

function AdminEntry() {
  return <Navigate to="/login" replace />;
}

export default function AppRoutes() {
  return (
    <AdminThemeProvider>
      <BrowserRouter>
        <AdminClassWrapper>
          <Routes>
        <Route path="/" element={<ReservationLanding />} />
        <Route path="/venues" element={<ReservationLanding />} />
        <Route path="/manage-booking" element={<ManageBooking />} />
        <Route path="/reserve/:venueSlug" element={<DynamicVenueReservation />} />
                <Route path="/admin" element={<AdminEntry />} />
        <Route
          path="/admin/reservations"
          element={
            <RequireAdminAuth>
              <ReservationDashboard />
            </RequireAdminAuth>
          }
        />
                <Route
          path="/admin/cancelled"
          element={
            <RequireAdminAuth>
              <CancelledDashboard />
            </RequireAdminAuth>
          }
        />
                <Route
          path="/admin/seat-map-editor"
          element={
            <RequireAdminAuth permission="manage_seat_maps">
              <UnifiedSeatMapEditor />
            </RequireAdminAuth>
          }
        />
        <Route
          path="/admin/seatmap"
          element={
            <RequireAdminAuth permission="manage_seat_maps">
              <UnifiedSeatMapEditor />
            </RequireAdminAuth>
          }
        />
        <Route
          path="/admin/seat-map-editor-20-20A"
          element={
            <RequireAdminAuth permission="manage_seat_maps">
              <UnifiedSeatMapEditor />
            </RequireAdminAuth>
          }
        />
        <Route
          path="/admin/seat-map-editor-20-20B"
          element={
            <RequireAdminAuth permission="manage_seat_maps">
              <UnifiedSeatMapEditor />
            </RequireAdminAuth>
          }
        />
        <Route
          path="/admin/seat-map-editor-20-20C"
          element={
            <RequireAdminAuth permission="manage_seat_maps">
              <UnifiedSeatMapEditor />
            </RequireAdminAuth>
          }
        />
        <Route
          path="/admin/notifications"
          element={
            <RequireAdminAuth>
              <NotificationDashboard />
            </RequireAdminAuth>
          }
        />
        <Route
          path="/admin/accounts"
          element={
            <RequireAdminAuth permission="manage_accounts">
              <Accounts />
            </RequireAdminAuth>
          }
        />
        <Route
          path="/admin/roles"
          element={
            <RequireAdminAuth permission="manage_accounts">
              <RolesAndPermissions />
            </RequireAdminAuth>
          }
        />
        <Route
          path="/admin/settings"
          element={
            <RequireAdminAuth>
              <AccountSettings />
            </RequireAdminAuth>
          }
        />
        <Route
          path="/admin/reports"
          element={
            <RequireAdminAuth permission="view_outlet_reports">
              <Reports />
            </RequireAdminAuth>
          }
        />
        <Route
          path="/admin/outlets"
          element={
            <RequireAdminAuth permission="view_outlet_reports">
              <OutletDashboard />
            </RequireAdminAuth>
          }
        />
        <Route
          path="/admin/function-rooms"
          element={
            <RequireAdminAuth permission="manage_venues">
              <FunctionRooms />
            </RequireAdminAuth>
          }
        />
        <Route
          path="/admin/events"
          element={
            <RequireAdminAuth permission="manage_events">
              <EventManagement />
            </RequireAdminAuth>
          }
        />
        <Route
          path="/admin/outlets/:outletSlug"
          element={
            <RequireAdminAuth permission="view_outlet_reports">
              <OutletDashboard />
            </RequireAdminAuth>
          }
        />
        <Route path="/forgot-code" element={<ForgotCode />} />  
        <Route path="/activate/:token" element={<ActivateAccount />} />
        <Route path="/login" element={<LoginPage />} />  
        <Route path="/events/:slug" element={<EventBooking />} />
        <Route path="/:venueSlug" element={<DynamicVenueReservation />} />

          </Routes>
        </AdminClassWrapper>
      </BrowserRouter>
    </AdminThemeProvider>
  );
}
