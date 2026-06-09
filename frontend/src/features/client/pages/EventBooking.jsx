import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import SharedNavbar from "../../../components/SharedNavbar";

export default function EventBooking() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // In a full implementation, this would fetch the event by slug
    // and then render the DynamicVenueReservation component but locked to the event date.
    setLoading(false);
  }, [slug]);

  return (
    <div style={{ minHeight: "100vh", background: "#F7F4EE" }}>
      <SharedNavbar onManageBooking={() => navigate("/manage-booking")} onLogoClick={() => navigate("/")} />
      <div style={{ padding: "60px 20px", textAlign: "center" }}>
        <h2>Event Booking: {slug}</h2>
        <p>This page will render the reservation form for the specific event, inheriting the seat map of its parent venue.</p>
        <button onClick={() => navigate("/")} style={{ padding: "10px 20px", marginTop: 20 }}>Return Home</button>
      </div>
    </div>
  );
}
