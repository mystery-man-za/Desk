/** @type {import('tailwindcss').Config} */
export default {
  content: ['./client/index.html', './client/src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        surface: {
          base: 'oklch(1 0 0)',
          sidebar: 'oklch(0.979 0 0)',
          gray: {
            1: 'oklch(0.979 0 0)',
            2: 'oklch(0.964 0 0)',
            3: 'oklch(0.946 0 0)',
            4: 'oklch(0.913 0 0)',
            10: 'oklch(0.205 0 0)',
          },
          elevation: {
            2: 'oklch(1 0 0)',
            3: 'oklch(1 0 0)',
          },
          green: {
            1: 'oklch(0.976 0.014 155.594)',
            2: 'oklch(0.965 0.03 155.987)',
            3: 'oklch(0.908 0.07 154.3)',
            7: 'oklch(0.57 0.119 158.092)',
            8: 'oklch(0.53 0.122 156.15)',
          },
          blue: {
            2: 'oklch(0.96 0.021 241.348)',
          },
          violet: {
            2: 'oklch(0.943 0.031 297.722)',
          },
          orange: {
            2: 'oklch(0.962 0.023 56.964)',
          },
          amber: {
            2: 'oklch(0.967 0.045 91.733)',
          },
          red: {
            1: 'oklch(0.978 0.011 17.34)',
            2: 'oklch(0.947 0.026 17.626)',
            3: 'oklch(0.915 0.044 17.978)',
          },
        },
        ink: {
          base: 'oklch(1 0 0)',
          gray: {
            4: 'oklch(0.683 0 0)',
            5: 'oklch(0.586 0 0)',
            6: 'oklch(0.439 0 0)',
            7: 'oklch(0.341 0 0)',
            8: 'oklch(0.205 0 0)',
            9: 'oklch(0.168 0 0)',
          },
          green: {
            5: 'oklch(0.67 0.124 159.024)',
            7: 'oklch(0.53 0.122 156.15)',
            8: 'oklch(0.425 0.101 155.32)',
          },
          blue: {
            5: 'oklch(0.641 0.186 251.565)',
          },
          violet: {
            8: 'oklch(0.356 0.139 285.299)',
          },
          orange: {
            8: 'oklch(0.478 0.146 37.007)',
          },
          amber: {
            8: 'oklch(0.472 0.124 46.689)',
          },
          red: {
            7: 'oklch(0.497 0.185 27.335)',
            8: 'oklch(0.438 0.153 26.273)',
          },
        },
        outline: {
          gray: {
            1: 'oklch(0.946 0 0)',
            2: 'oklch(0.913 0 0)',
            3: 'oklch(0.83 0 0)',
            4: 'oklch(0.683 0 0)',
          },
        },
      },
      fontFamily: {
        sans: ['Inter Variable', 'Inter', 'ui-sans-serif', 'system-ui'],
      },
      fontSize: {
        '2xs': ['11px', { lineHeight: '1.35', letterSpacing: '0.01em' }],
        xs: ['12px', { lineHeight: '1.35', letterSpacing: '0.02em' }],
        sm: ['13px', { lineHeight: '1.35', letterSpacing: '0.02em' }],
        base: ['14px', { lineHeight: '1.35', letterSpacing: '0.02em' }],
        md: ['15px', { lineHeight: '1.35', letterSpacing: '0.02em' }],
      },
      borderRadius: {
        3: '3px',
        4: '4px',
        5: '5px',
        6: '6px',
      },
    },
  },
  plugins: [],
};
