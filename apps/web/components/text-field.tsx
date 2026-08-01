import type { ComponentProps } from "react";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

interface FieldShellProps {
  id: string;
  label: string;
  description?: string;
  error?: string;
}

/**
 * The labelled input the signed-in app uses everywhere. The auth screens draw
 * their own bordered variant because that surface is styled differently; inside
 * the app a field is a label, a control and its error.
 */
export function TextField({
  id,
  label,
  description,
  error,
  ...props
}: ComponentProps<"input"> & FieldShellProps) {
  return (
    <Field data-invalid={Boolean(error)}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input id={id} aria-invalid={Boolean(error)} {...props} />
      {description && <FieldDescription>{description}</FieldDescription>}
      <FieldError>{error}</FieldError>
    </Field>
  );
}

export function TextAreaField({
  id,
  label,
  description,
  error,
  ...props
}: ComponentProps<"textarea"> & FieldShellProps) {
  return (
    <Field data-invalid={Boolean(error)}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Textarea id={id} aria-invalid={Boolean(error)} {...props} />
      {description && <FieldDescription>{description}</FieldDescription>}
      <FieldError>{error}</FieldError>
    </Field>
  );
}
