import React from 'react';
import { Box, Typography, CircularProgress, Paper } from '@mui/material';
import { motion } from 'framer-motion';
import { Settings as SettingsIcon } from '@mui/icons-material';

const SystemLoadingOverlay = ({ loading = false, message = null }) => {
  if (!loading) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        backdropFilter: 'blur(5px)',
        zIndex: 9999,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <Paper
        elevation={4}
        sx={{
          p: 4,
          maxWidth: '500px',
          width: '100%',
          textAlign: 'center',
          borderRadius: 3,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <motion.div
          animate={{ 
            rotateZ: [0, 360],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: 'linear',
          }}
          style={{
            position: 'absolute',
            top: -30,
            right: -30,
            opacity: 0.07,
            transform: 'scale(3)',
          }}
        >
          <SettingsIcon sx={{ fontSize: '100px' }} />
        </motion.div>

        <CircularProgress 
          size={70} 
          thickness={4}
          sx={{ mb: 3 }}
        />
        
        <Typography variant="h5" gutterBottom fontWeight={600}>
          System Check in Progress
        </Typography>
        
        <Typography variant="body1" color="text.secondary" paragraph>
          {message || 'We\'re checking your system configuration and initializing required services. This may take a moment...'}
        </Typography>

        <Box sx={{ mt: 2 }}>
          <motion.div
            animate={{
              scale: [1, 1.05, 1],
              opacity: [0.7, 1, 0.7],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              repeatType: "reverse",
            }}
          >
            <Typography variant="body2" color="primary.main" fontWeight={500}>
              Please don't refresh or close this window
            </Typography>
          </motion.div>
        </Box>
      </Paper>
    </motion.div>
  );
};

export default SystemLoadingOverlay;