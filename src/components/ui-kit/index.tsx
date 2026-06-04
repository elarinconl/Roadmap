import type { LucideIcon } from "lucide-react";
import { CheckCircle2, CircleDashed, Clock3, Pencil, Code2, FlaskConical, AlertTriangle, Ban } from "lucide-react";
import { cn } from "@/lib/utils";

type Tint = "green" | "blue" | "lavender" | "amber" | "red" | "gray" | "module";

const tintMap: Record<Tint, { bg: string; fg: string }> = {
  green: { bg: "bg-tint-green-bg", fg: "text-tint-green-fg" },
  blue: { bg: "bg-tint-blue-bg", fg: "text-tint-blue-fg" },
  lavender: { bg: "bg-tint-lavender-bg", fg: "text-tint-lavender-fg" },
  amber: { bg: "bg-tint-amber-bg", fg: "text-tint-amber-fg" },
  red: { bg: "bg-tint-red-bg", fg: "text-tint-red-fg" },
  gray: { bg: "bg-tint-gray-bg", fg: "text-tint-gray-fg" },
  module: { bg: "bg-module-tint", fg: "text-module" },
};

export function PageHeader({
  icon: Icon,
  title,
  subtitle,
  tint = "module",
  actions,
}: {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  tint?: Tint;
  actions?: React.ReactNode;
}) {
  const t = tintMap[tint];
  return (
    <div className="flex items-start justify-between gap-6 pb-6">
      <div className="flex items-start gap-4">
        <span
          className={cn(
            "flex h-11 w-11 items-center justify-center rounded-xl",
            t.bg,
          )}
        >
          <Icon className={cn("h-5 w-5", t.fg)} strokeWidth={1.75} />
        </span>
        <div>
          <h1 className="text-[26px] font-bold leading-tight tracking-tight text-foreground">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
          )}
        </div>
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export function StatCard({
  icon: Icon,
  label,
  value,
  tint = "gray",
}: {
  icon: LucideIcon;
  label: string;
  value: string | number;
  tint?: Tint;
}) {
  const t = tintMap[tint];
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4">
      <span
        className={cn("flex h-10 w-10 items-center justify-center rounded-xl", t.bg)}
      >
        <Icon className={cn("h-[18px] w-[18px]", t.fg)} strokeWidth={1.75} />
      </span>
      <div className="min-w-0">
        <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </div>
        <div className="mt-0.5 text-2xl font-semibold tabular-nums text-foreground">
          {value}
        </div>
      </div>
    </div>
  );
}

export function InfoBanner({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-tint-lavender-bg px-4 py-3 text-sm leading-relaxed text-tint-lavender-fg">
      {children}
    </div>
  );
}

export type StatusKey =
  | "to_do" | "in_design" | "in_dev" | "in_qa" | "completed"
  | "planeado" | "en_curso" | "en_riesgo" | "bloqueado" | "hecho";

export const statusMap: Record<string, { label: string; tint: Tint; icon: LucideIcon }> = {
  // Current English values
  to_do:      { label: "To Do",      tint: "gray",     icon: CircleDashed },
  in_design:  { label: "In Design",  tint: "lavender", icon: Pencil },
  in_dev:     { label: "In Dev",     tint: "blue",     icon: Code2 },
  in_qa:      { label: "In QA",      tint: "amber",    icon: FlaskConical },
  completed:  { label: "Completed",  tint: "green",    icon: CheckCircle2 },
  // Legacy Spanish values (pre-migration fallback)
  planeado:   { label: "To Do",      tint: "gray",     icon: CircleDashed },
  en_curso:   { label: "In Dev",     tint: "blue",     icon: Clock3 },
  en_riesgo:  { label: "In Dev",     tint: "amber",    icon: AlertTriangle },
  bloqueado:  { label: "To Do",      tint: "red",      icon: Ban },
  hecho:      { label: "Completed",  tint: "green",    icon: CheckCircle2 },
};

export const STATUS_OPTIONS: { value: StatusKey; label: string }[] = [
  { value: "to_do",     label: "To Do" },
  { value: "in_design", label: "In Design" },
  { value: "in_dev",    label: "In Dev" },
  { value: "in_qa",     label: "In QA" },
  { value: "completed", label: "Completed" },
];

export type ContribStatusKey = "to_do" | "in_design" | "in_dev" | "in_qa" | "in_progress" | "completed";

export const contribStatusMap: Record<ContribStatusKey, { label: string; tint: Tint; icon: LucideIcon }> = {
  to_do:      { label: "To Do",       tint: "gray",     icon: CircleDashed },
  in_design:  { label: "In Design",   tint: "lavender", icon: Pencil },
  in_dev:     { label: "In Dev",      tint: "blue",     icon: Code2 },
  in_qa:      { label: "In QA",       tint: "amber",    icon: FlaskConical },
  in_progress:{ label: "In Progress", tint: "blue",     icon: Clock3 },
  completed:  { label: "Completed",   tint: "green",    icon: CheckCircle2 },
};

export function ContribStatusBadge({ status }: { status: string }) {
  const s = contribStatusMap[status as ContribStatusKey] ?? { label: status, tint: "gray" as Tint, icon: CircleDashed };
  const t = tintMap[s.tint];
  const Icon = s.icon;
  return (
    <span className={cn("inline-flex h-6 items-center gap-1 rounded-full px-2.5 text-[11px] font-semibold", t.bg, t.fg)}>
      <Icon className="h-3 w-3" strokeWidth={2} />
      {s.label}
    </span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const s = statusMap[status] ?? statusMap.to_do;
  const t = tintMap[s.tint];
  const Icon = s.icon;
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center gap-1 rounded-full px-2.5 text-[11px] font-semibold",
        t.bg,
        t.fg,
      )}
    >
      <Icon className="h-3 w-3" strokeWidth={2} />
      {s.label}
    </span>
  );
}

export function CountPill({ value, tint = "gray" }: { value: number; tint?: Tint }) {
  const t = tintMap[tint];
  return (
    <span
      className={cn(
        "inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-semibold tabular-nums",
        t.bg,
        t.fg,
      )}
    >
      {value}
    </span>
  );
}

export function PrimaryButton({
  children,
  icon: Icon,
  onClick,
}: {
  children: React.ReactNode;
  icon?: LucideIcon;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
    >
      {Icon && <Icon className="h-4 w-4" strokeWidth={2} />}
      {children}
    </button>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border bg-card px-6 py-16 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted">
        <Icon className="h-5 w-5 text-muted-foreground" strokeWidth={1.75} />
      </span>
      <h3 className="text-base font-semibold text-foreground">{title}</h3>
      <p className="max-w-md text-sm text-muted-foreground">{description}</p>
    </div>
  );
}
