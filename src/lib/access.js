const EDIT_KEY = import.meta.env.VITE_EDIT_KEY?.trim() || "";

export function getAccessMode() {
  const params = new URLSearchParams(window.location.search);
  const isView = params.get("mode") === "view";
  const keyOk = !EDIT_KEY || params.get("key") === EDIT_KEY;
  return {
    isView,
    canEdit: !isView && keyOk,
    needsEditKey: !!EDIT_KEY,
  };
}

