import React, { useState, useRef, useEffect } from 'react';
import { 
  Box, 
  Paper, 
  TextField, 
  IconButton, 
  Typography, 
  Avatar,
  Card,
  Divider,
  Button,
  Collapse,
  Tooltip
} from '@mui/material';
import { 
  Send as SendIcon,
  SmartToy as BotIcon,
  Person as PersonIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Article as ArticleIcon
} from '@mui/icons-material';
import ReactMarkdown from 'react-markdown';
import { documentApi } from '../api';
import LoadingDots from './LoadingDots';
import { motion } from 'framer-motion';

const ChatInterface = ({ documentId, documentName }) => {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [expandedSources, setExpandedSources] = useState({});
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading, expandedSources]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !documentId) return;

    const question = newMessage.trim();
    setNewMessage('');
    setIsLoading(true);
    setError(null);

    // Add user message to chat
    const userMessage = {
      id: Date.now(),
      content: question,
      sender: 'user',
      timestamp: new Date(),
    };
    
    setMessages(prevMessages => [...prevMessages, userMessage]);

    try {
      // Send API request
      const response = await documentApi.askQuestion(documentId, question);
      
      // Add bot response to chat
      const botMessage = {
        id: Date.now() + 1,
        content: response.data.data.answer,
        sender: 'bot',
        timestamp: new Date(),
        sources: response.data.data.sources
      };
      
      setMessages(prevMessages => [...prevMessages, botMessage]);
    } catch (err) {
      console.error('Error asking question:', err);
      setError('Failed to get an answer. Please try again.');
      
      // Add error message
      const errorMessage = {
        id: Date.now() + 1,
        content: 'Sorry, I encountered an error while processing your question.',
        sender: 'bot',
        timestamp: new Date(),
        isError: true
      };
      
      setMessages(prevMessages => [...prevMessages, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleSourceExpand = (messageId, sourceIndex) => {
    setExpandedSources(prev => {
      const key = `${messageId}-${sourceIndex}`;
      return {
        ...prev,
        [key]: !prev[key]
      };
    });
  };

  const renderMessage = (message) => {
    const isBot = message.sender === 'bot';

    return (
      <Box
        key={message.id}
        sx={{
          display: 'flex',
          flexDirection: isBot ? 'row' : 'row-reverse',
          mb: 2,
          maxWidth: '90%',
          alignSelf: isBot ? 'flex-start' : 'flex-end',
        }}
        component={motion.div}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <Avatar
          sx={{
            bgcolor: isBot ? 'primary.main' : 'secondary.main',
            width: 36,
            height: 36,
            mr: isBot ? 1 : 0,
            ml: isBot ? 0 : 1,
          }}
        >
          {isBot ? <BotIcon /> : <PersonIcon />}
        </Avatar>

        <Card
          variant="outlined"
          sx={{
            p: 2,
            maxWidth: '80%',
            borderRadius: 2,
            bgcolor: isBot ? 'background.paper' : 'primary.light',
            color: isBot ? 'text.primary' : 'white',
            boxShadow: isBot ? 1 : 'none',
            position: 'relative',
          }}
        >
          <Typography
            component="div"
            variant="body1"
            sx={{
              wordBreak: 'break-word',
              '& a': {
                color: isBot ? 'primary.main' : 'inherit',
                textDecoration: 'underline',
              },
              '& pre': {
                bgcolor: 'rgba(0, 0, 0, 0.05)',
                p: 1,
                borderRadius: 1,
                overflowX: 'auto',
              },
              '& code': {
                bgcolor: 'rgba(0, 0, 0, 0.05)',
                p: 0.5,
                borderRadius: 0.5,
              },
            }}
          >
            {message.isError ? (
              <Typography color="error">{message.content}</Typography>
            ) : (
              <ReactMarkdown>{message.content}</ReactMarkdown>
            )}
          </Typography>

          {message.sources && message.sources.length > 0 && (
            <Box sx={{ mt: 2 }}>
              <Divider sx={{ my: 1 }} />
              <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <ArticleIcon fontSize="small" sx={{ mr: 0.5 }} />
                Sources:
              </Typography>
              {message.sources.map((source, sourceIndex) => {
                const sourceKey = `${message.id}-${sourceIndex}`;
                const isExpanded = expandedSources[sourceKey];
                
                return (
                  <Card 
                    key={sourceIndex} 
                    variant="outlined" 
                    sx={{ 
                      mb: 1, 
                      p: 1, 
                      bgcolor: 'rgba(0, 0, 0, 0.02)',
                      borderColor: 'rgba(0, 0, 0, 0.1)'
                    }}
                  >
                    <Box 
                      sx={{ 
                        display: 'flex', 
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        cursor: 'pointer'
                      }}
                      onClick={() => toggleSourceExpand(message.id, sourceIndex)}
                    >
                      <Typography variant="caption" fontWeight={500}>
                        {source.metadata?.page ? `Page ${source.metadata.page}` : `Source ${sourceIndex + 1}`}
                      </Typography>
                      <Tooltip title={isExpanded ? "Hide source" : "Show source"}>
                        <IconButton size="small">
                          {isExpanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
                        </IconButton>
                      </Tooltip>
                    </Box>
                    <Collapse in={isExpanded}>
                      <Typography 
                        variant="body2" 
                        sx={{ 
                          mt: 1, 
                          p: 1, 
                          bgcolor: 'background.paper',
                          borderRadius: 1,
                          fontSize: '0.8rem',
                          maxHeight: '150px',
                          overflow: 'auto'
                        }}
                      >
                        {source.content}
                      </Typography>
                    </Collapse>
                  </Card>
                );
              })}
            </Box>
          )}

          <Typography 
            variant="caption" 
            color={isBot ? "text.secondary" : "rgba(255,255,255,0.7)"}
            sx={{ 
              position: 'absolute',
              bottom: 4,
              right: 8,
              fontSize: '0.7rem'
            }}
          >
            {new Date(message.timestamp).toLocaleTimeString()}
          </Typography>
        </Card>
      </Box>
    );
  };

  return (
    <Paper
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        borderRadius: 3,
        overflow: 'hidden',
        boxShadow: 3,
      }}
    >
      <Box
        sx={{
          p: 2,
          borderBottom: '1px solid',
          borderColor: 'divider',
          bgcolor: 'background.paper',
          display: 'flex',
          alignItems: 'center',
        }}
      >
        <BotIcon color="primary" sx={{ mr: 1 }} />
        <Typography variant="subtitle1" fontWeight={600}>
          Chat with: {documentName || 'Document'}
        </Typography>
      </Box>

      <Box
        sx={{
          flex: 1,
          p: 2,
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          bgcolor: '#f5f7fb',
        }}
      >
        {messages.length === 0 ? (
          <Box
            sx={{
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              color: 'text.secondary',
            }}
          >
            <BotIcon sx={{ fontSize: 60, mb: 2, color: 'primary.main', opacity: 0.6 }} />
            <Typography variant="body1" textAlign="center">
              Ask questions about the document.
            </Typography>
            <Typography variant="body2" textAlign="center" sx={{ mt: 1, maxWidth: '80%' }}>
              The AI will provide answers based on the document content.
            </Typography>
          </Box>
        ) : (
          messages.map(message => renderMessage(message))
        )}

        {isLoading && (
          <Box
            sx={{
              display: 'flex',
              mb: 2,
              alignSelf: 'flex-start',
              maxWidth: '80%',
            }}
            component={motion.div}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <Avatar
              sx={{
                bgcolor: 'primary.main',
                width: 36,
                height: 36,
                mr: 1,
              }}
            >
              <BotIcon />
            </Avatar>
            <Card
              variant="outlined"
              sx={{
                p: 2,
                borderRadius: 2,
                bgcolor: 'background.paper',
                boxShadow: 1,
              }}
            >
              <LoadingDots text="Thinking" />
            </Card>
          </Box>
        )}

        {error && (
          <Typography
            color="error"
            variant="body2"
            sx={{ textAlign: 'center', mt: 2, mb: 2 }}
          >
            {error}
          </Typography>
        )}
        
        <div ref={messagesEndRef} />
      </Box>

      <Box
        component="form"
        onSubmit={handleSendMessage}
        sx={{
          p: 2,
          borderTop: '1px solid',
          borderColor: 'divider',
          bgcolor: 'background.paper',
          display: 'flex',
        }}
      >
        <TextField
          fullWidth
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Ask a question about this document..."
          variant="outlined"
          size="small"
          disabled={isLoading || !documentId}
          InputProps={{
            sx: {
              borderRadius: 30,
              bgcolor: 'background.default',
              '& .MuiOutlinedInput-notchedOutline': {
                borderColor: 'rgba(0, 0, 0, 0.1)',
              },
            },
          }}
        />
        <Button
          type="submit"
          variant="contained"
          color="primary"
          disabled={!newMessage.trim() || isLoading || !documentId}
          sx={{
            ml: 1,
            borderRadius: 30,
            minWidth: 'auto',
            px: 2,
          }}
          endIcon={<SendIcon />}
        >
          Send
        </Button>
      </Box>
    </Paper>
  );
};

export default ChatInterface; 