# RAG API

## Description
This API allows users to upload PDF documents, process them into vectors, and then perform question-based searches using the Ollama model. The API is built using Express.js and utilizes LangChain for document management and vector-based search.

## Features
- Upload PDF: Upload a PDF file and process it into vectors.
- Question-based Search: Ask questions related to the content of uploaded documents.
- View Processed Documents: Retrieve a list of processed documents along with metadata.

## Installation
1. Clone the repository:
    ```
    git clone https://github.com/NazarAF/deepseek-rag-langchain.git
    cd deepseek-rag-langchain
    ```

2. Install dependencies:
    ```
    npm install
    ```

3. Create a `.env` file and add the following configuration:
    ```
    PORT=3000
    DOCUMENTS_PATH=documents/
    OLLAMA_MODEL=deepseek-r1:8b
    CHUNK_SIZE=1000
    CHUNK_OVERLAP=200
    TEMPERATURE=2
    MAX_RETRIES=2
    SIMILAR_DOCS_COUNT=3
    ```

4. Start the model:
    ```
    ollama pull deepseek-r1:8b
    ollama run deepseek-r1:8b
    ```

5. Start the server:
    ```
    npm start
    ```
    The server will run at `http://localhost:3000`

## API Endpoints

1. Upload PDF
- Endpoint: `POST /api/upload`
- Description: Uploads a PDF file for processing.
- Body: `multipart/form-data` with `pdf` field (PDF file).
- Response:
    ```
    {
        "message": "PDF uploaded successfully",
        "filename": "1700000000000.pdf",
        "documentsProcessed": 10
    }
    ```

2. Ask a Question
- Endpoint: `POST /api/ask`
- Description: Asks a question based on processed documents.
- Body:
    ```
    {
        "question": "What is the content of this document?"
    }
    ```
- Response:
    ```
    {
        "think": "Analysis based on documents...",
        "answer": "The document contains..."
    }
    ```

3. View Processed Documents
- Endpoint: `GET /api/documents?page=1&limit=10`
- Description: Retrieves a list of processed documents.
- Response:
    ```
    {
        "total": 100,
        "page": 1,
        "totalPages": 10,
        "documents": [
            {
                "id": 1,
                "content": "Document content...",
                "metadata": {}
            }
        ]
    }
    ```

## Technologies Used
- Node.js & Express.js - Backend
- Multer - PDF file upload
- LangChain - Document processing and vector search
- Ollama - LLM model for answering questions
- dotenv - Environment configuration

## License
This project is licensed under the MIT License.
