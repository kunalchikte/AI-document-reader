import React, { useState, useRef, useEffect } from 'react';
import {
  Box,
  TextField,
  IconButton,
  Typography,
  Avatar,
  Button,
  Collapse,
  Tooltip,
  Chip,
  Stack,
} from '@mui/material';
import {
  Send as SendIcon,
  SmartToyOutlined as BotIcon,
  PersonOutline as PersonIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  ArticleOutlined as ArticleIcon,
} from '@mui/icons-material';
import ReactMarkdown from 'react-markdown';
import { documentApi } from '../api';
import LoadingDots from './LoadingDots';
import { motion } from 'framer-motion';

const SUGGESTIONS = [
  'What is this document about?',
  'Summarize the key points',
  'List important dates or names',
];

const ChatInterface = ({ documentId, documentName }) => {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [expandedSources, setExpandedSources] = useState({});
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    setMessages([]);
    setError(null);
    setExpandedSources({});

    if (!documentId) return undefined;

    let cancelled = false;
    const loadHistory = async () => {
      try {
        const res = await documentApi.getMessages(documentId);
        if (cancelled) return;
        const history = (res.data.data || []).map((m) => ({
          id: m.id,
          content: m.content,
          sender: m.sender || (m.role === 'user' ? 'user' : 'bot'),
          timestamp: new Date(m.timestamp || m.createdAt),
          sources: m.sources || [],
        }));
        setMessages(history);
      } catch (err) {
        console.error('Failed to load chat history:', err);
      }
    };

    loadHistory();
    return () => {
      cancelled = true;
    };
  }, [documentId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading, expandedSources]);

  const ask = async (question) => {
    if (!question.trim() || !documentId || isLoading) return;

    setNewMessage('');
    setIsLoading(true);
    setError(null);

    const userMessage = {
      id: Date.now(),
      content: question.trim(),
      sender: 'user',
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);

    try {
      const response = await documentApi.askQuestion(documentId, question.trim());
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          content: response.data.data.answer,
          sender: 'bot',
          timestamp: new Date(),
          sources: response.data.data.sources,
        },
      ]);
    } catch (err) {
      console.error('Error asking question:', err);
      setError('Failed to get an answer. Please try again.');
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          content: 'Sorry, I encountered an error while processing your question.',
          sender: 'bot',
          timestamp: new Date(),
          isError: true,
        },
      ]);
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    await ask(newMessage);
  };

  const toggleSourceExpand = (messageId, sourceIndex) => {
    const key = `${messageId}-${sourceIndex}`;
    setExpandedSources((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const renderMessage = (message) => {
    const isBot = message.sender === 'bot';

    return (
      <Box
        key={message.id}
        component={motion.div}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
        sx={{
          display: 'flex',
          flexDirection: isBot ? 'row' : 'row-reverse',
          gap: 1.25,
          mb: 2,
          maxWidth: { xs: '100%', sm: '92%' },
          alignSelf: isBot ? 'flex-start' : 'flex-end',
        }}
      >
        <Avatar
          sx={{
            bgcolor: isBot ? 'var(--color-accent)' : '#0F172A',
            width: 36,
            height: 36,
            flexShrink: 0,
          }}
          aria-hidden
        >
          {isBot ? <BotIcon fontSize="small" /> : <PersonIcon fontSize="small" />}
        </Avatar>

        <Box
          sx={{
            px: 2,
            py: 1.5,
            maxWidth: '100%',
            borderRadius: isBot ? '4px 14px 14px 14px' : '14px 4px 14px 14px',
            bgcolor: isBot ? 'var(--color-surface)' : 'var(--color-accent)',
            color: isBot ? 'text.primary' : '#fff',
            border: isBot ? '1px solid var(--color-border)' : 'none',
          }}
        >
          <Box
            sx={{
              typography: 'body1',
              fontSize: '0.95rem',
              wordBreak: 'break-word',
              '& p': { m: 0, mb: 1 },
              '& p:last-child': { mb: 0 },
              '& a': { color: isBot ? 'primary.main' : 'inherit' },
              '& pre, & code': {
                bgcolor: isBot ? 'rgba(15,23,42,0.05)' : 'rgba(255,255,255,0.15)',
                borderRadius: 1,
                px: 0.75,
                py: 0.25,
                display: 'inline-block',
              },
            }}
          >
            {message.isError ? (
              <Typography color="error.light">{message.content}</Typography>
            ) : (
              <ReactMarkdown>{message.content}</ReactMarkdown>
            )}
          </Box>

          {message.sources?.length > 0 && (
            <Box sx={{ mt: 1.5, pt: 1.25, borderTop: '1px solid', borderColor: 'divider' }}>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1, fontWeight: 600 }}
              >
                <ArticleIcon sx={{ fontSize: 14 }} /> Sources
              </Typography>
              {message.sources.map((source, sourceIndex) => {
                const sourceKey = `${message.id}-${sourceIndex}`;
                const isExpanded = expandedSources[sourceKey];
                return (
                  <Box
                    key={sourceIndex}
                    sx={{
                      mb: 1,
                      p: 1,
                      borderRadius: 1.5,
                      bgcolor: '#F8FAFC',
                      border: '1px solid',
                      borderColor: 'divider',
                    }}
                  >
                    <Box
                      sx={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        cursor: 'pointer',
                        minHeight: 36,
                      }}
                      onClick={() => toggleSourceExpand(message.id, sourceIndex)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          toggleSourceExpand(message.id, sourceIndex);
                        }
                      }}
                      aria-expanded={!!isExpanded}
                    >
                      <Typography variant="caption" fontWeight={600}>
                        {source.metadata?.page
                          ? `Page ${source.metadata.page}`
                          : `Excerpt ${sourceIndex + 1}`}
                      </Typography>
                      <IconButton size="small" aria-label={isExpanded ? 'Hide source' : 'Show source'}>
                        {isExpanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
                      </IconButton>
                    </Box>
                    <Collapse in={isExpanded}>
                      <Typography
                        variant="body2"
                        sx={{
                          mt: 0.5,
                          p: 1,
                          bgcolor: 'background.paper',
                          borderRadius: 1,
                          fontSize: '0.8rem',
                          maxHeight: 160,
                          overflow: 'auto',
                          color: 'text.secondary',
                        }}
                      >
                        {source.content}
                      </Typography>
                    </Collapse>
                  </Box>
                );
              })}
            </Box>
          )}

          <Typography
            variant="caption"
            sx={{
              display: 'block',
              mt: 1,
              textAlign: 'right',
              opacity: 0.65,
              fontSize: '0.68rem',
            }}
          >
            {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Typography>
        </Box>
      </Box>
    );
  };

  return (
    <Box className="panel chat-panel" sx={{ height: '100%' }}>
      <Box className="panel-header">
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="subtitle1" noWrap>
            Chat
          </Typography>
          <Typography variant="caption" color="text.secondary" noWrap>
            {documentName || 'Document'}
          </Typography>
        </Box>
        <Chip size="small" label="RAG" color="primary" variant="outlined" />
      </Box>

      <Box
        className="panel-body"
        sx={{
          display: 'flex',
          flexDirection: 'column',
          bgcolor: '#F8FAFC',
          flex: 1,
        }}
      >
        {messages.length === 0 ? (
          <Box sx={{ my: 'auto', py: 2 }}>
            <Typography variant="h6" sx={{ fontFamily: 'var(--font-display)', mb: 1 }}>
              Ask anything about this file
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2, maxWidth: 420 }}>
              Answers are grounded in the uploaded document. Try one of these to start:
            </Typography>
            <Stack direction="row" flexWrap="wrap" gap={1}>
              {SUGGESTIONS.map((q) => (
                <Chip
                  key={q}
                  label={q}
                  clickable
                  onClick={() => ask(q)}
                  disabled={isLoading}
                  sx={{ maxWidth: '100%', height: 'auto', py: 1, '& .MuiChip-label': { whiteSpace: 'normal' } }}
                />
              ))}
            </Stack>
          </Box>
        ) : (
          messages.map((message) => renderMessage(message))
        )}

        {isLoading && (
          <Box sx={{ display: 'flex', gap: 1.25, alignSelf: 'flex-start', mb: 1 }}>
            <Avatar sx={{ bgcolor: 'var(--color-accent)', width: 36, height: 36 }}>
              <BotIcon fontSize="small" />
            </Avatar>
            <Box
              sx={{
                px: 2,
                py: 1.5,
                borderRadius: '4px 14px 14px 14px',
                border: '1px solid',
                borderColor: 'divider',
                bgcolor: 'background.paper',
              }}
            >
              <LoadingDots text="Thinking" />
            </Box>
          </Box>
        )}

        {error && (
          <Typography color="error" variant="body2" role="alert" sx={{ textAlign: 'center', mb: 1 }}>
            {error}
          </Typography>
        )}
        <div ref={messagesEndRef} />
      </Box>

      <Box
        component="form"
        onSubmit={handleSendMessage}
        sx={{
          p: { xs: 1.5, sm: 2 },
          borderTop: '1px solid',
          borderColor: 'divider',
          display: 'flex',
          gap: 1,
          alignItems: 'center',
          bgcolor: 'background.paper',
          pb: { xs: 'calc(12px + var(--safe-bottom))', sm: 2 },
        }}
      >
        <TextField
          inputRef={inputRef}
          fullWidth
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Ask a question…"
          variant="outlined"
          size="small"
          disabled={isLoading || !documentId}
          inputProps={{ 'aria-label': 'Question about the document' }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              ask(newMessage);
            }
          }}
        />
        <Tooltip title="Send">
          <span>
            <IconButton
              type="submit"
              color="primary"
              disabled={!newMessage.trim() || isLoading || !documentId}
              aria-label="Send question"
              sx={{
                bgcolor: 'primary.main',
                color: '#fff',
                borderRadius: 2,
                '&:hover': { bgcolor: 'primary.dark' },
                '&.Mui-disabled': { bgcolor: 'action.disabledBackground', color: 'action.disabled' },
              }}
            >
              <SendIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
      </Box>
    </Box>
  );
};

export default ChatInterface;
