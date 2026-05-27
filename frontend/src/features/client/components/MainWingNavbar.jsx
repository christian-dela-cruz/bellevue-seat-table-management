import { useNavigate } from "react-router-dom";

const C = {
  gold: "#C9A84C",
  goldDark: "#B89635",
  navy: "#1B2A4A",
  white: "#FFFFFF",
  muted: "#888888"
};

export default function MainWingNavbar({ active, wsConnected }) {
  const navigate = useNavigate();

  const venues = [
    { id: "alabang", name: "ALABANG FUNCTION ROOM" },
    { id: "laguna", name: "LAGUNA BALLROOM" },
    { id: "20-20", name: "20/20 FUNCTION ROOM" },
    { id: "business-center", name: "BUSINESS CENTER" }
  ];

  const handleVenueClick = (venueId) => {
    if (venueId === "alabang") {
      navigate("/alabang-reserve");
    } else {
      navigate(`/${venueId}`);
    }
  };

  return (
    <div style={{
      background: C.white,
      borderBottom: `1px solid rgba(201,168,76,0.15)`,
      padding: "0 40px",
      height: "64px",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      position: "sticky",
      top: 0,
      zIndex: 100,
      boxShadow: "0 2px 8px rgba(0,0,0,0.06)"
    }}>
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: 48,
        maxWidth: "1200px",
        width: "100%",
        justifyContent: "center"
      }}>
        {venues.map((venue) => (
          <button
            key={venue.id}
            onClick={() => handleVenueClick(venue.id)}
            style={{
              background: "none",
              border: "none",
              padding: "8px 16px",
              fontSize: "13px",
              fontWeight: 600,
              letterSpacing: "0.5px",
              color: active === venue.name ? C.gold : C.muted,
              cursor: "pointer",
              borderRadius: "4px",
              transition: "all 0.2s ease",
              fontFamily: "'Inter', sans-serif",
              position: "relative",
              ...(active === venue.name && {
                background: `${C.gold}15`,
                borderRadius: "6px"
              })
            }}
            onMouseEnter={(e) => {
              if (active !== venue.name) {
                e.currentTarget.style.color = C.gold;
                e.currentTarget.style.background = `${C.gold}08`;
              }
            }}
            onMouseLeave={(e) => {
              if (active !== venue.name) {
                e.currentTarget.style.color = C.muted;
                e.currentTarget.style.background = "none";
              }
            }}
          >
            {venue.name}
            {active === venue.name && (
              <div style={{
                position: "absolute",
                bottom: "-12px",
                left: "50%",
                transform: "translateX(-50%)",
                width: "4px",
                height: "4px",
                background: C.gold,
                borderRadius: "50%"
              }} />
            )}
          </button>
        ))}
      </div>
      
      {/* WebSocket Status Indicator */}
      {wsConnected !== undefined && (
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "4px 8px",
          borderRadius: 20,
          background: wsConnected ? "#10B981" : "#EF4444",
          border: `1px solid ${wsConnected ? "#059669" : "#DC2626"}`,
          marginLeft: "20px",
        }}>
          <div style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: "#FFFFFF",
            animation: wsConnected ? "pulse 2s infinite" : "none",
          }} />
          <div style={{
            fontFamily: "'Inter', sans-serif",
            fontSize: 10,
            fontWeight: 600,
            color: "#FFFFFF",
          }}>
            {wsConnected ? "LIVE" : "OFFLINE"}
          </div>
        </div>
      )}
    </div>
  );
}
