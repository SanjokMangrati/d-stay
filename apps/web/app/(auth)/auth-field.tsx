import type { LucideIcon } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";

/**
 * The auth screens draw one bordered box per field, with the icon and label
 * inside it, so the tap target is the whole box rather than the input alone.
 * The box owns the border and the focus ring; the input inside it is `ghost`.
 */
export function AuthField({
  id,
  label,
  icon: Icon,
  description,
  error,
  action,
  ...props
}: ComponentProps<"input"> & {
  id: string;
  label: string;
  icon: LucideIcon;
  description?: string;
  error?: string;
  /** Rendered at the trailing edge of the box, e.g. a reveal-password toggle. */
  action?: ReactNode;
}) {
  return (
    <Field data-invalid={Boolean(error)}>
      <div className="border-input focus-within:border-ring focus-within:ring-ring/50 group-data-[invalid=true]/field:border-destructive flex items-center gap-3 rounded-xl border px-4 py-2 transition-colors focus-within:ring-3">
        <Icon className="text-primary size-5 shrink-0" aria-hidden />
        <div className="min-w-0 flex-1">
          <FieldLabel
            htmlFor={id}
            className="text-muted-foreground text-xs font-normal"
          >
            {label}
          </FieldLabel>
          <Input
            id={id}
            variant="ghost"
            className="h-7"
            aria-invalid={Boolean(error)}
            {...props}
          />
        </div>
        {action}
      </div>
      {description && <FieldDescription>{description}</FieldDescription>}
      <FieldError>{error}</FieldError>
    </Field>
  );
}
