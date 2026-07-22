import React from 'react';
import { Box, Typography, CircularProgress } from '@mui/material';
import { motion } from 'framer-motion';

const ProcessingIndicator = ({ fileName }) => (
  <Box
    className="panel"
    component={motion.div}
    initial={{ opacity: 0, y: 12 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
    sx={{
      p: { xs: 3, sm: 5 },
      alignItems: 'center',
      justifyContent: 'center',
      textAlign: 'center',
      minHeight: { xs: 320, md: 480 },
      height: '100%',
    }}
    role="status"
    aria-live="polite"
  >
    <Box sx={{ position: 'relative', mb: 3 }}>
      <CircularProgress size={64} thickness={3.5} />
    </Box>

    <Typography
      variant="h5"
      sx={{ fontFamily: 'var(--font-display)', fontWeight: 700, mb: 1 }}
    >
      Processing document
    </Typography>

    <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 420, mb: 2 }}>
      {fileName
        ? `Indexing “${fileName}” for search and Q&A.`
        : 'Indexing your document for search and Q&A.'}
    </Typography>

    <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 380 }}>
      Text is chunked and embedded into PostgreSQL with pgvector. This usually takes a moment.
    </Typography>
  </Box>
);

export default ProcessingIndicator;
