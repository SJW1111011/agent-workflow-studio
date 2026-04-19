import { useEffect, useState } from "preact/hooks";

const STORAGE_KEY = "agent-workflow-studio:theme";
const DARK_QUERY = "(prefers-color-scheme: dark)";
const THEME_META_COLORS = {
  dark: "#0d1411",
  light: "#f7f2e8",
};

function isBrowser() {
  return typeof window !== "undefined" && typeof document !== "undefined";
}

function normalizeTheme(value) {
  return value === "light" || value === "dark" || value === "system"
    ? value
    : "system";
}

function getSystemTheme() {
  if (!isBrowser() || typeof window.matchMedia !== "function") {
    return "light";
  }

  return window.matchMedia(DARK_QUERY).matches ? "dark" : "light";
}

function getInitialTheme() {
  if (!isBrowser()) {
    return "system";
  }

  const documentTheme = normalizeTheme(document.documentElement.dataset.theme);
  if (
    documentTheme !== "system" ||
    document.documentElement.dataset.theme === "system"
  ) {
    return documentTheme;
  }

  try {
    return normalizeTheme(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    return "system";
  }
}

function applyTheme(theme, systemTheme) {
  if (!isBrowser()) {
    return theme === "system" ? systemTheme : theme;
  }

  const resolvedTheme = theme === "system" ? systemTheme : theme;
  const root = document.documentElement;
  const themeMeta = document.querySelector('meta[name="theme-color"]');

  root.dataset.theme = theme;
  root.dataset.resolvedTheme = resolvedTheme;
  root.style.colorScheme = resolvedTheme;

  if (themeMeta) {
    themeMeta.setAttribute("content", THEME_META_COLORS[resolvedTheme]);
  }

  return resolvedTheme;
}

export default function useTheme() {
  const [theme, setTheme] = useState(getInitialTheme);
  const [systemTheme, setSystemTheme] = useState(getSystemTheme);
  const resolvedTheme = theme === "system" ? systemTheme : theme;

  useEffect(() => {
    if (!isBrowser() || typeof window.matchMedia !== "function") {
      return undefined;
    }

    const mediaQuery = window.matchMedia(DARK_QUERY);
    const handleChange = (event) => {
      setSystemTheme(event.matches ? "dark" : "light");
    };

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", handleChange);
    } else {
      mediaQuery.addListener(handleChange);
    }

    return () => {
      if (typeof mediaQuery.removeEventListener === "function") {
        mediaQuery.removeEventListener("change", handleChange);
      } else {
        mediaQuery.removeListener(handleChange);
      }
    };
  }, []);

  useEffect(() => {
    applyTheme(theme, systemTheme);

    if (!isBrowser()) {
      return;
    }

    try {
      window.localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // Ignore storage write failures so theme changes still apply in-memory.
    }
  }, [theme, systemTheme]);

  return {
    resolvedTheme,
    setTheme,
    theme,
  };
}
