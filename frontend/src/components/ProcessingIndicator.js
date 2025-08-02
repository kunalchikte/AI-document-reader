import React from 'react';
import ReactDOM from 'react-dom/client';
import { Box, Typography, CircularProgress, Paper } from '@mui/material';
import { motion } from 'framer-motion';

const ProcessingIndicator = ({ fileName }) => {
  return (
    <Paper
      elevation={3}
      component={motion.div}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      sx={{
        p: 4,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 3,
        position: 'relative',
        overflow: 'hidden',
        bgcolor: 'background.paper',
        maxWidth: '600px',
        mx: 'auto',
      }}
    >
      <Box
        component={motion.div}
        animate={{ 
          rotate: [0, 0, 270, 270, 0],
          opacity: [1, 0.8, 1, 0.8, 1],
          scale: [1, 0.9, 1, 0.9, 1],
        }}
        transition={{ 
          duration: 5,
          ease: "easeInOut",
          times: [0, 0.2, 0.5, 0.8, 1],
          repeat: Infinity,
          repeatDelay: 1
        }}
        sx={{ 
          width: '150px', 
          height: '150px', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          mb: 3
        }}
      >
        <Box 
          component="img"
          src="/document-processing.svg" 
          alt="Processing Document"
          sx={{ 
            width: '100%',
            height: '100%',
          }}
          onError={(e) => {
            // Fallback if SVG is not available
            e.target.style.display = 'none';
            e.target.parentNode.style.position = 'relative';
            
            // Create a circular progress as fallback
            const circle = document.createElement('div');
            circle.style.position = 'absolute';
            circle.style.top = '50%';
            circle.style.left = '50%';
            circle.style.transform = 'translate(-50%, -50%)';
            e.target.parentNode.appendChild(circle);
            
            // Render the CircularProgress into the div
            const root = ReactDOM.createRoot(circle);
            root.render(<CircularProgress size={80} thickness={4} />);
          }}
        />
      </Box>

      <CircularProgress 
        size={60}
        thickness={4}
        sx={{ position: 'absolute', opacity: 0.1 }}
      />

      <Typography variant="h5" component="h2" gutterBottom sx={{ fontWeight: 600 }}>
        Processing Document
      </Typography>

      <Typography variant="body1" color="text.secondary" textAlign="center">
        {fileName ? `Preparing ${fileName} for Q&A` : 'Preparing your document for Q&A'}
      </Typography>

      <Box 
        sx={{ 
          mt: 3,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 1,
        }}
      >
        {[0, 1, 2].map((i) => (
          <Box
            key={i}
            component={motion.div}
            animate={{
              y: [0, -10, 0],
              opacity: [0.6, 1, 0.6]
            }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              delay: i * 0.2
            }}
            sx={{
              width: 12,
              height: 12,
              borderRadius: '50%',
              bgcolor: 'primary.main',
            }}
          />
        ))}
      </Box>

      <Typography variant="body2" color="text.secondary" sx={{ mt: 3, maxWidth: '80%', textAlign: 'center' }}>
        We're analyzing the content and preparing it for intelligent Q&A. This may take a moment.
      </Typography>
    </Paper>
  );
};

export default ProcessingIndicator; 