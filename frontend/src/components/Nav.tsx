"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "總覽" },
  { href: "/short", label: "短線" },
  { href: "/long", label: "長線" },
  { href: "/watchlist", label: "關注" },
];

export function Nav() {
  const pathname = usePathname();
  return (
    <header className="site-header">
      <div className="brand-wrap">
        <Link href="/" className="brand">
          stockIO
        </Link>
        <p className="brand-tag">美股掃描 · 建議參考</p>
      </div>
      <nav className="nav-links" aria-label="主選單">
        {links.map((l) => {
          const active = pathname === l.href;
          return (
            <Link key={l.href} href={l.href} className={active ? "nav-link active" : "nav-link"}>
              {l.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
