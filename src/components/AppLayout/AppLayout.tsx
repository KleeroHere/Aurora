import { useEffect, useMemo, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import Sidebar from "../Sidebar/Sidebar";
import TopBar from "../TopBar/TopBar";
import Breadcrumbs from "../Breadcrumbs/Breadcrumbs";
import LiteModeAutoNotice from "../LiteModeAutoNotice/LiteModeAutoNotice";
import ToastHost from "../ToastHost/ToastHost";
import PrintPreviewModal from "../PrintPreviewModal/PrintPreviewModal";
import HelpOverlay from "../HelpOverlay/HelpOverlay";
import { computeBackdropVars } from "../../utils/auroraBackdrop";
import { useZenMode } from "../../context/ZenModeContext";
import { useEmergencyMode } from "../../context/EmergencyModeContext";
import "./AppLayout.css";

//
const MAIN_BACKDROP_OPACITY = 42;

export default function AppLayout() {
  const location = useLocation();
  const { zenMode } = useZenMode();
  const { emergencyMode } = useEmergencyMode();
  const backdropStyle = useMemo(
    () => computeBackdropVars(location.pathname || "/", MAIN_BACKDROP_OPACITY),
    [location.pathname],
  );

  // On narrow screens the sidebar becomes a drawer. It closes itself on any
  // navigation and on Escape, so it never traps the user.
  const [navOpen, setNavOpen] = useState(false);
  useEffect(() => {
    setNavOpen(false);
  }, [location.pathname]);
  useEffect(() => {
    if (!navOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setNavOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [navOpen]);

  return (
    <div
      className={
        "app-layout" +
        (zenMode ? " app-layout--zen" : "") +
        (emergencyMode ? " app-layout--emergency" : "") +
        (navOpen ? " app-layout--nav-open" : "")
      }
    >
      <div className="app-layout__backdrop" style={backdropStyle} aria-hidden="true" />
      <Sidebar />
      <div
        className="app-layout__nav-scrim"
        aria-hidden="true"
        onClick={() => setNavOpen(false)}
      />
      <main className="app-layout__main">
        {!zenMode && <TopBar onOpenNav={() => setNavOpen(true)} />}
        <div className="app-layout__content">
          <LiteModeAutoNotice />
          {!zenMode && <Breadcrumbs />}
          <Outlet />
        </div>
        <div className="app-layout__search-scrim" aria-hidden="true" />
      </main>
      <ToastHost />
      <PrintPreviewModal />
      <HelpOverlay />
    </div>
  );
}
