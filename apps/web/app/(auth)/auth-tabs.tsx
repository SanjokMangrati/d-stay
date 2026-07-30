import { useTranslations } from "next-intl";
import Link from "next/link";
import { SIGN_IN_PATH, SIGN_UP_PATH } from "@/lib/auth/auth-paths";
import { cn } from "@/lib/utils";

/**
 * Sign-in and sign-up stay separate routes — the segmented control is two links
 * that look like a toggle, so the back gesture and a shared URL still work.
 * The active tab is passed in rather than read from the pathname, which keeps
 * this a server component.
 */
const TABS = [
  { key: "signIn", href: SIGN_IN_PATH },
  { key: "signUp", href: SIGN_UP_PATH },
] as const;

export function AuthTabs({ active }: { active: (typeof TABS)[number]["key"] }) {
  const t = useTranslations("auth");

  return (
    <nav className="bg-muted flex rounded-full p-1">
      {TABS.map(({ key, href }) => (
        <Link
          key={key}
          href={href}
          aria-current={key === active ? "page" : undefined}
          className={cn(
            "flex-1 rounded-full py-2.5 text-center text-sm font-medium transition-colors",
            key === active
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground"
          )}
        >
          {t(`${key}.tab`)}
        </Link>
      ))}
    </nav>
  );
}
