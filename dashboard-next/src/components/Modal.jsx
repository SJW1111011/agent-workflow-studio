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

    // Prevent body scroll when modal is open
    const originalOverflow = document.body.style.overflow;
    const originalPosition = document.body.style.position;

    document.body.style.overflow = "hidden";
    document.body.style.position = "relative";

    document.addEventListener("keydown", handleEscape);

    return () => {
      document.body.style.overflow = originalOverflow;
      document.body.style.position = originalPosition;
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const modalContent = (
    <div
      className="modal-overlay"
      onClick={onClose}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 9999
      }}
    >
      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'relative',
          zIndex: 10000
        }}
      >
        {children}
      </div>
    </div>
  );

  // Render modal at body level using portal
  return createPortal(modalContent, document.body);
}
