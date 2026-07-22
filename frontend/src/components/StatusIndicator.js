import React from 'react';
import {
  Box,
  Typography,
  Chip,
  Tooltip,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Divider,
} from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Refresh as RefreshIcon,
  Storage as StorageIcon,
  Layers as LayersIcon,
  InfoOutlined as InfoIcon,
} from '@mui/icons-material';

const StatusChip = ({ ok, label, tooltip, onClick }) => (
  <Tooltip title={tooltip || label} arrow>
    <Chip
      label={label}
      size="small"
      onClick={onClick}
      icon={ok ? <CheckCircleIcon /> : <ErrorIcon />}
      color={ok ? 'success' : 'error'}
      variant="outlined"
      sx={{
        cursor: onClick ? 'pointer' : 'default',
        fontWeight: 600,
        minHeight: 32,
        '& .MuiChip-icon': { ml: 0.75 },
      }}
    />
  </Tooltip>
);

const StatusIndicator = ({
  loading = false,
  ollamaStatus = null,
  ollamaDetails = null,
  postgresStatus = null,
  postgresDetails = null,
  onCheckStatus = null,
}) => {
  const [detailsOpen, setDetailsOpen] = React.useState(false);
  const ollamaOk = ollamaStatus === true;
  const postgresOk = postgresStatus === true;
  const allOk = ollamaOk && postgresOk;

  return (
    <>
      <Box className="status-bar" role="status" aria-live="polite">
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>
            {loading ? 'Checking services…' : allOk ? 'Systems ready' : 'Service attention needed'}
          </Typography>
          {ollamaStatus !== null && (
            <StatusChip
              ok={ollamaOk}
              label="Ollama"
              tooltip={ollamaOk ? 'Ollama is reachable' : 'Ollama unavailable'}
              onClick={() => setDetailsOpen(true)}
            />
          )}
          {postgresStatus !== null && (
            <StatusChip
              ok={postgresOk}
              label="PostgreSQL"
              tooltip={postgresOk ? 'PostgreSQL + pgvector connected' : 'Database issue'}
              onClick={() => setDetailsOpen(true)}
            />
          )}
        </Box>

        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            size="small"
            startIcon={<InfoIcon />}
            onClick={() => setDetailsOpen(true)}
            aria-label="View system details"
          >
            Details
          </Button>
          <Button
            size="small"
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={onCheckStatus}
            disabled={loading}
            aria-label="Refresh system status"
          >
            Refresh
          </Button>
        </Box>
      </Box>

      <Dialog open={detailsOpen} onClose={() => setDetailsOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontFamily: 'var(--font-display)', fontWeight: 700 }}>
          System status
        </DialogTitle>
        <DialogContent dividers>
          <Typography variant="subtitle1" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <LayersIcon fontSize="small" color="primary" /> Ollama
          </Typography>
          <List dense>
            <ListItem>
              <ListItemIcon>
                {ollamaOk ? <CheckCircleIcon color="success" /> : <ErrorIcon color="error" />}
              </ListItemIcon>
              <ListItemText
                primary="Server"
                secondary={ollamaDetails?.server?.message || (ollamaOk ? 'Reachable' : 'Unavailable')}
              />
            </ListItem>
          </List>

          <Divider sx={{ my: 1.5 }} />

          <Typography variant="subtitle1" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <StorageIcon fontSize="small" color="primary" /> PostgreSQL
          </Typography>
          <List dense>
            {[
              ['Connection', postgresDetails?.connection],
              ['pgvector', postgresDetails?.pgvector],
              ['Documents table', postgresDetails?.documentsTable],
              ['Match function', postgresDetails?.matchFunction],
            ].map(([label, item]) => (
              <ListItem key={label}>
                <ListItemIcon>
                  {item?.status !== false ? (
                    <CheckCircleIcon color="success" />
                  ) : (
                    <ErrorIcon color="error" />
                  )}
                </ListItemIcon>
                <ListItemText primary={label} secondary={item?.message || '—'} />
              </ListItem>
            ))}
          </List>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setDetailsOpen(false)}>Close</Button>
          <Button
            variant="contained"
            startIcon={<RefreshIcon />}
            onClick={() => {
              setDetailsOpen(false);
              onCheckStatus?.();
            }}
          >
            Refresh status
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default StatusIndicator;
