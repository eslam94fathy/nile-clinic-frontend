import { useTranslations } from "next-intl";
import { Skeleton } from "@/components/ui/skeleton";

export function LoadingState({ label }: { label?: string }) {
  const t = useTranslations("shared.states");

  return (
    <div role="status" className="flex flex-col gap-2 py-4">
      <p className="text-muted-foreground">{label ?? t("loading")}</p>
      <Skeleton aria-hidden="true" className="h-4 w-3/4" />
      <Skeleton aria-hidden="true" className="h-4 w-1/2" />
    </div>
  );
}
