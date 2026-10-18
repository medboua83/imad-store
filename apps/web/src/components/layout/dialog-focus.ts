import type { KeyboardEvent } from "react";
export function trapDialogFocus(event: KeyboardEvent<HTMLDialogElement>) {
    if (event.key !== "Tab") return;
    const elements = Array.from(
        event.currentTarget.querySelectorAll<HTMLElement>(
            'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex="0"]',
        ),
    ).filter((element) => element.getClientRects().length > 0);
    const first = elements[0],
        last = elements.at(-1);
    if (!first || !last) return;
    if (
        event.shiftKey &&
        (document.activeElement === first || !event.currentTarget.contains(document.activeElement))
    ) {
        event.preventDefault();
        last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
    }
}
