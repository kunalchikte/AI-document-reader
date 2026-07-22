import React from 'react';
import {
  AppBar,
  Toolbar,
  Typography,
  Box,
  IconButton,
  Button,
  useScrollTrigger,
} from '@mui/material';
import {
  DescriptionOutlined as DocIcon,
  GitHub as GitHubIcon,
  Logout as LogoutIcon,
} from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const Header = () => {
  const trigger = useScrollTrigger({ disableHysteresis: true, threshold: 4 });
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <AppBar
      position="sticky"
      color="inherit"
      elevation={0}
      sx={{
        height: 'var(--app-header)',
        justifyContent: 'center',
        backgroundColor: trigger ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.72)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid',
        borderColor: 'divider',
        transition: 'background-color 180ms var(--ease-out)',
      }}
    >
      <Toolbar
        sx={{
          px: { xs: 2, md: 3.5 },
          maxWidth: 1280,
          width: '100%',
          mx: 'auto',
          minHeight: 'var(--app-header) !important',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, flex: 1, minWidth: 0 }}>
          <Box
            sx={{
              width: 40,
              height: 40,
              borderRadius: 2,
              display: 'grid',
              placeItems: 'center',
              backgroundColor: 'var(--color-accent)',
              color: '#fff',
              flexShrink: 0,
            }}
            aria-hidden
          >
            <DocIcon fontSize="small" />
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Typography
              variant="h6"
              component="div"
              sx={{
                fontFamily: 'var(--font-display)',
                fontWeight: 700,
                fontSize: { xs: '1.05rem', sm: '1.2rem' },
                lineHeight: 1.15,
                letterSpacing: '-0.03em',
              }}
            >
              AI Document Reader
            </Typography>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ display: { xs: 'none', sm: 'block' }, lineHeight: 1.2 }}
            >
              Ask questions across your files
            </Typography>
          </Box>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {isAuthenticated && user && (
            <>
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ display: { xs: 'none', sm: 'block' }, maxWidth: 180 }}
                noWrap
              >
                {user.email}
              </Typography>
              <Button
                size="small"
                startIcon={<LogoutIcon />}
                onClick={handleLogout}
                aria-label="Log out"
              >
                Log out
              </Button>
            </>
          )}
          <IconButton
            color="inherit"
            aria-label="Open GitHub repository"
            href="https://github.com/kunalchikte/AI-document-reader.git"
            target="_blank"
            rel="noopener noreferrer"
            sx={{
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 2,
              '&:hover': { backgroundColor: 'var(--color-accent-soft)', borderColor: '#BFDBFE' },
            }}
          >
            <GitHubIcon fontSize="small" />
          </IconButton>
        </Box>
      </Toolbar>
    </AppBar>
  );
};

export default Header;
