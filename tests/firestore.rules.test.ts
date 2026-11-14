// Critical-permission tests only (see README → Testing).
// Run with: npm run test:rules   (starts the Firestore emulator for you)
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { collection, deleteDoc, doc, getDoc, getDocs, query, serverTimestamp, setDoc as setDocClient, updateDoc, where } from "firebase/firestore";

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: "dragonvision-rules-test",
    firestore: { rules: readFileSync("firestore.rules", "utf8") },
  });
});

afterAll(async () => {
  await env.cleanup();
});

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    const { setDoc } = await import("firebase/firestore");
    const user = (role: string, active = true) => ({
      displayName: role,
      email: `${role}@example.com`,
      role,
      active,
      createdAt: new Date(),
    });
    await setDoc(doc(db, "users/director1"), user("director"));
    await setDoc(doc(db, "users/editor1"), user("editor"));
    await setDoc(doc(db, "users/editor2"), user("editor"));
    await setDoc(doc(db, "users/gone1"), user("editor", false));

    const project = (members: string[]) => ({
      title: "P",
      clientName: "C",
      stage: "script",
      memberIds: members,
      createdBy: "director1",
    });
    await setDoc(doc(db, "projects/p1"), project(["editor1", "gone1"]));
    await setDoc(doc(db, "projects/p2"), project(["editor2"]));
    await setDoc(doc(db, "projects/p1/private/finance"), {
      price: 1000,
      toolsCost: 100,
      currency: "TND",
      commissionRate: 0.1,
      shares: {},
      clientPaid: false,
    });
    const payout = (projectId: string, memberId: string, amount: number) => ({
      projectId, projectTitle: "P", memberId, amount, type: "fee", status: "ready", method: "",
      createdAt: new Date(), paidAt: null, dueAt: new Date(), updatedAt: new Date(),
    });
    await setDoc(doc(db, "payouts/p1_editor1_fee"), payout("p1", "editor1", 100));
    await setDoc(doc(db, "payouts/p2_editor2_fee"), payout("p2", "editor2", 200));

    const task = (projectId: string, assigneeId: string, status: string) => ({
      projectId,
      stage: "script",
      title: "T",
      instructions: "",
      assigneeId,
      dueDate: null,
      status,
      deliverableUrl: status === "in_review" ? "https://drive.google.com/x" : "",
      reviewNotes: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await setDoc(doc(db, "tasks/t1"), task("p1", "editor1", "in_progress"));
    await setDoc(doc(db, "tasks/t1r"), task("p1", "editor1", "in_review"));
    await setDoc(doc(db, "tasks/t2"), task("p2", "editor2", "in_progress"));

    // prospects pipeline
    const user2 = (role: string) => ({ displayName: role, email: `${role}@example.com`, role, active: true, createdAt: new Date() });
    for (const r of ["audio1", "gen1", "sales1", "sales2"]) {
      await setDoc(doc(db, `users/${r}`), user2(r.startsWith("audio") ? "audio" : r.startsWith("gen") ? "gen_assistant" : "sales"));
    }
    const prospect = (assigneeId: string) => ({
      name: "P", city: "تونس", sector: "مطاعم", pageUrl: "", followers: 100, lastPost: "this_week", runningAds: "yes",
      quality: 1, notes: "", outreachStatus: "not_contacted", nextFollowUp: null, assigneeId, lostReason: "",
      projectId: "", createdBy: "director1", createdAt: new Date(), updatedAt: new Date(),
    });
    await setDoc(doc(db, "prospects/pr1"), prospect("sales1"));
    await setDoc(doc(db, "prospects/pr2"), prospect("sales2"));
    await setDoc(doc(db, "prospects/pr1/activities/a1"), { type: "note", channel: "phone", text: "x", createdBy: "sales1", createdAt: new Date() });
    await setDoc(doc(db, "prospects/pr2/activities/a2"), { type: "note", channel: "phone", text: "x", createdBy: "sales2", createdAt: new Date() });
    await setDoc(doc(db, "templates/tpl1"), { title: "T", body: "Hi {name}", createdBy: "director1", createdAt: new Date(), updatedAt: new Date() });

    const note = (userId: string) => ({ userId, type: "task_assigned", projectId: "p1", taskId: "t1", text: "x", read: false, createdAt: new Date() });
    await setDoc(doc(db, "notifications/n1"), note("editor1"));
    await setDoc(doc(db, "notifications/n2"), note("editor2"));
  });
});

const as = (uid: string) =>
  env.authenticatedContext(uid, { email: `${uid}@example.com`, email_verified: true }).firestore();

describe("critical permissions", () => {
  it("1. a non-director cannot read projects/{id}/private/finance", async () => {
    // even an editor who IS assigned to the project
    await assertFails(getDoc(doc(as("editor1"), "projects/p1/private/finance")));
    await assertSucceeds(getDoc(doc(as("director1"), "projects/p1/private/finance")));
  });

  it("2. a member cannot change their own role", async () => {
    const db = as("editor1");
    await assertFails(updateDoc(doc(db, "users/editor1"), { role: "director" }));
    await assertFails(updateDoc(doc(db, "users/editor1"), { role: "sales" }));
    await assertFails(updateDoc(doc(db, "users/editor1"), { active: true, role: "audio" }));
    // control: harmless self-edit still works, so the denials above are about `role`
    await assertSucceeds(updateDoc(doc(db, "users/editor1"), { displayName: "New name" }));
    // and the director can change someone else's role
    await assertSucceeds(updateDoc(doc(as("director1"), "users/editor1"), { role: "audio" }));
  });

  it("3. a member cannot read another member's payouts", async () => {
    const db = as("editor1");
    await assertFails(getDoc(doc(db, "payouts/p2_editor2_fee")));
    await assertFails(getDocs(query(collection(db, "payouts"), where("memberId", "==", "editor2"))));
    await assertFails(getDocs(collection(db, "payouts"))); // unfiltered list
    // control: own payout is readable, by id and by an own-only query
    await assertSucceeds(getDoc(doc(db, "payouts/p1_editor1_fee")));
    await assertSucceeds(getDocs(query(collection(db, "payouts"), where("memberId", "==", "editor1"))));
  });

  it("4. a member cannot read a project they are not assigned to", async () => {
    const db = as("editor1");
    await assertFails(getDoc(doc(db, "projects/p2")));
    await assertSucceeds(getDoc(doc(db, "projects/p1")));
  });

  it("5. a deactivated member is denied", async () => {
    const db = as("gone1");
    // gone1 is listed in p1.memberIds, owns no payout — still denied everywhere
    await assertFails(getDoc(doc(db, "projects/p1")));
    await assertFails(getDocs(query(collection(db, "projects"), where("memberIds", "array-contains", "gone1"))));
    await assertFails(getDocs(collection(db, "users")));
    await assertFails(updateDoc(doc(db, "users/gone1"), { active: true }));
    await assertFails(updateDoc(doc(db, "users/gone1"), { displayName: "x" }));
  });
  // ── Core-workflow permissions ───────────────────────────────────────────
  it("6. an assignee cannot set their own task to approved or changes_requested", async () => {
    const db = as("editor1");
    await assertFails(updateDoc(doc(db, "tasks/t1r"), { status: "approved", updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(doc(db, "tasks/t1r"), { status: "changes_requested", updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(doc(db, "tasks/t1"), { status: "approved", updatedAt: serverTimestamp() })); // skipping review
    // control: the legal move (in_progress → in_review with a valid link) works
    await assertSucceeds(
      updateDoc(doc(db, "tasks/t1"), { status: "in_review", deliverableUrl: "https://drive.google.com/file/d/1", updatedAt: serverTimestamp() }),
    );
  });

  it("7. an assignee cannot change the assignee, project or stage of a task", async () => {
    const db = as("editor1");
    await assertFails(updateDoc(doc(db, "tasks/t1"), { assigneeId: "editor2", updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(doc(db, "tasks/t1"), { projectId: "p2", updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(doc(db, "tasks/t1"), { stage: "editing", updatedAt: serverTimestamp() }));
    // control: attaching a link is allowed
    await assertSucceeds(updateDoc(doc(db, "tasks/t1"), { deliverableUrl: "https://drive.google.com/file/d/1", updatedAt: serverTimestamp() }));
  });

  it("8. a non-director cannot change a project's stage", async () => {
    await assertFails(updateDoc(doc(as("editor1"), "projects/p1"), { stage: "generation", updatedAt: serverTimestamp() }));
    // director: one step forward is fine, skipping stages is not
    await assertFails(updateDoc(doc(as("director1"), "projects/p1"), { stage: "editing", updatedAt: serverTimestamp() }));
    await assertSucceeds(updateDoc(doc(as("director1"), "projects/p1"), { stage: "generation", updatedAt: serverTimestamp() }));
  });

  it("9. a member cannot read or write tasks of a project they are not assigned to", async () => {
    const db = as("editor2"); // not on p1, not the assignee of t1
    await assertFails(getDoc(doc(db, "tasks/t1")));
    await assertFails(getDocs(query(collection(db, "tasks"), where("projectId", "==", "p1"))));
    await assertFails(updateDoc(doc(db, "tasks/t1"), { status: "in_review", deliverableUrl: "https://x.co/a", updatedAt: serverTimestamp() }));
    await assertFails(deleteDoc(doc(db, "tasks/t1")));
    await assertSucceeds(getDoc(doc(as("editor1"), "tasks/t1"))); // control
  });

  it("10. a user cannot read another user's notifications", async () => {
    const db = as("editor1");
    await assertFails(getDoc(doc(db, "notifications/n2")));
    await assertFails(getDocs(query(collection(db, "notifications"), where("userId", "==", "editor2"))));
    await assertFails(updateDoc(doc(db, "notifications/n2"), { read: true }));
    // control: own notifications can be read and marked read
    await assertSucceeds(getDoc(doc(db, "notifications/n1")));
    await assertSucceeds(updateDoc(doc(db, "notifications/n1"), { read: true }));
  });
  // ── Prospects pipeline ─────────────────────────────────────────────────
  it("11. editor / audio / gen_assistant cannot read prospects", async () => {
    for (const uid of ["editor1", "audio1", "gen1"]) {
      const db = as(uid);
      await assertFails(getDoc(doc(db, "prospects/pr1")));
      await assertFails(getDocs(collection(db, "prospects")));
      await assertFails(getDocs(collection(db, "prospects/pr1/activities")));
      await assertFails(getDocs(collection(db, "templates")));
    }
    await assertSucceeds(getDoc(doc(as("director1"), "prospects/pr1"))); // control
    await assertSucceeds(getDoc(doc(as("sales1"), "prospects/pr1"))); // control
  });

  it("12. sales cannot read a prospect assigned to another user", async () => {
    const db = as("sales1");
    await assertFails(getDoc(doc(db, "prospects/pr2")));
    await assertFails(getDocs(query(collection(db, "prospects"), where("assigneeId", "==", "sales2"))));
    await assertFails(getDocs(collection(db, "prospects"))); // unfiltered list
    await assertFails(getDocs(collection(db, "prospects/pr2/activities")));
    await assertSucceeds(getDocs(query(collection(db, "prospects"), where("assigneeId", "==", "sales1")))); // control
    await assertSucceeds(getDocs(collection(db, "prospects/pr1/activities"))); // control
  });

  it("13. sales cannot change assigneeId or delete a prospect", async () => {
    const db = as("sales1");
    await assertFails(updateDoc(doc(db, "prospects/pr1"), { assigneeId: "sales2", updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(doc(db, "prospects/pr1"), { assigneeId: "", updatedAt: serverTimestamp() }));
    await assertFails(deleteDoc(doc(db, "prospects/pr1")));
    await assertFails(updateDoc(doc(db, "prospects/pr2"), { notes: "x", updatedAt: serverTimestamp() })); // not theirs
    // a sales user can only create prospects for themselves
    const mine = { name: "N", city: "", sector: "", pageUrl: "", followers: 0, lastPost: "", runningAds: "unclear", quality: null,
      notes: "", outreachStatus: "not_contacted", nextFollowUp: null, lostReason: "", projectId: "", createdBy: "sales1",
      createdAt: serverTimestamp(), updatedAt: serverTimestamp() };
    await assertFails(setDocClient(doc(db, "prospects/new1"), { ...mine, assigneeId: "sales2" }));
    await assertSucceeds(setDocClient(doc(db, "prospects/new2"), { ...mine, assigneeId: "sales1" })); // control
    await assertSucceeds(updateDoc(doc(db, "prospects/pr1"), { notes: "تم الاتصال", updatedAt: serverTimestamp() })); // control
    await assertSucceeds(updateDoc(doc(as("director1"), "prospects/pr1"), { assigneeId: "sales2", updatedAt: serverTimestamp() })); // director may reassign
  });

  it("14. only the director can write templates", async () => {
    const tpl = { title: "قالب", body: "مرحبا {name}", createdBy: "x", createdAt: serverTimestamp(), updatedAt: serverTimestamp() };
    for (const uid of ["sales1", "editor1"]) {
      const db = as(uid);
      await assertFails(setDocClient(doc(db, "templates/new"), { ...tpl, createdBy: uid }));
      await assertFails(updateDoc(doc(db, "templates/tpl1"), { body: "x", updatedAt: serverTimestamp() }));
      await assertFails(deleteDoc(doc(db, "templates/tpl1")));
    }
    await assertSucceeds(getDoc(doc(as("sales1"), "templates/tpl1"))); // sales can read
    await assertSucceeds(setDocClient(doc(as("director1"), "templates/new"), { ...tpl, createdBy: "director1" }));
    await assertSucceeds(updateDoc(doc(as("director1"), "templates/tpl1"), { body: "x", updatedAt: serverTimestamp() }));
  });
  // ── Finance ────────────────────────────────────────────────────────────
  it("15. a non-director cannot create, update or delete any payout (including their own status)", async () => {
    const newPayout = {
      projectId: "p1", projectTitle: "P", memberId: "editor1", amount: 999, type: "commission", status: "awaiting_client_payment",
      method: "", createdAt: serverTimestamp(), paidAt: null, dueAt: null, updatedAt: serverTimestamp(),
    };
    for (const uid of ["editor1", "sales1"]) {
      const db = as(uid);
      await assertFails(updateDoc(doc(db, "payouts/p1_editor1_fee"), { status: "paid", paidAt: serverTimestamp(), method: "نقداً", updatedAt: serverTimestamp() }));
      await assertFails(updateDoc(doc(db, "payouts/p1_editor1_fee"), { amount: 5000, updatedAt: serverTimestamp() }));
      await assertFails(setDocClient(doc(db, "payouts/p1_editor1_commission"), newPayout));
      await assertFails(deleteDoc(doc(db, "payouts/p1_editor1_fee")));
    }
    // controls: the director can, and the rules enforce the flow + the deterministic id
    const dir = as("director1");
    await assertFails(setDocClient(doc(dir, "payouts/random-id"), newPayout)); // id must be projectId_memberId_type
    await assertSucceeds(setDocClient(doc(dir, "payouts/p1_editor1_commission"), newPayout));
    await assertSucceeds(updateDoc(doc(dir, "payouts/p1_editor1_fee"), { status: "paid", paidAt: serverTimestamp(), method: "D17", updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(doc(dir, "payouts/p1_editor1_fee"), { amount: 1, updatedAt: serverTimestamp() })); // paid is final
  });

  it("16. a non-director cannot read or write settings/finance", async () => {
    const settings = { defaultCommissionRate: 12, minProjectPrice: 500, paymentDelayDays: 3, updatedAt: serverTimestamp() };
    for (const uid of ["editor1", "sales1"]) {
      const db = as(uid);
      await assertFails(getDoc(doc(db, "settings/finance")));
      await assertFails(setDocClient(doc(db, "settings/finance"), settings));
    }
    await assertSucceeds(setDocClient(doc(as("director1"), "settings/finance"), settings)); // control
    await assertSucceeds(getDoc(doc(as("director1"), "settings/finance")));
    await assertFails(getDoc(doc(as("editor1"), "settings/finance"))); // still denied once it exists
  });
});
