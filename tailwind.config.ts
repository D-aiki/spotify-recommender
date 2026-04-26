import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        "sp-green": "#1DB954",
        "sp-green-light": "#1ed760",
        "sp-black": "#191414",
        "sp-dark": "#121212",
        "sp-gray": "#282828",
        "sp-light": "#b3b3b3",
      },
    },
  },
  plugins: [],
};

export default config;
