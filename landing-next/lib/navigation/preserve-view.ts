"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useLayoutEffect } from "react";

const ATTR = "data-preserve-focus";

export type PreserveViewOptions = {
  /** Focus this control after navigation, even if another element was focused. */
  focus?: string;
  /** Focus this control when the current one is gone or hidden. */
  fallbackFocus?: string;
  /** When false, keep the page from jumping but do not move focus. */
  preserveFocus?: boolean;
};

type Snapshot = {
  focusKey: string | null;
  fallbackKey: string | null;
  selectionStart: number | null;
  selectionEnd: number | null;
  scrollX: number;
  scrollY: number;
};

type Pending = { generation: number; snapshot: Snapshot };

let generation = 0;
let pending: Pending | null = null;

function attrEscape(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function isVisible(el: HTMLElement) {
  if (el.closest("[hidden]")) return false;
  const style = window.getComputedStyle(el);
  return style.display !== "none" && style.visibility !== "hidden";
}

function findByKey(key: string | null) {
  if (!key) return null;
  const nodes = document.querySelectorAll<HTMLElement>(`[${ATTR}="${attrEscape(key)}"]`);
  for (const el of nodes) {
    if (isVisible(el)) return el;
  }
  return null;
}

function canFocus(el: HTMLElement) {
  if (el.hasAttribute("disabled")) return false;
  if (el instanceof HTMLButtonElement && el.disabled) return false;
  if (el instanceof HTMLInputElement && el.disabled) return false;
  if (el instanceof HTMLSelectElement && el.disabled) return false;
  if (el instanceof HTMLTextAreaElement && el.disabled) return false;
  return true;
}

function capture(options?: PreserveViewOptions): Snapshot {
  const active = document.activeElement;
  let focusKey = options?.preserveFocus === false ? null : options?.focus ?? null;
  let selectionStart: number | null = null;
  let selectionEnd: number | null = null;

  if (options?.preserveFocus === false) {
    return {
      focusKey: null,
      fallbackKey: null,
      selectionStart: null,
      selectionEnd: null,
      scrollX: window.scrollX,
      scrollY: window.scrollY,
    };
  }

  if (!focusKey && active instanceof HTMLElement) {
    focusKey = active.getAttribute(ATTR);
    if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) {
      selectionStart = active.selectionStart;
      selectionEnd = active.selectionEnd;
    }
  }

  return {
    focusKey,
    fallbackKey: options?.fallbackFocus ?? null,
    selectionStart,
    selectionEnd,
    scrollX: window.scrollX,
    scrollY: window.scrollY,
  };
}

export function restorePreserveView(snapshot: Snapshot) {
  if (window.scrollX !== snapshot.scrollX || window.scrollY !== snapshot.scrollY) {
    window.scrollTo(snapshot.scrollX, snapshot.scrollY);
  }

  const primary = findByKey(snapshot.focusKey);
  const primaryOk = primary && canFocus(primary) ? primary : null;
  const fallback = findByKey(snapshot.fallbackKey);
  const target = primaryOk ?? (fallback && canFocus(fallback) ? fallback : null);
  if (!target || document.activeElement === target) return;

  target.focus({ preventScroll: true });
  if (
    primaryOk &&
    (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) &&
    snapshot.selectionStart != null &&
    snapshot.selectionEnd != null
  ) {
    const max = target.value.length;
    try {
      target.setSelectionRange(
        Math.min(snapshot.selectionStart, max),
        Math.min(snapshot.selectionEnd, max)
      );
    } catch {
      // Some input types reject a selection range.
    }
  }
}

function remember(snapshot: Snapshot) {
  generation += 1;
  pending = { generation, snapshot };
}

export function replacePreservingView(
  router: { replace: (href: string, options?: { scroll?: boolean }) => void },
  href: string,
  options?: PreserveViewOptions
) {
  if (typeof window === "undefined") return false;
  if (urlsMatch(href)) return false;
  const snapshot = capture(options);
  if (options?.preserveFocus === false && pending?.snapshot.focusKey) {
    snapshot.focusKey = pending.snapshot.focusKey;
    snapshot.fallbackKey = pending.snapshot.fallbackKey;
    snapshot.selectionStart = pending.snapshot.selectionStart;
    snapshot.selectionEnd = pending.snapshot.selectionEnd;
  }
  remember(snapshot);
  router.replace(href, { scroll: false });
  return true;
}

function urlsMatch(href: string) {
  const next = new URL(href, window.location.href);
  const current = new URL(window.location.href);
  return next.pathname === current.pathname && next.search === current.search;
}

/** Listen for same-page query updates and put scroll and focus back. */
export function usePreserveViewNavigation() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const searchKey = searchParams.toString();

  useLayoutEffect(() => {
    const current = pending;
    if (!current) return;
    const { generation: gen, snapshot } = current;
    const previousRestoration = history.scrollRestoration;
    history.scrollRestoration = "manual";
    let applying = false;
    const apply = () => {
      if (pending?.generation !== gen) return;
      applying = true;
      restorePreserveView(snapshot);
      applying = false;
    };
    const onScroll = () => {
      if (applying || pending?.generation !== gen) return;
      if (window.scrollX === snapshot.scrollX && window.scrollY === snapshot.scrollY) return;
      apply();
    };
    apply();
    window.addEventListener("scroll", onScroll, { passive: true });
    const timers = [0, 48, 200, 700].map((delay) => window.setTimeout(apply, delay));
    const clearTimer = window.setTimeout(() => {
      window.removeEventListener("scroll", onScroll);
      history.scrollRestoration = previousRestoration;
      if (pending?.generation === gen) pending = null;
    }, 1500);
    return () => {
      timers.forEach((id) => window.clearTimeout(id));
      window.clearTimeout(clearTimer);
      window.removeEventListener("scroll", onScroll);
      history.scrollRestoration = previousRestoration;
    };
  }, [searchKey]);

  return useCallback(
    (href: string, options?: PreserveViewOptions) => {
      return replacePreservingView(router, href, options);
    },
    [router]
  );
}
