import React from 'react';
import { 
  AppBar, 
  Toolbar, 
  Typography, 
  Button, 
  Box,
  Container,
  IconButton,
  useScrollTrigger,
  useMediaQuery,
  useTheme
} from '@mui/material';
import { 
  MenuBook as MenuBookIcon,
  Menu as MenuIcon,
  GitHub as GitHubIcon
} from '@mui/icons-material';

const Header = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  
  // Change app bar color on scroll
  const trigger = useScrollTrigger({
    disableHysteresis: true,
    threshold: 0,
  });

  return (
    <AppBar 
      position="sticky" 
      color="inherit" 
      elevation={trigger ? 4 : 0}
      sx={{ 
        backgroundColor: trigger ? 'background.paper' : 'transparent',
        transition: 'all 0.3s',
        backdropFilter: 'blur(10px)',
        borderBottom: '1px solid',
        borderColor: trigger ? 'divider' : 'transparent',
      }}
    >
      <Container maxWidth="lg">
        <Toolbar sx={{ px: { xs: 0 }, py: 1 }}>
          <Box 
            sx={{ 
              display: 'flex', 
              alignItems: 'center',
              flexGrow: 1 
            }}
          >
            <MenuBookIcon 
              color="primary" 
              fontSize="large" 
              sx={{ mr: 1 }} 
            />
            <Typography 
              variant="h6" 
              component="div" 
              sx={{ 
                flexGrow: 1,
                fontWeight: 700,
                letterSpacing: '-0.5px'
              }}
            >
              AI Document Reader
            </Typography>
          </Box>

          {isMobile ? (
            <IconButton
              color="inherit"
              aria-label="open menu"
              edge="end"
            >
              <MenuIcon />
            </IconButton>
          ) : (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <IconButton
                color="primary"
                aria-label="GitHub repository"
                href="https://github.com/kunalchikte/AI-document-reader.git"
                target="_blank"
                rel="noopener noreferrer"
              >
                <GitHubIcon />
              </IconButton>
            </Box>
          )}
        </Toolbar>
      </Container>
    </AppBar>
  );
};

export default Header; 