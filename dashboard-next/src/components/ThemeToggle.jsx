const OPTIONS = [
  { id: "light", label: "Light" },
  { id: "dark", label: "Dark" },
  { id: "system", label: "System" },
];

export default function ThemeToggle({ onChange, theme }) {
  return (
    <div className="theme-toggle" role="group" aria-label="Color theme">
      {OPTIONS.map((option) => (
        <button
          aria-pressed={theme === option.id}
          className={
            theme === option.id
              ? "theme-toggle-button active"
              : "theme-toggle-button"
          }
          key={option.id}
          onClick={() => onChange(option.id)}
          type="button"
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
