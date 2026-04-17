export default function TabButton({ active, label, onClick }) {
  return (
    <button
      aria-pressed={active}
      className={active ? "tab-button active" : "tab-button"}
      onClick={onClick}
      type="button"
    >
      {label}
    </button>
  );
}
