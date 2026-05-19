import { useState } from "react";
import { PhoneFrame } from "./PhoneFrame";
import { StatusBar } from "./StatusBar";
import { TabBar } from "./TabBar";
import { TabKey } from "./types";
import { HomeScreen } from "./screens/HomeScreen";
import { CoachScreen } from "./screens/CoachScreen";
import { GoalsScreen } from "./screens/GoalsScreen";
import { WorshipScreen } from "./screens/WorshipScreen";
import { MeScreen } from "./screens/MeScreen";

export function NiyatApp() {
  const [tab, setTab] = useState<TabKey>("home");
  return (
    <PhoneFrame>
      <StatusBar />
      <main key={tab} className="flex-1 min-h-0 fade-up">
        {tab === "home" && <HomeScreen />}
        {tab === "goals" && <GoalsScreen />}
        {tab === "coach" && <CoachScreen />}
        {tab === "worship" && <WorshipScreen />}
        {tab === "me" && <MeScreen />}
      </main>
      <TabBar active={tab} onChange={setTab} />
    </PhoneFrame>
  );
}
