import { useMemo } from "react";
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

  return (
    <div
      className={"app-layout" + (zenMode ? " app-layout--zen" : "") + (emergencyMode ? " app-layout--emergency" : "")}
    >
      <div className="app-layout__backdrop" style={backdropStyle} aria-hidden="true" />
      <Sidebar />
      <main className="app-layout__main">
        {!zenMode && <TopBar />}
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
