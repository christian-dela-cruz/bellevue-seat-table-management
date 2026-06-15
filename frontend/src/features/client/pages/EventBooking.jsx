import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { eventAPI } from "../../../services/eventAPI";
import VenueReservationTemplate from "./VenueReservationTemplate";

export default function EventBooking() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");

    eventAPI.getPublicBySlug(slug)
      .then((res) => {
        if (!active) return;
        if (res && res.status === "success" && res.data) {
          setEvent(res.data);
        } else {
          setError("Event not found.");
        }
      })
      .catch((err) => {
        if (active) setError(err.message || "Failed to load event details.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [slug]);

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: "#0A0908", display: "flex", alignItems: "center", justifyContent: "center", color: "#EDE8DF", fontFamily: "sans-serif" }}>
        <div style={{ textAlign: "center" }}>
          <h2>Loading Event...</h2>
          <p style={{ opacity: 0.6 }}>Preparing your reservation gateway</p>
        </div>
      </div>
    );
  }

  if (error || !event) {
    return (
      <div style={{ minHeight: "100vh", background: "#0A0908", display: "flex", alignItems: "center", justifyContent: "center", color: "#EDE8DF", flexDirection: "column", gap: 16, fontFamily: "sans-serif" }}>
        <h2>Error Loading Event</h2>
        <p style={{ color: "#C7BEAF" }}>{error || "We could not find the selected event."}</p>
        <button
          onClick={() => navigate("/")}
          style={{ padding: "10px 20px", background: "#C4A35A", border: "none", color: "#0A0908", fontWeight: "bold", borderRadius: 6, cursor: "pointer" }}
        >
          Return Home
        </button>
      </div>
    );
  }

  // Parse start_datetime to date (YYYY-MM-DD) and time (HH:MM)
  const startDt = new Date(event.start_datetime);
  const year = startDt.getFullYear();
  const month = String(startDt.getMonth() + 1).padStart(2, "0");
  const day = String(startDt.getDate()).padStart(2, "0");
  const hours = String(startDt.getHours()).padStart(2, "0");
  const minutes = String(startDt.getMinutes()).padStart(2, "0");

  const preselectedSchedule = {
    date: `${year}-${month}-${day}`,
    time: `${hours}:${minutes}`,
  };

  const hostVenue = event.venue;
  const roomName = hostVenue?.name || "";
  const wingName = hostVenue?.wing || "Main Wing";

  return (
    <VenueReservationTemplate
      roomName={roomName}
      wingName={wingName}
      isDynamic={true}
      eventId={event.id}
      preselectedSchedule={preselectedSchedule}
    />
  );
}
