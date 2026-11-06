import type { ReactNode } from "react";

/** The caller says which it is: nothing exists yet, or nothing matches the filters. */
export function EmptyState({
  title,
  description,
  action,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-start gap-2 py-4">
      <p className="font-medium">{title}</p>
      {description ? (
        <p className="text-muted-foreground">{description}</p>
      ) : null}
      {action}
    </div>
  );
}
