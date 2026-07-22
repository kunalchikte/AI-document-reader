import React, { useState } from 'react';
import {
  Box,
  Button,
  TextField,
  Typography,
  Alert,
  Link,
  CircularProgress,
} from '@mui/material';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const AuthPage = ({ mode = 'login' }) => {
  const isRegister = mode === 'register';
  const { login, register } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      if (isRegister) {
        await register(email.trim(), password, name.trim() || undefined);
      } else {
        await login(email.trim(), password);
      }
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.response?.data?.msg || err.message || 'Authentication failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100dvh',
        display: 'grid',
        placeItems: 'center',
        px: 2,
        py: 4,
        background:
          'radial-gradient(ellipse 70% 50% at 10% 0%, rgba(37,99,235,0.12), transparent 55%), var(--color-bg)',
      }}
    >
      <Box
        component="form"
        onSubmit={handleSubmit}
        sx={{
          width: '100%',
          maxWidth: 420,
          p: { xs: 3, sm: 4 },
          borderRadius: 3,
          border: '1px solid',
          borderColor: 'divider',
          bgcolor: 'background.paper',
        }}
      >
        <Typography
          variant="h4"
          sx={{ fontFamily: 'var(--font-display)', fontWeight: 800, mb: 0.5 }}
        >
          {isRegister ? 'Create account' : 'Welcome back'}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          {isRegister
            ? 'Upload documents and ask questions — private to your account.'
            : 'Sign in to access your documents and chat history.'}
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {isRegister && (
          <TextField
            fullWidth
            label="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            margin="normal"
            autoComplete="name"
          />
        )}
        <TextField
          fullWidth
          required
          type="email"
          label="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          margin="normal"
          autoComplete="email"
        />
        <TextField
          fullWidth
          required
          type="password"
          label="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          margin="normal"
          autoComplete={isRegister ? 'new-password' : 'current-password'}
          helperText={isRegister ? 'At least 6 characters' : undefined}
        />

        <Button
          fullWidth
          type="submit"
          variant="contained"
          disabled={submitting}
          sx={{ mt: 2.5, mb: 2 }}
        >
          {submitting ? (
            <CircularProgress size={22} color="inherit" />
          ) : isRegister ? (
            'Create account'
          ) : (
            'Sign in'
          )}
        </Button>

        <Typography variant="body2" color="text.secondary" align="center">
          {isRegister ? (
            <>
              Already have an account?{' '}
              <Link component={RouterLink} to="/login" underline="hover">
                Sign in
              </Link>
            </>
          ) : (
            <>
              New here?{' '}
              <Link component={RouterLink} to="/register" underline="hover">
                Create an account
              </Link>
            </>
          )}
        </Typography>
      </Box>
    </Box>
  );
};

export default AuthPage;
