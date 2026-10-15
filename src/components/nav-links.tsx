"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Разделы в шапке: открытый раздел подчёркнут, чтобы было видно, где вы сейчас.
export function NavLinks({ links }: { links: { href: string; label: string }[] }) {
  const path = usePathname();
  // Самый длинный подходящий адрес: на /teacher/boards выделяется «Доска», а не «Работы».
  const current = links
    .filter((l) => !l.href.includes("#") && (path === l.href || path.startsWith(`${l.href}/`)))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;
  return (
    <nav className="nav" aria-label="Разделы">
      {links.map((l) => (
        <Link key={l.href} href={l.href} aria-current={l.href === current ? "page" : undefined}>
          {l.label}
        </Link>
      ))}
    </nav>
  );
}
