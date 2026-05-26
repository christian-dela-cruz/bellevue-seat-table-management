import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import ReservationLanding from "../features/client/pages/ReservationLanding";
import ManageBooking from "../features/client/pages/ManageBooking";
import DynamicVenueReservation from "../features/client/pages/DynamicVenueReservation";
import AlabangReserve from "../features/client/pages/MainWing/AlabangReserve";
import LagunaReserv1e from "../features/client/pages/MainWing/LagunaReserv1e";
import LagunaReserve2 from "../features/client/pages/MainWing/LagunaReserve2";
import TwentyTwentyReserveA from "../features/client/pages/MainWing/TwentyTwentyReserveA";
import TwentyTwentyReserveB from "../features/client/pages/MainWing/TwentyTwentyReserveB";
import TwentyTwentyReserveC from "../features/client/pages/MainWing/TwentyTwentyReserveC";
import BusinessCenterReserve from "../features/client/pages/MainWing/BusinessCenterReserve";
// TowerWing components
import Tower1 from "../features/client/pages/TowerWing/Tower1";
import Tower2 from "../features/client/pages/TowerWing/Tower2";
import Tower3 from "../features/client/pages/TowerWing/Tower3";
// Dining components
import Hanakazu from "../features/client/pages/Dining/Hanakazu";
import PhoenixCourt from "../features/client/pages/Dining/PhoenixCourt";
import Qsina from "../features/client/pages/Dining/Qsina";
// GrandBallroom components
import GrandBallroomA from "../features/client/pages/TowerWing/GrandBallroomA";
import GrandBallroomB from "../features/client/pages/TowerWing/GrandBallroomB";
import GrandBallroomC from "../features/client/pages/TowerWing/GrandBallroomC";
import ReservationDashboard from "../features/admin/pages/ReservationDashboard";
import UnifiedSeatMapEditor from "../features/admin/pages/UnifiedSeatMapEditor";
import NotificationDashboard from "../features/admin/pages/Notifications";
import CancelledDashboard from "../features/admin/pages/CancelledDashboard";
import Accounts from "../features/admin/pages/Accounts";
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
        <Route path="/alabang-reserve" element={<><SharedNavbar /><AlabangReserve /></>} />
        <Route path="/laguna-reserv1e" element={<><SharedNavbar /><LagunaReserv1e /></>} />
        <Route path="/laguna-reserv2e" element={<><SharedNavbar /><LagunaReserve2 /></>} />
        <Route path="/twenty-twenty-a" element={<><SharedNavbar /><TwentyTwentyReserveA /></>} />
        <Route path="/twenty-twenty-b" element={<><SharedNavbar /><TwentyTwentyReserveB /></>} />
        <Route path="/twenty-twenty-c" element={<><SharedNavbar /><TwentyTwentyReserveC /></>} />
        <Route path="/business-center-reserve" element={<><SharedNavbar /><BusinessCenterReserve /></>} />
        {/* TowerWing routes */}
        <Route path="/tower1" element={<><SharedNavbar /><Tower1 /></>} />
        <Route path="/tower2" element={<><SharedNavbar /><Tower2 /></>} />
        <Route path="/tower3" element={<><SharedNavbar /><Tower3 /></>} />
        <Route path="/tower-ballroom" element={<><SharedNavbar /><Tower1 /></>} />
        {/* Dining routes */}
        <Route path="/hanakazu" element={<><SharedNavbar /><Hanakazu /></>} />
        <Route path="/phoenix-court" element={<><SharedNavbar /><PhoenixCourt /></>} />
        <Route path="/qsina" element={<><SharedNavbar /><Qsina /></>} />
        {/* GrandBallroom routes */}
        <Route path="/grand-ballroom" element={<><SharedNavbar /><GrandBallroomA /></>} />
        <Route path="/grand-ballroom-a" element={<><SharedNavbar /><GrandBallroomA /></>} />
        <Route path="/grand-ballroom-b" element={<><SharedNavbar /><GrandBallroomB /></>} />
        <Route path="/grand-ballroom-c" element={<><SharedNavbar /><GrandBallroomC /></>} />
        <Route path="/reserve/:venueSlug" element={<><SharedNavbar /><DynamicVenueReservation /></>} />
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
        <Route path="/:venueSlug" element={<><SharedNavbar /><DynamicVenueReservation /></>} />

      </Routes>
    </BrowserRouter>
  );
}
