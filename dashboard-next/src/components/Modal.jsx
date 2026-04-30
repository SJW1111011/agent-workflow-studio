import { useEffect } from "preact/hooks";
import { createPortal } from "preact/compat";

export default function Modal({ children, isOpen, onClose }) {
  useEffect(() => {
    if (!isOpen) return;

    function handleEscape(e) {
      if (e.key === "Escape") {
        onClose();
      }
    }

    // Scroll to top when modal opens
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Prevent body scroll when modal is open
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const modalContent = (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );

  // Render modal at body level using portal
  return createPortal(modalContent, document.body);
}
