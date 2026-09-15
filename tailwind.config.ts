import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    container: {
      center: true,
      padding: "1.5rem",
      screens: { "2xl": "1400px" },
    },
    extend: {
      fontFamily: {
        // Platform fallback, not a KA·CARE brand-font assertion. Replace the
        // CSS variable once official licensed brand typography is supplied.
        sans: ["var(--font-platform)", "IBM Plex Sans Arabic", "sans-serif"],
      },
      colors: {
        primary: {
          DEFAULT: "rgb(var(--ui-primary) / <alpha-value>)",
          50: "rgb(var(--ui-primary-50) / <alpha-value>)",
          100: "rgb(var(--ui-primary-100) / <alpha-value>)",
          400: "rgb(var(--ui-primary-400) / <alpha-value>)",
          500: "rgb(var(--ui-primary) / <alpha-value>)",
          600: "rgb(var(--ui-primary-600) / <alpha-value>)",
          700: "rgb(var(--ui-primary-700) / <alpha-value>)",
        },
        foreground: {
          DEFAULT: "rgb(var(--ui-foreground) / <alpha-value>)",
          secondary: "rgb(var(--ui-foreground-secondary) / <alpha-value>)",
        },
        secondary: {
          DEFAULT: "rgb(var(--ui-secondary) / <alpha-value>)",
          50: "rgb(var(--ui-secondary-50) / <alpha-value>)",
          400: "rgb(var(--ui-secondary-400) / <alpha-value>)",
          500: "rgb(var(--ui-secondary) / <alpha-value>)",
          600: "rgb(var(--ui-secondary-600) / <alpha-value>)",
        },
        accent: {
          DEFAULT: "rgb(var(--ui-accent) / <alpha-value>)",
          soft: "rgb(var(--ui-accent-soft) / <alpha-value>)",
        },
        bg: {
          DEFAULT: "rgb(var(--ui-bg) / <alpha-value>)",
          dark: "rgb(var(--ui-bg-dark) / <alpha-value>)",
        },
        sidebar: {
          DEFAULT: "rgb(var(--ui-sidebar) / <alpha-value>)",
          light: "rgb(var(--ui-sidebar-light) / <alpha-value>)",
          hover: "rgb(var(--ui-sidebar-hover) / <alpha-value>)",
        },
        surface: {
          DEFAULT: "rgb(var(--ui-surface) / <alpha-value>)",
          dark: "rgb(var(--ui-surface-dark) / <alpha-value>)",
        },
        border: {
          DEFAULT: "rgb(var(--ui-border) / <alpha-value>)",
          dark: "rgb(var(--ui-border-dark) / <alpha-value>)",
        },
        muted: {
          DEFAULT: "rgb(var(--ui-muted) / <alpha-value>)",
          dark: "rgb(var(--ui-muted-dark) / <alpha-value>)",
        },
        success: { DEFAULT: "rgb(var(--ui-success) / <alpha-value>)", bg: "rgb(var(--ui-success-bg) / <alpha-value>)" },
        warning: { DEFAULT: "rgb(var(--ui-warning) / <alpha-value>)", bg: "rgb(var(--ui-warning-bg) / <alpha-value>)" },
        danger: { DEFAULT: "rgb(var(--ui-danger) / <alpha-value>)", bg: "rgb(var(--ui-danger-bg) / <alpha-value>)" },
        info: { DEFAULT: "rgb(var(--ui-info) / <alpha-value>)", bg: "rgb(var(--ui-info-bg) / <alpha-value>)" },
      },
      borderRadius: {
        xl: "0.875rem",
        "2xl": "1.125rem",
        "3xl": "1.5rem",
      },
      boxShadow: {
        soft: "0 14px 35px -18px rgb(var(--ui-shadow) / 0.24)",
        card: "0 4px 16px -10px rgb(var(--ui-shadow) / 0.18)",
        "card-hover": "0 18px 35px -18px rgb(var(--ui-shadow) / 0.32)",
      },
      backgroundImage: {
        "gradient-primary": "linear-gradient(135deg, rgb(var(--ui-primary)) 0%, rgb(var(--ui-primary-400)) 100%)",
        "gradient-sidebar": "linear-gradient(180deg, rgb(var(--ui-sidebar)) 0%, rgb(var(--ui-sidebar-light)) 100%)",
      },
      keyframes: {
        "fade-in": { "0%": { opacity: "0" }, "100%": { opacity: "1" } },
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.4s ease-out",
        "fade-up": "fade-up 0.5s ease-out",
        shimmer: "shimmer 2s linear infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
