import { useState } from "react";
import type { ReactNode } from "react";
import SplashScreen from "./SplashScreen";
import LoginScreen from "./LoginScreen";

type Stage = "splash" | "login" | "app";

export default function StartupGate({ children }: { children: ReactNode }) {
  const [stage, setStage] = useState<Stage>("splash");

  if (stage === "splash") {
    return <SplashScreen onDone={() => setStage("login")} />;
  }
  if (stage === "login") {
    return <LoginScreen onContinue={() => setStage("app")} />;
  }
  return <>{children}</>;
}
