/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"], // 启用 class 模式的暗黑模式
  content: [
    "./pages/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}", // 如果你的代码在 src 目录
  ],
  theme: {
    container: {
      // shadcn/ui 容器配置
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        // 使用 Apple 风格颜色定义 shadcn/ui 语义颜色
        border: "hsl(240 5.9% 90%)", // 中性灰色边框 (类似 #e5e5e7)
        input: "hsl(240 5.9% 90%)", // 输入框边框
        ring: "hsl(217 91% 60%)", // 聚焦环 - Apple Blue (#0071e3 的 HSL 表示)

        background: "hsl(0 0% 100%)", // 背景 - 白色
        foreground: "hsl(240 10% 3.9%)", // 前景 - 近黑色 (#1d1d1f 的 HSL 表示)

        primary: {
          DEFAULT: "hsl(217 91% 60%)", // Apple Blue (#0071e3)
          foreground: "hsl(0 0% 100%)", // 白色
        },
        secondary: {
          DEFAULT: "hsl(240 4.8% 95.9%)", // Apple Light Gray (#f5f5f7)
          foreground: "hsl(240 10% 3.9%)", // 近黑色
        },
        destructive: {
          DEFAULT: "hsl(0 84.2% 60.2%)", // 红色 (Tailwind red-500)
          foreground: "hsl(0 0% 100%)", // 白色
        },
        muted: {
          DEFAULT: "hsl(240 4.8% 95.9%)", // Apple Light Gray (#f5f5f7)
          foreground: "hsl(240 3.8% 46.1%)", // Apple Dark Gray (#86868b)
        },
        accent: {
          DEFAULT: "hsl(240 5.9% 90%)", // 中性灰色 (比 secondary 深一点)
          foreground: "hsl(240 10% 3.9%)", // 近黑色
        },
        popover: {
          // shadcn/ui 弹出框颜色
          DEFAULT: "hsl(0 0% 100%)", // 白色
          foreground: "hsl(240 10% 3.9%)", // 近黑色
        },
        card: {
          // shadcn/ui 卡片颜色
          DEFAULT: "hsl(0 0% 100%)", // 白色
          foreground: "hsl(240 10% 3.9%)", // 近黑色
        },

        // 黑暗模式颜色
        dark: {
          border: "hsl(240 3.7% 15.9%)",
          input: "hsl(240 3.7% 15.9%)",
          ring: "hsl(217 91% 60%)",
          background: "hsl(240 10% 3.9%)",
          foreground: "hsl(0 0% 98%)",
          primary: {
            DEFAULT: "hsl(217 91% 60%)",
            foreground: "hsl(0 0% 98%)",
          },
          secondary: {
            DEFAULT: "hsl(240 3.7% 15.9%)",
            foreground: "hsl(0 0% 98%)",
          },
          destructive: {
            DEFAULT: "hsl(0 84.2% 60.2%)",
            foreground: "hsl(0 0% 98%)",
          },
          muted: {
            DEFAULT: "hsl(240 3.7% 15.9%)",
            foreground: "hsl(240 5% 64.9%)",
          },
          accent: {
            DEFAULT: "hsl(240 3.7% 15.9%)",
            foreground: "hsl(0 0% 98%)",
          },
          popover: {
            DEFAULT: "hsl(240 10% 3.9%)",
            foreground: "hsl(0 0% 98%)",
          },
          card: {
            DEFAULT: "hsl(240 10% 3.9%)",
            foreground: "hsl(0 0% 98%)",
          },
        },
      },
      borderRadius: {
        // shadcn/ui 圆角配置
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        // shadcn/ui 动画配置
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },
      animation: {
        // shadcn/ui 动画配置
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")], // shadcn/ui 需要的插件
};
