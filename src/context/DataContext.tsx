import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { collection, collectionGroup, doc, onSnapshot, query, where, type Query } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "./AuthContext";
import { errorMessage } from "../lib/authErrors";
import { DEFAULT_FINANCE_SETTINGS } from "../lib/finance";
import {
  COL,
  type FinanceSettings,
  type NotificationDoc,
  type PayoutDoc,
  type ProjectDoc,
  type ProjectFinanceDoc,
  type ProspectDoc,
  type TaskDoc,
  type TemplateDoc,
  type UserDoc,
  type WithId,
} from "../lib/types";

interface DataValue {
  users: WithId<UserDoc>[];
  projects: WithId<ProjectDoc>[];
  tasks: WithId<TaskDoc>[];
  notifications: WithId<NotificationDoc>[];
  /** director: all · sales: only those assigned to them · others: [] */
  prospects: WithId<ProspectDoc>[];
  templates: WithId<TemplateDoc>[];
  /** director: all · everyone else: only their OWN payouts (rules) */
  payouts: WithId<PayoutDoc>[];
  /** DIRECTOR ONLY — empty for everyone else, and never subscribed to */
  finances: Record<string, ProjectFinanceDoc>;
  financeSettings: FinanceSettings;
  loaded: boolean;
  error: string | null;
  userName: (uid: string) => string;
  directorIds: string[];
  /** Re-subscribe after a failed listener. */
  reload: () => void;
}

const DataContext = createContext<DataValue | null>(null);

export function useData(): DataValue {
  const v = useContext(DataContext);
  if (!v) throw new Error("useData must be used inside <DataProvider>");
  return v;
}

function listen<T>(q: Query, set: (rows: WithId<T>[]) => void, onError: (e: unknown) => void, onFirst: () => void) {
  let first = true;
  return onSnapshot(
    q,
    (snap) => {
      set(snap.docs.map((d) => ({ id: d.id, ...(d.data() as T) })));
      if (first) {
        first = false;
        onFirst();
      }
    },
    onError,
  );
}

/**
 * One set of realtime listeners for the whole signed-in app. What each role
 * subscribes to matches firestore.rules exactly (rules cannot filter):
 *   director → everything · others → own tasks, assigned projects (sales: also
 *   the ones they brought in), own notifications.
 */
export function DataProvider({ children }: { children: ReactNode }) {
  const { profile } = useAuth();
  const uid = profile!.id;
  const role = profile!.role;

  const [users, setUsers] = useState<WithId<UserDoc>[]>([]);
  const [assigned, setAssigned] = useState<WithId<ProjectDoc>[]>([]);
  const [brought, setBrought] = useState<WithId<ProjectDoc>[]>([]);
  const [tasks, setTasks] = useState<WithId<TaskDoc>[]>([]);
  const [notifications, setNotifications] = useState<WithId<NotificationDoc>[]>([]);
  const [prospects, setProspects] = useState<WithId<ProspectDoc>[]>([]);
  const [templates, setTemplates] = useState<WithId<TemplateDoc>[]>([]);
  const [payouts, setPayouts] = useState<WithId<PayoutDoc>[]>([]);
  const [finances, setFinances] = useState<Record<string, ProjectFinanceDoc>>({});
  const [financeSettings, setFinanceSettings] = useState<FinanceSettings>(DEFAULT_FINANCE_SETTINGS);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState<Record<string, boolean>>({});
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    setError(null);
    const settle = (k: string) => setReady((r) => ({ ...r, [k]: true }));
    const done = (k: string) => () => settle(k);
    const failing = (k: string) => (e: unknown) => {
      console.error(`[data] listener "${k}" failed`, e);
      setError(errorMessage(e));
      settle(k); // don't leave pages spinning forever
    };
    const offs: (() => void)[] = [];

    offs.push(listen<UserDoc>(collection(db, COL.users), setUsers, failing("users"), done("users")));
    offs.push(
      listen<NotificationDoc>(
        query(collection(db, COL.notifications), where("userId", "==", uid)),
        setNotifications,
        failing("notifications"),
        done("notifications"),
      ),
    );

    // Prospects + templates: director and sales only (rules deny everyone else).
    if (role === "director" || role === "sales") {
      offs.push(
        listen<ProspectDoc>(
          role === "director"
            ? collection(db, COL.prospects)
            : query(collection(db, COL.prospects), where("assigneeId", "==", uid)),
          setProspects,
          failing("prospects"),
          done("prospects"),
        ),
      );
      offs.push(listen<TemplateDoc>(collection(db, COL.templates), setTemplates, failing("templates"), done("templates")));
    } else {
      setReady((r) => ({ ...r, prospects: true, templates: true }));
    }

    // Payouts: the director sees all, everyone else only their own (rules deny the rest).
    offs.push(
      listen<PayoutDoc>(
        role === "director" ? collection(db, COL.payouts) : query(collection(db, COL.payouts), where("memberId", "==", uid)),
        setPayouts,
        failing("payouts"),
        done("payouts"),
      ),
    );

    // Finance (prices, costs, shares, client payments, settings): DIRECTOR ONLY — nobody else even subscribes.
    if (role === "director") {
      offs.push(
        onSnapshot(
          collectionGroup(db, COL.private),
          (snap) => {
            const m: Record<string, ProjectFinanceDoc> = {};
            snap.docs.forEach((d) => {
              const pid = d.ref.parent.parent?.id;
              if (pid && d.id === "finance") m[pid] = d.data() as ProjectFinanceDoc;
            });
            setFinances(m);
            done("finances")();
          },
          failing("finances"),
        ),
      );
      offs.push(
        onSnapshot(
          doc(db, COL.settings, "finance"),
          (snap) => {
            setFinanceSettings(snap.exists() ? { ...DEFAULT_FINANCE_SETTINGS, ...(snap.data() as Partial<FinanceSettings>) } : DEFAULT_FINANCE_SETTINGS);
            done("settings")();
          },
          failing("settings"),
        ),
      );
    } else {
      setReady((r) => ({ ...r, finances: true, settings: true }));
    }

    if (role === "director") {
      offs.push(listen<ProjectDoc>(collection(db, COL.projects), setAssigned, failing("projects"), done("projects")));
      offs.push(listen<TaskDoc>(collection(db, COL.tasks), setTasks, failing("tasks"), done("tasks")));
      setReady((r) => ({ ...r, brought: true }));
    } else {
      offs.push(
        listen<ProjectDoc>(
          query(collection(db, COL.projects), where("memberIds", "array-contains", uid)),
          setAssigned,
          failing("projects"),
          done("projects"),
        ),
      );
      offs.push(
        listen<TaskDoc>(
          query(collection(db, COL.tasks), where("assigneeId", "==", uid)),
          setTasks,
          failing("tasks"),
          done("tasks"),
        ),
      );
      if (role === "sales") {
        offs.push(
          listen<ProjectDoc>(
            query(collection(db, COL.projects), where("createdBy", "==", uid)),
            setBrought,
            failing("brought"),
            done("brought"),
          ),
        );
      } else {
        setReady((r) => ({ ...r, brought: true }));
      }
    }
    return () => offs.forEach((off) => off());
  }, [uid, role, attempt]);

  const value = useMemo<DataValue>(() => {
    const byId = new Map(users.map((u) => [u.id, u]));
    const merged = new Map([...assigned, ...brought].map((p) => [p.id, p]));
    return {
      users,
      projects: [...merged.values()],
      tasks,
      notifications,
      prospects,
      templates,
      payouts,
      finances,
      financeSettings,
      loaded: ["users", "projects", "tasks", "notifications", "brought", "prospects", "templates", "payouts", "finances", "settings"].every((k) => ready[k]),
      error,
      userName: (id) => byId.get(id)?.displayName ?? "عضو محذوف",
      directorIds: users.filter((u) => u.role === "director" && u.active).map((u) => u.id),
      reload: () => setAttempt((n) => n + 1),
    };
  }, [users, assigned, brought, tasks, notifications, prospects, templates, payouts, finances, financeSettings, error, ready]);

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}
