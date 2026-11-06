import { type ReactNode, useId } from "react";

export function PreviewSection({
  heading,
  children,
}: {
  heading: string;
  children: ReactNode;
}) {
  const id = useId();

  return (
    <section aria-labelledby={id} className="flex flex-col gap-4">
      <h2 id={id} className="text-lg font-semibold">
        {heading}
      </h2>
      {children}
    </section>
  );
}
