import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useLocation } from "react-router-dom";

interface DrawerContextValue {
  open: boolean;
  focusId?: string;
  openFor: (annotationId: string) => void;
  openAll: () => void;
  close: () => void;
}

const Ctx = createContext<DrawerContextValue | null>(null);

export function AnnotationDrawerProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [focusId, setFocusId] = useState<string | undefined>(undefined);
  const location = useLocation();

  // Pick up deep-links of the form ?ann=<id>#<blockId>
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const annId = params.get("ann");
    if (annId) {
      setFocusId(annId);
      setOpen(true);
      // Also try to scroll the block into view if hash is provided.
      const hash = location.hash?.replace(/^#/, "");
      if (hash) {
        setTimeout(() => {
          const el = document.querySelector(
            `[data-annotatable-block="${hash}"]`
          );
          if (el && "scrollIntoView" in el) {
            (el as HTMLElement).scrollIntoView({ behavior: "smooth", block: "center" });
          }
        }, 80);
      }
      return;
    }
    // No annotation deep-link: close on navigation
    setOpen(false);
    setFocusId(undefined);
  }, [location.pathname, location.search, location.hash]);

  const openFor = useCallback((id: string) => {
    setFocusId(id);
    setOpen(true);
  }, []);

  const openAll = useCallback(() => {
    setFocusId(undefined);
    setOpen(true);
  }, []);

  const close = useCallback(() => {
    setOpen(false);
  }, []);

  const value = useMemo(
    () => ({ open, focusId, openFor, openAll, close }),
    [open, focusId, openFor, openAll, close]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAnnotationDrawer() {
  const v = useContext(Ctx);
  if (!v) throw new Error("AnnotationDrawerProvider missing");
  return v;
}
