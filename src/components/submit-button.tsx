"use client";

import { useFormStatus } from "react-dom";

// Кнопка отправки формы: пока сервер отвечает, она нажата и неактивна.
// Так повторное нажатие не создаёт второе задание или доску, а человек видит, что дело идёт.
export function SubmitButton({
  pendingText,
  children,
  disabled,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { pendingText?: string }) {
  const { pending } = useFormStatus();
  return (
    <button {...rest} type="submit" disabled={disabled || pending} aria-busy={pending || undefined}>
      {pending && pendingText ? pendingText : children}
    </button>
  );
}
