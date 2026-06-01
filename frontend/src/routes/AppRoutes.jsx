import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import ReservationLanding from "../features/client/pages/ReservationLanding";
import ManageBooking from "../features/client/pages/ManageBooking";
import DynamicVenueReservation from "../features/client/pages/DynamicVenueReservation";
import ReservationDashboard from "../features/admin/pages/ReservationDashboard";
import UnifiedSeatMapEditor from "../features/admin/pages/UnifiedSeatMapEditor";
import NotificationDashboard from "../features/admin/pages/Notifications";
import CancelledDashboard from "../features/admin/pages/CancelledDashboard";
import Accounts from "../features/admin/pages/Accounts";
import AccountSettings from "../features/admin/pages/AccountSettings";
import Reports from "../features/admin/pages/Reports";
import OutletDashboard from "../features/admin/pages/OutletDashboard";
import FunctionRooms from "../features/admin/pages/FunctionRooms";
import ForgotCode from "../features/client/pages/ForgotCode";
import LoginPage from "../features/auth/pages/LoginPage";
import { authAPI } from "../services/authAPI";
import SharedNavbar from "../components/SharedNavbar";

function RequireAdminAuth({ children }) {
  if (!authAPI.isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

function AdminEntry() {
  return <Navigate to="/login" replace />;
}

export default function AppRoutes() {
  return (
    <BrowserRouter>
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
            <RequireAdminAuth>
              <UnifiedSeatMapEditor />
            </RequireAdminAuth>
          }
        />
        <Route
          path="/admin/seatmap"
          element={
            <RequireAdminAuth>
              <UnifiedSeatMapEditor />
            </RequireAdminAuth>
          }
        />
        <Route
          path="/admin/seat-map-editor-20-20A"
          element={
            <RequireAdminAuth>
              <UnifiedSeatMapEditor />
            </RequireAdminAuth>
          }
        />
        <Route
          path="/admin/seat-map-editor-20-20B"
          element={
            <RequireAdminAuth>
              <UnifiedSeatMapEditor />
            </RequireAdminAuth>
          }
        />
        <Route
          path="/admin/seat-map-editor-20-20C"
          element={
            <RequireAdminAuth>
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
            <RequireAdminAuth>
              <Accounts />
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
            <RequireAdminAuth>
              <Reports />
            </RequireAdminAuth>
          }
        />
        <Route
          path="/admin/outlets"
          element={
            <RequireAdminAuth>
              <OutletDashboard />
            </RequireAdminAuth>
          }
        />
        <Route
          path="/admin/function-rooms"
          element={
            <RequireAdminAuth>
              <FunctionRooms />
            </RequireAdminAuth>
          }
        />
        <Route
          path="/admin/outlets/:outletSlug"
          element={
            <RequireAdminAuth>
              <OutletDashboard />
            </RequireAdminAuth>
          }
        />
        <Route path="/forgot-code" element={<ForgotCode />} />  
        <Route path="/login" element={<LoginPage />} />  
        <Route path="/:venueSlug" element={<DynamicVenueReservation />} />

      </Routes>
    </BrowserRouter>
  );
}
