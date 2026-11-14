import { Hammer } from "lucide-react";
import type { AppRoute } from "../lib/roles";
import { PageHeader } from "../components/PageHeader";

/** Empty page used until each feature screen is built in a later prompt. */
export function Placeholder({ route }: { route: AppRoute }) {
  const Icon = route.icon;
  return (
    <>
      <PageHeader title={route.label} />
      <div className="card grid place-items-center gap-3 px-6 py-16 text-center">
        <span className="grid size-16 place-items-center rounded-2xl bg-surface-2 text-muted">
          <Icon className="size-8" aria-hidden />
        </span>
        <p className="flex items-center gap-2 text-lg font-bold">
          <Hammer className="size-5 text-crimson-text" aria-hidden />
          هذه الصفحة قيد الإنجاز
        </p>
        <p className="max-w-sm text-sm leading-7 text-muted">{route.description}</p>
      </div>
    </>
  );
}
