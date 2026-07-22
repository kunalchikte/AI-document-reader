import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#2563EB',
      light: '#60A5FA',
      dark: '#1D4ED8',
      contrastText: '#FFFFFF',
    },
    secondary: {
      main: '#0F172A',
      light: '#334155',
      dark: '#020617',
      contrastText: '#FFFFFF',
    },
    success: { main: '#059669' },
    warning: { main: '#D97706' },
    error: { main: '#DC2626' },
    info: { main: '#0284C7' },
    background: {
      default: '#F1F5F9',
      paper: '#FFFFFF',
    },
    text: {
      primary: '#0F172A',
      secondary: '#64748B',
    },
    divider: '#E2E8F0',
  },
  typography: {
    fontFamily: '"Plus Jakarta Sans", "Helvetica", "Arial", sans-serif',
    h1: { fontFamily: '"Plus Jakarta Sans", sans-serif', fontWeight: 800, letterSpacing: '-0.03em' },
    h2: { fontFamily: '"Plus Jakarta Sans", sans-serif', fontWeight: 700, letterSpacing: '-0.02em' },
    h3: { fontFamily: '"Plus Jakarta Sans", sans-serif', fontWeight: 700, letterSpacing: '-0.02em' },
    h4: { fontFamily: '"Plus Jakarta Sans", sans-serif', fontWeight: 700, letterSpacing: '-0.02em' },
    h5: { fontFamily: '"Plus Jakarta Sans", sans-serif', fontWeight: 600 },
    h6: { fontFamily: '"Plus Jakarta Sans", sans-serif', fontWeight: 600 },
    subtitle1: { fontWeight: 600, letterSpacing: '-0.01em' },
    subtitle2: { fontWeight: 600 },
    body1: { fontSize: '1rem', lineHeight: 1.6 },
    body2: { fontSize: '0.875rem', lineHeight: 1.55 },
    button: {
      fontFamily: '"Plus Jakarta Sans", sans-serif',
      fontWeight: 600,
      textTransform: 'none',
      letterSpacing: '0.01em',
    },
  },
  shape: {
    borderRadius: 12,
  },
  spacing: 8,
  breakpoints: {
    values: { xs: 0, sm: 600, md: 900, lg: 1200, xl: 1536 },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        ':root': {
          '--color-bg': '#F1F5F9',
          '--color-surface': '#FFFFFF',
          '--color-text': '#0F172A',
          '--color-muted': '#64748B',
          '--color-accent': '#2563EB',
          '--color-accent-soft': '#DBEAFE',
          '--color-border': '#E2E8F0',
          '--color-success': '#059669',
          '--color-warning': '#D97706',
          '--color-danger': '#DC2626',
          '--font-display': '"Plus Jakarta Sans", sans-serif',
          '--font-body': '"Plus Jakarta Sans", sans-serif',
          '--ease-out': 'cubic-bezier(0.22, 1, 0.36, 1)',
          '--radius': '12px',
        },
        '@media (prefers-reduced-motion: reduce)': {
          '*, *::before, *::after': {
            animationDuration: '0.01ms !important',
            animationIterationCount: '1 !important',
            transitionDuration: '0.01ms !important',
          },
        },
      },
    },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: {
          minHeight: 44,
          borderRadius: 10,
          paddingInline: 18,
          transition: 'background-color 180ms var(--ease-out), color 180ms var(--ease-out), border-color 180ms var(--ease-out), transform 180ms var(--ease-out)',
          cursor: 'pointer',
          '&:hover': { transform: 'translateY(-1px)' },
          '&:active': { transform: 'translateY(0)' },
          '&.Mui-disabled': { opacity: 0.45 },
        },
        containedPrimary: {
          backgroundColor: 'var(--color-accent)',
          '&:hover': { backgroundColor: '#1D4ED8' },
        },
        outlined: {
          borderColor: 'var(--color-border)',
          '&:hover': { borderColor: 'var(--color-accent)', backgroundColor: 'var(--color-accent-soft)' },
        },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          minWidth: 44,
          minHeight: 44,
          cursor: 'pointer',
          transition: 'background-color 160ms var(--ease-out), color 160ms var(--ease-out)',
        },
      },
    },
    MuiPaper: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius)',
        },
      },
    },
    MuiCard: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: {
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius)',
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          fontWeight: 600,
          borderRadius: 8,
        },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: {
          minHeight: 48,
          fontWeight: 600,
          textTransform: 'none',
          cursor: 'pointer',
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            minHeight: 48,
            borderRadius: 12,
            backgroundColor: 'var(--color-surface)',
            transition: 'border-color 160ms var(--ease-out), box-shadow 160ms var(--ease-out)',
            '&.Mui-focused': {
              boxShadow: '0 0 0 3px var(--color-accent-soft)',
            },
          },
        },
      },
    },
    MuiAlert: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          border: '1px solid var(--color-border)',
        },
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          fontSize: '0.75rem',
          backgroundColor: '#0F172A',
          borderRadius: 8,
        },
      },
    },
    MuiFocusVisible: {
      styleOverrides: {
        root: {
          outline: '2px solid var(--color-accent)',
          outlineOffset: 2,
        },
      },
    },
  },
});

export default theme;
