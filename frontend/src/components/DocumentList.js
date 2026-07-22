import React from 'react';
import {
  Box,
  Typography,
  IconButton,
  Chip,
  Tooltip,
  Stack,
} from '@mui/material';
import {
  PictureAsPdf as PdfIcon,
  Description as DocIcon,
  TableChart as SheetIcon,
  Article as TextIcon,
  DeleteOutline as DeleteIcon,
  ChatBubbleOutline as ChatIcon,
} from '@mui/icons-material';
import LoadingDots from './LoadingDots';

const typeMeta = {
  pdf: { icon: PdfIcon, color: '#DC2626', label: 'PDF' },
  docx: { icon: DocIcon, color: '#2563EB', label: 'DOCX' },
  xlsx: { icon: SheetIcon, color: '#059669', label: 'XLSX' },
  txt: { icon: TextIcon, color: '#64748B', label: 'TXT' },
};

const daysLeft = (expiresAt) => {
  if (!expiresAt) return null;
  const ms = new Date(expiresAt).getTime() - Date.now();
  const days = Math.ceil(ms / (1000 * 60 * 60 * 24));
  return days < 0 ? 0 : days;
};

const formatDate = (dateString) => {
  if (!dateString) return 'Unknown date';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(dateString));
};

const DocumentList = ({
  documents = [],
  loading = false,
  onSelectDocument,
  onDeleteDocument,
  selectedDocumentId = null,
}) => {
  if (loading) {
    return (
      <Box sx={{ py: 6, display: 'grid', placeItems: 'center' }}>
        <LoadingDots text="Loading documents" />
      </Box>
    );
  }

  if (!documents?.length) {
    return (
      <Box
        sx={{
          p: 2.5,
          borderRadius: 2,
          border: '1px dashed',
          borderColor: 'divider',
          backgroundColor: '#F8FAFC',
          textAlign: 'left',
        }}
      >
        <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
          No documents yet
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Upload a file to start asking grounded questions.
        </Typography>
      </Box>
    );
  }

  return (
    <Stack spacing={1} role="list" aria-label="Uploaded documents">
      {documents.map((document) => {
        const meta = typeMeta[document.fileType?.toLowerCase()] || typeMeta.txt;
        const Icon = meta.icon;
        const selected = selectedDocumentId === document._id;
        const left = daysLeft(document.expiresAt);

        return (
          <Box
            key={document._id}
            role="listitem"
            className={`doc-item${selected ? ' is-selected' : ''}`}
            component="button"
            type="button"
            onClick={() => onSelectDocument?.(document._id)}
            aria-pressed={selected}
            aria-label={`Select ${document.originalName}`}
          >
            <Box
              sx={{
                width: 42,
                height: 42,
                borderRadius: 1.5,
                display: 'grid',
                placeItems: 'center',
                backgroundColor: `${meta.color}14`,
                color: meta.color,
                flexShrink: 0,
              }}
              aria-hidden
            >
              <Icon fontSize="small" />
            </Box>

            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.25, flexWrap: 'wrap' }}>
                <Typography
                  variant="body2"
                  noWrap
                  sx={{ fontWeight: selected ? 700 : 600, flex: 1, minWidth: 0 }}
                >
                  {document.originalName}
                </Typography>
                <Chip
                  size="small"
                  label={document.vectorized ? 'Ready' : 'Processing'}
                  color={document.vectorized ? 'success' : 'warning'}
                  sx={{ height: 22, fontSize: '0.68rem' }}
                />
                {left !== null && (
                  <Chip
                    size="small"
                    label={left === 0 ? 'Expires today' : `${left}d left`}
                    variant="outlined"
                    color={left <= 1 ? 'warning' : 'default'}
                    sx={{ height: 22, fontSize: '0.68rem' }}
                  />
                )}
              </Box>
              <Typography variant="caption" color="text.secondary">
                {meta.label} · {formatDate(document.createdAt)}
              </Typography>
            </Box>

            <Box sx={{ display: 'flex', gap: 0.25 }} onClick={(e) => e.stopPropagation()}>
              {document.vectorized && (
                <Tooltip title="Open chat">
                  <IconButton
                    size="small"
                    aria-label={`Chat with ${document.originalName}`}
                    onClick={() => onSelectDocument?.(document._id)}
                  >
                    <ChatIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              )}
              <Tooltip title="Delete document">
                <IconButton
                  size="small"
                  aria-label={`Delete ${document.originalName}`}
                  onClick={() => onDeleteDocument?.(document._id)}
                  color="error"
                >
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Box>
          </Box>
        );
      })}
    </Stack>
  );
};

export default DocumentList;
