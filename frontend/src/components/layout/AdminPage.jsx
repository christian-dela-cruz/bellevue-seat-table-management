const DEFAULT_FONTS = {
  body: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  label: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  display: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
};

export function adminMainStyle({ isMobile = false, isTablet = false } = {}) {
  return {
    flex: 1,
    minWidth: 0,
    height: "calc(100vh - 60px)",
    overflow: "auto",
    padding: isMobile ? "22px 16px 30px" : isTablet ? "26px 22px 36px" : "30px 32px 42px",
  };
}

export function AdminPageHeader({
  eyebrow,
  title,
  description,
  actions,
  meta,
  C = {},
  F = DEFAULT_FONTS,
  compact = false,
}) {
  const fonts = { ...DEFAULT_FONTS, ...F };
  const gold = C.gold || "#8C6B2A";
  const text = C.text || C.textPrimary || "#18140E";
  const muted = C.muted || C.textSecondary || "#7A7060";
  const faint = C.faint || C.textTertiary || "rgba(24,20,14,0.42)";

  return (
    <section
      className="admin-page-header"
      style={{
        display: "grid",
        gridTemplateColumns: actions ? "minmax(200px,1fr) auto" : "1fr",
        gap: 16,
        alignItems: "start",
        marginBottom: compact ? 17 : 18,
      }}
    >
      <div style={{ minWidth: 0 }}>
        {eyebrow && (
          <div
            style={{
              marginBottom: 7,
              color: gold,
            }}
          >
            <span
              style={{
                display: "block",
                fontFamily: fonts.label,
                fontSize: 9.5,
                fontWeight: 700,
                letterSpacing: "0.18em",
                textTransform: "uppercase",
              }}
            >
              {eyebrow}
            </span>
          </div>
        )}
        <h1
          style={{
            margin: 0,
            color: text,
            fontFamily: fonts.display || fonts.body,
            fontSize: compact ? 26 : 30,
            lineHeight: 1.12,
            fontWeight: 650,
            letterSpacing: 0,
          }}
        >
          {title}
        </h1>
        {description && (
          <p
            style={{
              maxWidth: 760,
              margin: "6px 0 0",
              color: muted,
              fontFamily: fonts.body,
              fontSize: 12.75,
              lineHeight: 1.58,
            }}
          >
            {description}
          </p>
        )}
        {meta && (
          <div style={{ marginTop: 8, color: faint, fontFamily: fonts.body, fontSize: 12 }}>
            {meta}
          </div>
        )}
      </div>
      {actions && (
        <div
          className="admin-page-header__actions"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            gap: 8,
            flexWrap: "wrap",
          }}
        >
          {actions}
        </div>
      )}
      <style>{`
        @media (max-width: 768px) {
          .admin-page-header {
            grid-template-columns: 1fr !important;
          }
          .admin-page-header h1 {
            font-size: 24px !important;
          }
          .admin-page-header__actions {
            justify-content: flex-start !important;
          }
        }
      `}</style>
    </section>
  );
}
