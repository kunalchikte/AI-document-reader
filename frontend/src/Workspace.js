import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Tabs,
  Tab,
  Alert,
  Button,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import {
  CloudUploadOutlined as CloudUploadIcon,
  Refresh as RefreshIcon,
  ForumOutlined as ChatIcon,
  FolderOpenOutlined as FolderIcon,
} from '@mui/icons-material';
import { documentApi, systemApi } from './api';
import Header from './components/Header';
import DocumentUpload from './components/DocumentUpload';
import DocumentList from './components/DocumentList';
import ChatInterface from './components/ChatInterface';
import ProcessingIndicator from './components/ProcessingIndicator';
import StatusIndicator from './components/StatusIndicator';
import SystemLoadingOverlay from './components/SystemLoadingOverlay';
import { motion } from 'framer-motion';

function Workspace() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const [documents, setDocuments] = useState([]);
  const [selectedDocumentId, setSelectedDocumentId] = useState(null);
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [loading, setLoading] = useState(false);
  const [processingDocument, setProcessingDocument] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState(0);

  const [ollamaStatus, setOllamaStatus] = useState(null);
  const [ollamaDetails, setOllamaDetails] = useState(null);
  const [postgresStatus, setPostgresStatus] = useState(null);
  const [postgresDetails, setPostgresDetails] = useState(null);
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [systemInitialized, setSystemInitialized] = useState(false);
  const [systemCheckMessage, setSystemCheckMessage] = useState('');

  useEffect(() => {
    const initializeSystem = async () => {
      await checkSystemStatus();
      await fetchDocuments();
      setSystemInitialized(true);
    };
    initializeSystem();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedDocumentId) {
      setSelectedDocument(null);
      setProcessingDocument(false);
      return undefined;
    }

    let cancelled = false;
    let intervalId;

    const load = async () => {
      try {
        const response = await documentApi.getDocumentById(selectedDocumentId);
        if (cancelled) return;
        setSelectedDocument(response.data.data);

        if (response.data.data && !response.data.data.vectorized) {
          setProcessingDocument(true);
          intervalId = setInterval(async () => {
            try {
              const updateResponse = await documentApi.getDocumentById(selectedDocumentId);
              if (updateResponse.data.data.vectorized) {
                setSelectedDocument(updateResponse.data.data);
                setProcessingDocument(false);
                clearInterval(intervalId);
              }
            } catch (pollErr) {
              console.error('Error polling document status:', pollErr);
            }
          }, 3000);
        } else {
          setProcessingDocument(false);
        }
      } catch (err) {
        console.error('Error fetching document details:', err);
        if (!cancelled) setError('Failed to load document details.');
      }
    };

    load();

    return () => {
      cancelled = true;
      if (intervalId) clearInterval(intervalId);
    };
  }, [selectedDocumentId]);

  const fetchDocuments = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await documentApi.getDocuments();
      setDocuments(response.data.data || []);
    } catch (err) {
      console.error('Error fetching documents:', err);
      setError('Failed to load documents. Please check your connection.');
    } finally {
      setLoading(false);
    }
  };

  const handleDocumentUpload = (documentId) => {
    fetchDocuments();
    setSelectedDocumentId(documentId);
    setActiveTab(isMobile ? 2 : 0);
  };

  const handleSelectDocument = (documentId) => {
    setSelectedDocumentId(documentId);
    if (isMobile) setActiveTab(2);
  };

  const handleDeleteDocument = async (documentId) => {
    try {
      await documentApi.deleteDocument(documentId);
      if (documentId === selectedDocumentId) setSelectedDocumentId(null);
      fetchDocuments();
    } catch (err) {
      console.error('Error deleting document:', err);
      setError('Failed to delete document.');
    }
  };

  const checkSystemStatus = async () => {
    setCheckingStatus(true);
    const progressMessages = [
      'Starting diagnostics…',
      'Checking Ollama…',
      'Verifying database…',
      'Validating vector storage…',
      'Finishing up…',
    ];
    setSystemCheckMessage(progressMessages[0]);

    try {
      setSystemCheckMessage(progressMessages[1]);
      const ollamaResponse = await systemApi.checkOllamaStatus();
      const ollamaServerStatus = ollamaResponse.data.data?.server?.status === true;

      setOllamaStatus(ollamaServerStatus);
      setOllamaDetails(ollamaResponse.data.data);

      setSystemCheckMessage(progressMessages[2]);
      const postgresResponse = await systemApi.checkPostgreSQLStatus();
      const postgresConnectionStatus =
        postgresResponse.data.data?.connection?.status !== false;

      setPostgresStatus(postgresConnectionStatus);
      setPostgresDetails(postgresResponse.data.data);
      setSystemCheckMessage(progressMessages[4]);

      if (!ollamaServerStatus && !systemInitialized) {
        setSystemCheckMessage('Ollama not detected. You can still browse the UI.');
      }

      await new Promise((resolve) => setTimeout(resolve, 350));
    } catch (err) {
      console.error('Error checking system status:', err);
      setOllamaStatus(false);
      setPostgresStatus(false);
      setSystemCheckMessage('Status check failed. Retry when services are up.');
    } finally {
      setCheckingStatus(false);
      setTimeout(() => setSystemCheckMessage(''), 400);
    }
  };

  const sidebar = (
    <Box className="panel" sx={{ height: { md: '100%' } }}>
      <Box className="panel-header">
        <Typography variant="subtitle1">Library</Typography>
        <Typography variant="caption" color="text.secondary">
          {documents.length} file{documents.length === 1 ? '' : 's'}
        </Typography>
      </Box>
      <Box className="panel-body" sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
        <Box>
          <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: '0.08em' }}>
            Upload
          </Typography>
          <DocumentUpload onUploadComplete={handleDocumentUpload} />
        </Box>
        <Box sx={{ flex: 1, minHeight: 0 }}>
          <Typography
            variant="overline"
            color="text.secondary"
            sx={{ letterSpacing: '0.08em', display: 'block', mb: 1 }}
          >
            Documents
          </Typography>
          <DocumentList
            documents={documents}
            loading={loading}
            onSelectDocument={handleSelectDocument}
            onDeleteDocument={handleDeleteDocument}
            selectedDocumentId={selectedDocumentId}
          />
        </Box>
      </Box>
    </Box>
  );

  const chatArea = selectedDocumentId ? (
    processingDocument ? (
      <ProcessingIndicator fileName={selectedDocument?.originalName} />
    ) : (
      <ChatInterface
        documentId={selectedDocumentId}
        documentName={selectedDocument?.originalName}
      />
    )
  ) : (
    <Box
      className="empty-state"
      component={motion.div}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
    >
      <Box
        sx={{
          width: 56,
          height: 56,
          borderRadius: 2,
          display: 'grid',
          placeItems: 'center',
          bgcolor: 'var(--color-accent-soft)',
          color: 'var(--color-accent)',
          mb: 1,
        }}
      >
        <CloudUploadIcon />
      </Box>
      <Typography
        variant="h4"
        sx={{
          fontFamily: 'var(--font-display)',
          fontWeight: 700,
          fontSize: { xs: '1.6rem', sm: '2rem' },
          letterSpacing: '-0.03em',
          maxWidth: 480,
        }}
      >
        Select a document to start chatting
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 460 }}>
        Upload a PDF, DOCX, XLSX, or TXT file. Once processed, ask questions and get answers
        grounded in the document content.
      </Typography>
      {isMobile && (
        <Button variant="contained" onClick={() => setActiveTab(0)} sx={{ mt: 1 }}>
          Go to upload
        </Button>
      )}
    </Box>
  );

  return (
    <Box className="app-shell">
      <SystemLoadingOverlay loading={checkingStatus} message={systemCheckMessage} />
      <Header />

      <Box className="app-main" component="main">
        {error && (
          <Alert
            severity="error"
            sx={{ mb: 2 }}
            action={
              <Button color="inherit" size="small" startIcon={<RefreshIcon />} onClick={fetchDocuments}>
                Retry
              </Button>
            }
          >
            {error}
          </Alert>
        )}

        <StatusIndicator
          loading={false}
          ollamaStatus={ollamaStatus}
          ollamaDetails={ollamaDetails}
          postgresStatus={postgresStatus}
          postgresDetails={postgresDetails}
          onCheckStatus={checkSystemStatus}
        />

        {isMobile ? (
          <Box>
            <Box className="mobile-tabs">
              <Tabs
                value={activeTab}
                onChange={(_, v) => setActiveTab(v)}
                variant="fullWidth"
                aria-label="Workspace sections"
              >
                <Tab icon={<CloudUploadIcon />} iconPosition="start" label="Upload" />
                <Tab icon={<FolderIcon />} iconPosition="start" label="Files" />
                <Tab
                  icon={<ChatIcon />}
                  iconPosition="start"
                  label="Chat"
                  disabled={!selectedDocumentId}
                />
              </Tabs>
            </Box>

            {activeTab === 0 && (
              <Box className="panel">
                <Box className="panel-header">
                  <Typography variant="subtitle1">Upload</Typography>
                </Box>
                <Box className="panel-body">
                  <DocumentUpload onUploadComplete={handleDocumentUpload} />
                </Box>
              </Box>
            )}

            {activeTab === 1 && (
              <Box className="panel">
                <Box className="panel-header">
                  <Typography variant="subtitle1">Documents</Typography>
                </Box>
                <Box className="panel-body">
                  <DocumentList
                    documents={documents}
                    loading={loading}
                    onSelectDocument={handleSelectDocument}
                    onDeleteDocument={handleDeleteDocument}
                    selectedDocumentId={selectedDocumentId}
                  />
                </Box>
              </Box>
            )}

            {activeTab === 2 && chatArea}
          </Box>
        ) : (
          <Box className="workspace-grid">
            {sidebar}
            {chatArea}
          </Box>
        )}
      </Box>

      <Box
        component="footer"
        sx={{
          py: 2,
          px: 2,
          borderTop: '1px solid',
          borderColor: 'divider',
          bgcolor: 'rgba(255,255,255,0.7)',
          backdropFilter: 'blur(8px)',
        }}
      >
        <Typography variant="caption" color="text.secondary" align="center" display="block">
          AI Document Reader — LangChain · PostgreSQL / pgvector · Ollama
        </Typography>
      </Box>
    </Box>
  );
}

export default Workspace;
