import React from 'react';
import { Box, Typography, CircularProgress, Paper } from '@mui/material';
import { motion } from 'framer-motion';

const SystemLoadingOverlay = ({ loading = false, message = null }) => {
  if (!loading) return null;

  return (
    <Box
      component={motion.div}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="system-check-title"
      aria-describedby="system-check-desc"
      sx={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'grid',
        placeItems: 'center',
        p: 2,
        backgroundColor: 'rgba(15, 23, 42, 0.55)',
        backdropFilter: 'blur(6px)',
      }}
    >
      <Paper
        sx={{
          p: { xs: 3, sm: 4 },
          width: '100%',
          maxWidth: 440,
          textAlign: 'center',
          borderRadius: 3,
        }}
      >
        <CircularProgress size={56} thickness={3.5} sx={{ mb: 2.5 }} />
        <Typography
          id="system-check-title"
          variant="h5"
          sx={{ fontFamily: 'var(--font-display)', fontWeight: 700, mb: 1 }}
        >
          Checking services
        </Typography>
        <Typography id="system-check-desc" variant="body1" color="text.secondary">
          {message ||
            'Verifying Ollama and PostgreSQL connectivity. This only takes a moment.'}
        </Typography>
      </Paper>
    </Box>
  );
};

export default SystemLoadingOverlay;
