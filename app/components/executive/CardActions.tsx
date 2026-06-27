"use client";

import { useEffect, useRef, useState } from "react";
import { useInteractionFeedback } from "../InteractionProvider";

interface OverflowAction {
  id: string;
  label: string;
  onSelect?: () => void;
  href?: string;
  disabled?: boolean;
}

/**
 * Card actions: one primary CTA ("View Intelligence →") plus an overflow menu
 * for everything secondary (Website, Share, Copy, Save, Add to List, Export).
 */
export function CardActions({
  onViewIntelligence,
  websiteHref,
  form990Url,
  shareText,
}: {
  onViewIntelligence: () => void;
  websiteHref: string | null;
  form990Url: string | null;
  shareText: string;
}) {
  const { feedback } = useInteractionFeedback();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function copy() {
    void navigator.clipboard?.writeText(shareText);
  }

  function share() {
    if (typeof navigator !== "undefined" && navigator.share) {
      void navigator.share({ text: shareText }).catch(() => {});
    } else {
      copy();
    }
  }

  const actions: OverflowAction[] = [];
  if (websiteHref) actions.push({ id: "website", label: "Website ↗", href: websiteHref });
  if (form990Url) actions.push({ id: "form990", label: "Form 990 ↗", href: form990Url });
  actions.push({ id: "share", label: "Share", onSelect: share });
  actions.push({ id: "copy", label: "Copy summary", onSelect: copy });
  actions.push({ id: "save", label: "Save", disabled: true });
  actions.push({ id: "list", label: "Add to list", disabled: true });
  actions.push({ id: "export", label: "Export", disabled: true });

  return (
    <div className="exec-actions">
      <button
        type="button"
        onClick={() => {
          feedback("select");
          onViewIntelligence();
        }}
        className="exec-cta"
      >
        View Intelligence
        <span aria-hidden className="exec-cta-arrow">
          →
        </span>
      </button>

      <div ref={menuRef} className="exec-overflow">
        <button
          type="button"
          aria-haspopup="menu"
          aria-expanded={open}
          aria-label="More actions"
          onClick={(e) => {
            e.stopPropagation();
            feedback("tap");
            setOpen((v) => !v);
          }}
          className="exec-overflow-trigger"
        >
          <span aria-hidden>⋯</span>
        </button>
        {open ? (
          <div role="menu" className="exec-overflow-menu">
            {actions.map((action) =>
              action.href ? (
                <a
                  key={action.id}
                  role="menuitem"
                  href={action.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => {
                    e.stopPropagation();
                    setOpen(false);
                  }}
                  className="exec-overflow-item"
                >
                  {action.label}
                </a>
              ) : (
                <button
                  key={action.id}
                  type="button"
                  role="menuitem"
                  disabled={action.disabled}
                  onClick={(e) => {
                    e.stopPropagation();
                    feedback("tap");
                    action.onSelect?.();
                    setOpen(false);
                  }}
                  className="exec-overflow-item"
                >
                  {action.label}
                  {action.disabled ? <span className="exec-overflow-soon">soon</span> : null}
                </button>
              ),
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
