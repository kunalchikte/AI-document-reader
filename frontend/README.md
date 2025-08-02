# AI Document Reader Frontend

This is the frontend application for the AI Document Reader, which allows users to upload documents and ask questions about their content using AI.

## Features

- Upload documents (PDF, DOCX, XLSX, TXT)
- Process documents for Q&A using AI
- Chat interface to ask questions about documents
- View document sources in answers
- Responsive design for mobile and desktop

## Tech Stack

- React.js
- Material UI
- Framer Motion for animations
- Axios for API requests
- React Markdown for rendering markdown content

## Getting Started

### Prerequisites

- Node.js v14+ and npm
- Backend API running (with Ollama and Supabase configured)

### Installation

1. Clone the repository:

```bash
git clone https://github.com/yourusername/ai-document-reader-frontend.git
cd ai-document-reader-frontend
```

2. Install dependencies:

```bash
npm install
```

3. Configure the API URL:

Create a `.env` file in the root directory:

```
REACT_APP_API_URL=http://localhost:3001
```

4. Start the development server:

```bash
npm start
```

The application will be available at `http://localhost:3000`.

## Connecting to the Backend

Make sure the backend API is running and accessible. The frontend will connect to the API URL specified in the `.env` file.

## System Requirements

The AI Document Reader system needs:

1. **Ollama** - For local AI model hosting
2. **Supabase** - For vector database storage

The application will check the status of these services when it starts up.

## Building for Production

To build the application for production:

```bash
npm run build
```

This will create a `build` folder with the optimized production build.

## License

[MIT](LICENSE) 