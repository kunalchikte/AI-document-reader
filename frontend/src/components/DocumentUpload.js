import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { 
  Box, 
  Typography, 
  Paper, 
  Button, 
  List, 
  ListItem, 
  ListItemIcon, 
  ListItemText,
  IconButton,
  LinearProgress,
  Alert
} from '@mui/material';
import { 
  CloudUpload as CloudUploadIcon, 
  Description as DescriptionIcon,
  Delete as DeleteIcon
} from '@mui/icons-material';
import { documentApi } from '../api';

const DocumentUpload = ({ onUploadComplete }) => {
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({});
  const [error, setError] = useState(null);

  const onDrop = useCallback((acceptedFiles) => {
    // Filter for supported file types: PDF, DOCX, XLSX, TXT
    const supportedFiles = acceptedFiles.filter(file => {
      const fileType = file.name.split('.').pop().toLowerCase();
      return ['pdf', 'docx', 'xlsx', 'txt'].includes(fileType);
    });
    
    if (supportedFiles.length !== acceptedFiles.length) {
      setError('Some files were ignored. Only PDF, DOCX, XLSX, and TXT files are supported.');
    } else {
      setError(null);
    }
    
    setFiles((prevFiles) => [...prevFiles, ...supportedFiles]);
  }, []);
  
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'text/plain': ['.txt'],
    },
    maxSize: 10485760, // 10 MB
    multiple: false // Allow only one file at a time
  });
  
  const removeFile = (fileIndex) => {
    setFiles((prevFiles) => prevFiles.filter((_, index) => index !== fileIndex));
  };
  
  const getFileIcon = (fileName) => {
    const extension = fileName.split('.').pop().toLowerCase();
    switch (extension) {
      case 'pdf':
        return <DescriptionIcon color="error" />;
      case 'docx':
        return <DescriptionIcon color="primary" />;
      case 'xlsx':
        return <DescriptionIcon color="success" />;
      case 'txt':
        return <DescriptionIcon color="info" />;
      default:
        return <DescriptionIcon />;
    }
  };
  
  const handleUpload = async () => {
    if (files.length === 0) return;
    
    setUploading(true);
    setError(null);
    
    try {
      // Upload the first file only (single document chat)
      const file = files[0];
      
      setUploadProgress({ [file.name]: 0 });
      
      // Upload the document
      const uploadResponse = await documentApi.uploadDocument(file);
      setUploadProgress({ [file.name]: 50 });
      
      console.log('Upload response:', uploadResponse);
      
      // Check different possible response structures
      let documentId;
      
      if (uploadResponse.data?.data?._id) {
        // Standard structure as expected
        documentId = uploadResponse.data.data._id;
      } else if (uploadResponse.data?._id) {
        // Alternative structure without nested data
        documentId = uploadResponse.data._id;
      } else if (uploadResponse.data?.data?.id) {
        // Some APIs use 'id' instead of '_id'
        documentId = uploadResponse.data.data.id;
      } else if (uploadResponse.data?.id) {
        // Direct id property
        documentId = uploadResponse.data.id;
      }
      
      // Check if we got a valid document ID
      if (!documentId) {
        console.error('No document ID found in response:', uploadResponse);
        // Try to find any property that looks like an ID
        const responseData = uploadResponse.data?.data || uploadResponse.data;
        if (responseData) {
          const possibleIdKeys = Object.keys(responseData).filter(key => 
            key.toLowerCase().includes('id') || key === '_id');
          if (possibleIdKeys.length > 0) {
            documentId = responseData[possibleIdKeys[0]];
            console.log(`Using ${possibleIdKeys[0]} as document ID:`, documentId);
          }
        }
      }
      
      if (!documentId) {
        throw new Error('Failed to get document ID from upload response');
      }
      
      // Process the document
      await documentApi.processDocument(documentId);
      setUploadProgress({ [file.name]: 100 });
      
      // Clear files after successful upload
      setFiles([]);
      
      // Notify parent component
      if (onUploadComplete) {
        onUploadComplete(documentId);
      }
      
    } catch (error) {
      console.error('Error uploading or processing document:', error);
      
      // Provide more specific error messages
      if (error.message.includes('document ID')) {
        setError('Failed to process document: Could not retrieve document ID from server response.');
      } else if (error.response?.status === 404) {
        setError('API endpoint not found. Please check server configuration.');
      } else if (error.response?.status === 401) {
        setError('Authentication failed. Please check your credentials.');
      } else if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
        setError('Connection timed out. Server might be busy or unreachable.');
      } else if (!navigator.onLine) {
        setError('No internet connection. Please check your network.');
      } else {
        setError(`Failed to ${error.message.includes('document ID') ? 'process' : 'upload'} document: ${error.response?.data?.msg || error.message}`);
      }
    } finally {
      setUploading(false);
    }
  };
  
  return (
    <Box sx={{ width: '100%' }}>
      {error && (
        <Alert 
          severity="error" 
          sx={{ mb: 2 }}
          onClose={() => setError(null)}
        >
          {error}
        </Alert>
      )}
      
      <Paper
        {...getRootProps()}
        elevation={3}
        sx={{
          p: 3,
          borderRadius: 2,
          border: '2px dashed',
          borderColor: isDragActive ? 'primary.main' : 'grey.300',
          backgroundColor: isDragActive ? 'rgba(58, 134, 255, 0.05)' : 'background.paper',
          transition: 'all 0.3s',
          cursor: 'pointer',
          mb: 3,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '200px',
          '&:hover': {
            borderColor: 'primary.light',
            backgroundColor: 'rgba(58, 134, 255, 0.05)'
          }
        }}
      >
        <input {...getInputProps()} />
        <CloudUploadIcon color="primary" sx={{ fontSize: 60, mb: 2 }} />
        <Typography variant="h6" color="textPrimary" align="center" gutterBottom>
          {isDragActive ? 'Drop your document here...' : 'Drag & drop your document here'}
        </Typography>
        <Typography variant="body2" color="textSecondary" align="center">
          or click to select files
        </Typography>
        <Typography variant="caption" color="textSecondary" align="center" sx={{ mt: 1 }}>
          Supported formats: PDF, DOCX, XLSX, TXT (Max size: 10MB)
        </Typography>
      </Paper>
      
      {files.length > 0 && (
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle1" gutterBottom>
            Selected Document:
          </Typography>
          <List>
            {files.map((file, index) => (
              <ListItem
                key={index}
                secondaryAction={
                  !uploading && (
                    <IconButton edge="end" onClick={() => removeFile(index)} disabled={uploading}>
                      <DeleteIcon />
                    </IconButton>
                  )
                }
                sx={{
                  backgroundColor: 'background.paper',
                  borderRadius: 1,
                  mb: 1,
                  boxShadow: 1
                }}
              >
                <ListItemIcon>
                  {getFileIcon(file.name)}
                </ListItemIcon>
                <ListItemText 
                  primary={file.name} 
                  secondary={`${(file.size / (1024 * 1024)).toFixed(2)} MB`} 
                />
                {uploading && uploadProgress[file.name] !== undefined && (
                  <Box sx={{ width: '100%', ml: 2 }}>
                    <LinearProgress
                      variant="determinate"
                      value={uploadProgress[file.name]}
                      sx={{ height: 8, borderRadius: 5 }}
                    />
                  </Box>
                )}
              </ListItem>
            ))}
          </List>
          
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
            <Button
              variant="contained"
              color="primary"
              onClick={handleUpload}
              disabled={files.length === 0 || uploading}
              startIcon={<CloudUploadIcon />}
              sx={{ px: 3 }}
            >
              {uploading ? 'Uploading...' : 'Upload & Process'}
            </Button>
          </Box>
        </Box>
      )}
    </Box>
  );
};

export default DocumentUpload; 