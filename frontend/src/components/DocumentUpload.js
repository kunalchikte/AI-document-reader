import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import {
  Box,
  Typography,
  Button,
  IconButton,
  LinearProgress,
  Alert,
  Stack,
} from '@mui/material';
import {
  CloudUploadOutlined as CloudUploadIcon,
  DescriptionOutlined as DescriptionIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import { documentApi } from '../api';

const DocumentUpload = ({ onUploadComplete }) => {
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({});
  const [error, setError] = useState(null);

  const onDrop = useCallback((acceptedFiles) => {
    const supportedFiles = acceptedFiles.filter((file) => {
      const fileType = file.name.split('.').pop().toLowerCase();
      return ['pdf', 'docx', 'xlsx', 'txt'].includes(fileType);
    });

    if (supportedFiles.length !== acceptedFiles.length) {
      setError('Only PDF, DOCX, XLSX, and TXT files are supported.');
    } else {
      setError(null);
    }

    setFiles(supportedFiles.slice(0, 1));
  }, []);

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'text/plain': ['.txt'],
    },
    maxSize: 10485760,
    multiple: false,
    noClick: false,
    noKeyboard: false,
  });

  const removeFile = () => setFiles([]);

  const resolveDocumentId = (uploadResponse) => {
    const data = uploadResponse.data?.data || uploadResponse.data || {};
    return data.documentId || data._id || data.id || uploadResponse.data?._id || uploadResponse.data?.id;
  };

  const handleUpload = async () => {
    if (files.length === 0) return;

    setUploading(true);
    setError(null);

    try {
      const file = files[0];
      setUploadProgress({ [file.name]: 10 });

      const uploadResponse = await documentApi.uploadDocument(file);
      setUploadProgress({ [file.name]: 55 });

      const documentId = resolveDocumentId(uploadResponse);
      if (!documentId) {
        throw new Error('Could not retrieve document ID from server response.');
      }

      await documentApi.processDocument(documentId);
      setUploadProgress({ [file.name]: 100 });
      setFiles([]);
      onUploadComplete?.(documentId);
    } catch (err) {
      console.error('Upload error:', err);
      if (!navigator.onLine) {
        setError('No internet connection. Check your network and retry.');
      } else if (err.response?.status === 404) {
        setError('API endpoint not found. Check server configuration.');
      } else {
        setError(err.response?.data?.msg || err.message || 'Upload failed. Please retry.');
      }
    } finally {
      setUploading(false);
    }
  };

  return (
    <Box sx={{ width: '100%' }}>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)} role="alert">
          {error}
        </Alert>
      )}

      <Box
        {...getRootProps({
          className: `dropzone${isDragActive ? ' is-active' : ''}`,
          'aria-label': 'Upload document dropzone',
        })}
      >
        <input {...getInputProps()} aria-label="Choose document file" />
        <Box
          sx={{
            width: 56,
            height: 56,
            mx: 'auto',
            mb: 1.5,
            borderRadius: 2,
            display: 'grid',
            placeItems: 'center',
            backgroundColor: 'var(--color-accent-soft)',
            color: 'var(--color-accent)',
          }}
        >
          <CloudUploadIcon />
        </Box>
        <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 0.5 }}>
          {isDragActive ? 'Drop to upload' : 'Drop a document here'}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          PDF, DOCX, XLSX, or TXT — up to 10MB
        </Typography>
        <Button
          variant="outlined"
          onClick={(e) => {
            e.stopPropagation();
            open();
          }}
        >
          Browse files
        </Button>
      </Box>

      {files.length > 0 && (
        <Stack spacing={1.5} sx={{ mt: 2 }}>
          {files.map((file) => (
            <Box
              key={file.name}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1.25,
                p: 1.25,
                borderRadius: 2,
                border: '1px solid',
                borderColor: 'divider',
                backgroundColor: '#F8FAFC',
              }}
            >
              <DescriptionIcon color="primary" />
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="body2" noWrap fontWeight={600}>
                  {file.name}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {(file.size / (1024 * 1024)).toFixed(2)} MB
                </Typography>
                {uploading && (
                  <LinearProgress
                    variant="determinate"
                    value={uploadProgress[file.name] || 0}
                    sx={{ mt: 1, height: 6, borderRadius: 99 }}
                    aria-label="Upload progress"
                  />
                )}
              </Box>
              {!uploading && (
                <IconButton aria-label={`Remove ${file.name}`} onClick={removeFile} size="small">
                  <CloseIcon fontSize="small" />
                </IconButton>
              )}
            </Box>
          ))}

          <Button
            fullWidth
            variant="contained"
            onClick={handleUpload}
            disabled={uploading}
            startIcon={<CloudUploadIcon />}
          >
            {uploading ? 'Uploading & processing…' : 'Upload & process'}
          </Button>
        </Stack>
      )}
    </Box>
  );
};

export default DocumentUpload;
