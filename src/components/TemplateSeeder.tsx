import { useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useData } from "../context/DataContext";
import { seedDefaultTemplates } from "../lib/actions";

/** Director only: seeds the 2 default Arabic templates the first time the app is opened. */
export function TemplateSeeder() {
  const { profile, isDirector } = useAuth();
  const { loaded } = useData();
  useEffect(() => {
    if (isDirector && loaded) seedDefaultTemplates(profile!.id).catch((e) => console.warn("[seed] templates", e));
  }, [isDirector, loaded, profile]);
  return null;
}
