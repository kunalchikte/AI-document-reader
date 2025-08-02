import React from 'react';
import { Box, Typography } from '@mui/material';
import { keyframes } from '@emotion/react';
import { styled } from '@mui/system';

const dotAnimation = keyframes`
  0% { opacity: 0.2; transform: scale(0.8); }
  20% { opacity: 1; transform: scale(1); }
  100% { opacity: 0.2; transform: scale(0.8); }
`;

const Dot = styled('span')(({ theme, delay }) => ({
  display: 'inline-block',
  width: '8px',
  height: '8px',
  margin: '0 3px',
  borderRadius: '50%',
  backgroundColor: theme.palette.primary.main,
  animation: `${dotAnimation} 1.4s infinite ease-in-out`,
  animationDelay: `${delay}s`,
}));

const textAnimation = keyframes`
  0% { opacity: 0.6; }
  50% { opacity: 1; }
  100% { opacity: 0.6; }
`;

const AnimatedText = styled(Typography)(({ theme }) => ({
  color: theme.palette.text.secondary,
  animation: `${textAnimation} 1.5s infinite ease-in-out`,
  marginRight: theme.spacing(1),
}));

const LoadingDots = ({ text = "Loading", dotCount = 3, size = "medium" }) => {
  const dots = Array.from({ length: dotCount }).map((_, index) => (
    <Dot key={index} delay={index * 0.2} />
  ));

  const getSize = (size) => {
    switch (size) {
      case 'small':
        return { 
          textVariant: 'caption',
          dotSize: '6px',
          dotMargin: '2px',
        };
      case 'large':
        return { 
          textVariant: 'body1',
          dotSize: '10px',
          dotMargin: '4px',
        };
      case 'medium':
      default:
        return { 
          textVariant: 'body2',
          dotSize: '8px',
          dotMargin: '3px',
        };
    }
  };

  const { textVariant } = getSize(size);

  return (
    <Box 
      sx={{ 
        display: 'flex', 
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <AnimatedText variant={textVariant}>{text}</AnimatedText>
      <Box sx={{ display: 'flex', alignItems: 'center' }}>
        {dots}
      </Box>
    </Box>
  );
};

export default LoadingDots; 