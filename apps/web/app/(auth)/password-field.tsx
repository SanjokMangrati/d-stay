"use client";

import { EyeIcon, EyeOffIcon, LockIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import type { ComponentProps } from "react";
import { AuthField } from "./auth-field";
import { Button } from "@/components/ui/button";

/**
 * A reveal toggle is not a nicety here: hosts type passwords one-handed on a
 * phone keyboard, where a typo is invisible and costs a whole retry.
 */
export function PasswordField(
  props: Omit<ComponentProps<typeof AuthField>, "icon" | "action" | "type">
) {
  const t = useTranslations("auth.fields");
  const [visible, setVisible] = useState(false);

  return (
    <AuthField
      {...props}
      icon={LockIcon}
      type={visible ? "text" : "password"}
      action={
        <Button
          type="button"
          variant="ghost"
          size="icon-lg"
          className="text-muted-foreground -mr-2 size-11 shrink-0 rounded-full"
          aria-pressed={visible}
          aria-label={visible ? t("hidePassword") : t("showPassword")}
          onClick={() => setVisible((shown) => !shown)}
        >
          {visible ? (
            <EyeOffIcon className="size-5" />
          ) : (
            <EyeIcon className="size-5" />
          )}
        </Button>
      }
    />
  );
}
