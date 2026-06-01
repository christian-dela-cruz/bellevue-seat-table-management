import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";

function getTokens(isDark) {
  return isDark
    ? {
        gold: "#C4A35A",
        goldLight: "#D9BC7A",
        goldFaint: "rgba(196,163,90,0.08)",
        goldFaintest: "rgba(196,163,90,0.04)",
        surfaceBase: "#111009",
        surfaceRaised: "#161410",
        surfaceInput: "rgba(255,255,255,0.04)",
        borderDefault: "rgba(255,255,255,0.08)",
        borderAccent: "rgba(196,163,90,0.30)",
        textPrimary: "#EDE8DF",
        textSecondary: "#C7BEAF", // Improved contrast from #8A8278
        textTertiary: "#9C9283",  // Improved contrast from rgba(237,232,223,0.32)
        red: "#B85C5C",
      }
    : {
        gold: "#8C6B2A",
        goldLight: "#A07D38",
        goldFaint: "rgba(140,107,42,0.07)",
        goldFaintest: "rgba(140,107,42,0.04)",
        surfaceBase: "#FFFFFF",
        surfaceRaised: "#FAF8F4",
        surfaceInput: "#FFFFFF",
        borderDefault: "rgba(0,0,0,0.08)",
        borderAccent: "rgba(140,107,42,0.28)",
        textPrimary: "#18140E",
        textSecondary: "#4E4537", // Improved contrast from #7A7060
        textTertiary: "#7A7060",  // Improved contrast from rgba(24,20,14,0.35)
        red: "#A03838",
      };
}

const F = {
  body: "'Inter','Helvetica Neue',Arial,sans-serif",
  label: "'Inter','Helvetica Neue',Arial,sans-serif",
};

export default function BellevueDropdown({
  value,
  onChange,
  options = [],
  placeholder = "Select an option",
  isDark = true,
  disabled = false,
  style = {},
  dropdownStyle = {},
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const containerRef = useRef(null);
  const triggerRef = useRef(null);
  const optionsRef = useRef(null);
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0 });

  const C = getTokens(isDark);

  // Normalize options to support both standard format and schedule slot format
  const normalizedOptions = (options || []).map((opt) => {
    if (typeof opt === "string") {
      let val = opt;
      if (/^\d{2}:\d{2}/.test(val)) val = val.substring(0, 5);
      return { value: val, label: opt, disabled: false };
    }
    let val = opt.value !== undefined ? opt.value : opt.time;
    if (typeof val === "string" && /^\d{2}:\d{2}/.test(val)) {
      val = val.substring(0, 5);
    }
    const lbl = opt.label !== undefined ? opt.label : opt.time;
    const isAvailable = opt.available !== undefined ? opt.available : !opt.disabled;
    return {
      value: val,
      label: lbl,
      disabled: !isAvailable,
      reason: opt.reason,
    };
  });

  const selectedOption = normalizedOptions.find((opt) => {
    let optVal = String(opt.value);
    let checkVal = String(value);
    if (/^\d{2}:\d{2}/.test(optVal)) optVal = optVal.substring(0, 5);
    if (/^\d{2}:\d{2}/.test(checkVal)) checkVal = checkVal.substring(0, 5);
    return optVal === checkVal;
  });

  // Toggle Dropdown
  const handleToggle = (e) => {
    e.preventDefault();
    if (disabled) return;
    setIsOpen((prev) => !prev);
  };

  // Select Option
  const handleSelect = (option) => {
    if (option.disabled) return;
    onChange(option.value);
    setIsOpen(false);
    triggerRef.current?.focus();
  };

  // Close when clicking outside
  useEffect(() => {
    const handleOutsideClick = (e) => {
      const clickedOutsideContainer = containerRef.current && !containerRef.current.contains(e.target);
      const clickedOutsideOptions = optionsRef.current && !optionsRef.current.contains(e.target);
      if (clickedOutsideContainer && clickedOutsideOptions) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  // Calculate Popover coordinates relative to viewport scroll
  const updateCoords = () => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setCoords({
        top: rect.bottom + window.scrollY,
        left: rect.left + window.scrollX,
        width: rect.width,
      });
    }
  };

  useEffect(() => {
    if (isOpen) {
      updateCoords();
      // Use capturing/passive listener to track scroll and adjust coords
      window.addEventListener("scroll", updateCoords, true);
      window.addEventListener("resize", updateCoords);
    }
    return () => {
      window.removeEventListener("scroll", updateCoords, true);
      window.removeEventListener("resize", updateCoords);
    };
  }, [isOpen]);

  // Keyboard navigation inside dropdown
  const handleKeyDown = (e) => {
    if (disabled) return;

    if (!isOpen) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        setIsOpen(true);
        // Find index of currently selected option, or first non-disabled option
        const selIndex = normalizedOptions.findIndex((opt) => String(opt.value) === String(value));
        setFocusedIndex(selIndex >= 0 ? selIndex : 0);
      }
      return;
    }

    switch (e.key) {
      case "Escape":
        e.preventDefault();
        setIsOpen(false);
        triggerRef.current?.focus();
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        if (focusedIndex >= 0 && focusedIndex < normalizedOptions.length) {
          handleSelect(normalizedOptions[focusedIndex]);
        }
        break;
      case "ArrowDown":
        e.preventDefault();
        setFocusedIndex((prev) => {
          let next = prev + 1;
          while (next < normalizedOptions.length && normalizedOptions[next].disabled) {
            next++;
          }
          return next < normalizedOptions.length ? next : prev;
        });
        break;
      case "ArrowUp":
        e.preventDefault();
        setFocusedIndex((prev) => {
          let next = prev - 1;
          while (next >= 0 && normalizedOptions[next].disabled) {
            next--;
          }
          return next >= 0 ? next : prev;
        });
        break;
      case "Tab":
        setIsOpen(false);
        break;
      default:
        break;
    }
  };

  // Scroll focused option into view
  useEffect(() => {
    if (isOpen && focusedIndex >= 0 && optionsRef.current) {
      const parent = optionsRef.current;
      const child = parent.children[focusedIndex];
      if (child) {
        const parentRect = parent.getBoundingClientRect();
        const childRect = child.getBoundingClientRect();
        if (childRect.bottom > parentRect.bottom) {
          parent.scrollTop += childRect.bottom - parentRect.bottom;
        } else if (childRect.top < parentRect.top) {
          parent.scrollTop -= parentRect.top - childRect.top;
        }
      }
    }
  }, [focusedIndex, isOpen]);

  // Split layout styles (for container) from visual styles (for trigger button)
  const {
    width,
    height,
    margin,
    marginTop,
    marginRight,
    marginBottom,
    marginLeft,
    flex,
    gridArea,
    position,
    top,
    left,
    right,
    bottom,
    zIndex,
    ...triggerVisualStyles
  } = style || {};

  return (
    <div
      ref={containerRef}
      onKeyDown={handleKeyDown}
      style={{
        position: position || "relative",
        width: width || "100%",
        margin,
        marginTop,
        marginRight,
        marginBottom,
        marginLeft,
        flex,
        gridArea,
        top,
        left,
        right,
        bottom,
        zIndex,
        fontFamily: F.body,
        boxSizing: "border-box",
      }}
    >
      <button
        ref={triggerRef}
        type="button"
        onClick={handleToggle}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        style={{
          width: "100%",
          height: height || style.height || 36,
          boxSizing: "border-box",
          padding: "0 14px",
          border: `1.5px solid ${isOpen ? C.borderAccent : C.borderDefault}`,
          borderRadius: 8,
          background: C.surfaceInput,
          color: selectedOption ? C.textPrimary : C.textSecondary,
          fontFamily: F.body,
          fontSize: 13,
          fontWeight: selectedOption ? 500 : 400,
          textAlign: "left",
          outline: "none",
          cursor: disabled ? "not-allowed" : "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
          transition: "border-color 0.18s, box-shadow 0.18s",
          boxShadow: isOpen ? `0 0 0 3px ${C.gold}1e` : "none",
          opacity: disabled ? 0.6 : 1,
          ...triggerVisualStyles,
        }}
        onMouseEnter={(e) => {
          if (!disabled && !isOpen) e.currentTarget.style.borderColor = C.borderAccent;
        }}
        onMouseLeave={(e) => {
          if (!disabled && !isOpen) e.currentTarget.style.borderColor = C.borderDefault;
        }}
      >
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <svg
          width="10"
          height="6"
          viewBox="0 0 10 6"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          style={{
            transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 0.2s ease",
            flexShrink: 0,
            stroke: C.gold,
            strokeWidth: 2,
            strokeLinecap: "round",
            strokeLinejoin: "round",
          }}
        >
          <path d="M1 1L5 5L9 1" />
        </svg>
      </button>

      {isOpen && createPortal(
        <div
          ref={optionsRef}
          role="listbox"
          style={{
            position: "absolute",
            top: coords.top + 4,
            left: coords.left,
            width: coords.width,
            zIndex: 999999, // Ensure it floats on top of everything
            maxHeight: 220,
            overflowY: "auto",
            background: C.surfaceRaised,
            border: `1.5px solid ${C.borderAccent}`,
            borderRadius: 8,
            boxShadow: isDark
              ? "0 10px 30px rgba(0,0,0,0.50), 0 1px 3px rgba(0,0,0,0.20)"
              : "0 10px 30px rgba(78,60,32,0.12), 0 1px 3px rgba(78,60,32,0.06)",
            padding: "4px 0",
            boxSizing: "border-box",
            scrollbarWidth: "thin",
            ...dropdownStyle,
          }}
        >
          {normalizedOptions.length === 0 ? (
            <div
              style={{
                padding: "10px 14px",
                color: C.textSecondary,
                fontSize: 12.5,
                fontStyle: "italic",
                textAlign: "center",
              }}
            >
              No options available
            </div>
          ) : (
            normalizedOptions.map((opt, i) => {
              const isSelected = selectedOption && String(selectedOption.value) === String(opt.value);
              const isFocused = i === focusedIndex;

              return (
                <button
                  key={`${opt.value}-${i}`}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  disabled={opt.disabled}
                  onClick={() => handleSelect(opt)}
                  onMouseEnter={() => !opt.disabled && setFocusedIndex(i)}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    width: "100%",
                    padding: "9px 14px",
                    background: isSelected
                      ? C.goldFaint
                      : isFocused
                      ? C.goldFaintest
                      : "transparent",
                    border: "none",
                    color: opt.disabled
                      ? C.textTertiary
                      : isSelected
                      ? C.gold
                      : C.textPrimary,
                    fontFamily: F.body,
                    fontSize: 12.5,
                    fontWeight: isSelected ? 600 : 400,
                    textAlign: "left",
                    cursor: opt.disabled ? "not-allowed" : "pointer",
                    outline: "none",
                    boxSizing: "border-box",
                    transition: "background 0.15s, color 0.15s",
                  }}
                >
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, paddingRight: 8 }}>
                    {opt.label}
                  </span>
                  {opt.disabled && (
                    <span
                      style={{
                        fontSize: 9.5,
                        fontFamily: F.label,
                        fontWeight: 700,
                        letterSpacing: "0.06em",
                        color: C.red,
                        textTransform: "uppercase",
                        background: `${C.red}12`,
                        padding: "1px 5px",
                        borderRadius: 4,
                        border: `1px solid ${C.red}25`,
                        flexShrink: 0,
                      }}
                    >
                      {opt.reason || "Unavailable"}
                    </span>
                  )}
                </button>
              );
            })
          )}
        </div>,
        document.body
      )}
    </div>
  );
}
