import React from 'react';
import { 
  Box, 
  Typography, 
  Paper, 
  List, 
  ListItem, 
  ListItemAvatar, 
  ListItemText,
  ListItemButton,
  Avatar,
  IconButton,
  Chip,
  Tooltip
} from '@mui/material';
import {
  Description as DescriptionIcon,
  Delete as DeleteIcon,
  Chat as ChatIcon
} from '@mui/icons-material';
import LoadingDots from './LoadingDots';

const DocumentList = ({ 
  documents = [], 
  loading = false, 
  onSelectDocument, 
  onDeleteDocument,
  selectedDocumentId = null
}) => {
  if (loading) {
    return (
      <Box 
        sx={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center',
          height: '200px' 
        }}
      >
        <LoadingDots text="Loading documents" />
      </Box>
    );
  }

  if (!documents || documents.length === 0) {
    return (
      <Paper 
        elevation={0} 
        sx={{ 
          p: 3, 
          textAlign: 'center',
          backgroundColor: 'rgba(0, 0, 0, 0.02)',
          borderRadius: 2
        }}
      >
        <Typography variant="body1" color="textSecondary">
          No documents uploaded yet
        </Typography>
        <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
          Upload a document to start asking questions
        </Typography>
      </Paper>
    );
  }

  const getFileIcon = (fileType) => {
    switch (fileType.toLowerCase()) {
      case 'pdf':
        return <DescriptionIcon sx={{ color: '#f44336' }} />;
      case 'docx':
        return <DescriptionIcon sx={{ color: '#2196f3' }} />;
      case 'xlsx':
        return <DescriptionIcon sx={{ color: '#4caf50' }} />;
      case 'txt':
        return <DescriptionIcon sx={{ color: '#9e9e9e' }} />;
      default:
        return <DescriptionIcon />;
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Unknown date';
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  return (
    <List sx={{ width: '100%', bgcolor: 'background.paper', borderRadius: 2, overflow: 'hidden' }}>
      {documents.map((document) => (
        <ListItem
          key={document._id}
          disablePadding
          secondaryAction={
            <IconButton 
              edge="end" 
              aria-label="delete"
              onClick={() => onDeleteDocument && onDeleteDocument(document._id)}
            >
              <DeleteIcon />
            </IconButton>
          }
          sx={{
            borderBottom: '1px solid',
            borderColor: 'divider',
            backgroundColor: selectedDocumentId === document._id ? 'rgba(58, 134, 255, 0.08)' : 'inherit'
          }}
        >
          <ListItemButton 
            onClick={() => onSelectDocument && onSelectDocument(document._id)}
            selected={selectedDocumentId === document._id}
            sx={{ borderRadius: 0 }}
          >
            <ListItemAvatar>
              <Avatar 
                variant="rounded" 
                sx={{ 
                  bgcolor: 'background.paper', 
                  color: 'primary.main',
                  boxShadow: 1
                }}
              >
                {getFileIcon(document.fileType)}
              </Avatar>
            </ListItemAvatar>
            <ListItemText
              primary={
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <Typography 
                    variant="subtitle1" 
                    component="span" 
                    sx={{ mr: 1, fontWeight: selectedDocumentId === document._id ? 600 : 400 }}
                  >
                    {document.originalName}
                  </Typography>
                  {document.vectorized ? (
                    <Tooltip title="Ready for Q&A">
                      <Chip 
                        label="Ready" 
                        size="small" 
                        color="success" 
                        sx={{ height: 20, fontSize: '0.7rem' }}
                      />
                    </Tooltip>
                  ) : (
                    <Tooltip title="Processing...">
                      <Chip 
                        label="Processing" 
                        size="small" 
                        color="warning" 
                        sx={{ height: 20, fontSize: '0.7rem' }}
                      />
                    </Tooltip>
                  )}
                </Box>
              }
              secondary={
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <Typography
                    component="span"
                    variant="body2"
                    color="text.secondary"
                  >
                    {formatDate(document.createdAt)}
                  </Typography>
                  {document.vectorized && (
                    <Tooltip title="Chat with document">
                      <IconButton 
                        size="small" 
                        color="primary"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectDocument && onSelectDocument(document._id);
                        }}
                        sx={{ ml: 1 }}
                      >
                        <ChatIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  )}
                </Box>
              }
            />
          </ListItemButton>
        </ListItem>
      ))}
    </List>
  );
};

export default DocumentList; 