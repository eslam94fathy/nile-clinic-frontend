"use client";

import { Menu } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Link, usePathname } from "@/lib/i18n/navigation";

export type NavigationItem = { path: string; label: string };

export function Navigation({
  items,
  label,
  menuLabel,
}: {
  items: NavigationItem[];
  label: string;
  menuLabel: string;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <nav aria-label={label} className="shrink-0 p-4 md:w-56 md:pe-0">
      <Button
        type="button"
        variant="outline"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="md:hidden"
      >
        <Menu aria-hidden="true" />
        {menuLabel}
      </Button>
      <ul
        className={`${open ? "flex" : "hidden"} mt-2 flex-col gap-1 md:mt-0 md:flex`}
      >
        {items.map(({ path, label: itemLabel }) => {
          const href = `/${path}`;
          const current = pathname === href || pathname.startsWith(`${href}/`);

          return (
            <li key={path}>
              <Link
                href={href}
                aria-current={current ? "page" : undefined}
                onClick={() => setOpen(false)}
                // The bar and weight mark the current page, so it doesn't rely on color alone.
                className={`block rounded-md border-s-4 px-3 py-2 hover:bg-accent hover:text-accent-foreground ${
                  current
                    ? "border-primary bg-accent font-semibold text-accent-foreground"
                    : "border-transparent"
                }`}
              >
                {itemLabel}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
