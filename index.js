/** @format */
import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { DirectoryLoader } from "langchain/document_loaders/fs/directory";
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { PromptTemplate } from "@langchain/core/prompts";
import { Ollama } from "@langchain/ollama";
import { OllamaEmbeddings } from "@langchain/community/embeddings/ollama";
import { MemoryVectorStore } from "langchain/vectorstores/memory";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const { PORT = 3000, DOCUMENTS_PATH = "documents/", OLLAMA_MODEL = "deepseek-r1:8b", CHUNK_SIZE = 1000, CHUNK_OVERLAP = 200, TEMPERATURE = 2, MAX_RETRIES = 2, SIMILAR_DOCS_COUNT = 3 } = process.env;

let vectorStore = null;
let splitDocuments = [];

app.use(express.json());

const storage = multer.diskStorage({
	destination: (req, file, cb) => {
		!fs.existsSync(DOCUMENTS_PATH) && fs.mkdirSync(DOCUMENTS_PATH);
		cb(null, DOCUMENTS_PATH);
	},
	filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname)),
});

const upload = multer({
	storage,
	fileFilter: (req, file, cb) => cb(null, file.mimetype === "application/pdf" || new Error("Only PDF files are allowed")),
});

async function initializeVectorStore() {
	try {
		const docs = await new DirectoryLoader(DOCUMENTS_PATH, {
			".pdf": path => new PDFLoader(path),
		}).load();

		const textSplitter = new RecursiveCharacterTextSplitter({
			chunkSize: parseInt(CHUNK_SIZE),
			chunkOverlap: parseInt(CHUNK_OVERLAP),
		});

		splitDocuments = await textSplitter.splitDocuments(docs);

		vectorStore = await MemoryVectorStore.fromDocuments(splitDocuments, new OllamaEmbeddings({ model: OLLAMA_MODEL }));

		return { success: true, documentCount: splitDocuments.length };
	} catch (error) {
		console.error("Failed to initialize vector store:", error);
		return { success: false, error: error.message };
	}
}

async function processQuestion(question) {
	if (!vectorStore) {
		const initResult = await initializeVectorStore();
		if (!initResult.success) {
			throw new Error("Failed to initialize vector store");
		}
	}

	const prompt = PromptTemplate.fromTemplate(`
    Based on the following context from the documents:
    {context}
    
    Please answer this question: {question}
  `);

	const llm = new Ollama({
		model: OLLAMA_MODEL,
		temperature: parseFloat(TEMPERATURE),
		maxRetries: parseInt(MAX_RETRIES),
	});

	const relevantDocs = await vectorStore.similaritySearch(question, parseInt(SIMILAR_DOCS_COUNT));
	const context = relevantDocs.map(doc => doc.pageContent).join("\n\n");
	return await prompt.pipe(llm).invoke({ context, question });
}

app.get("/api/documents", (req, res) => {
	const { page = 1, limit = 10 } = req.query;
	const startIndex = (page - 1) * limit;
	const endIndex = page * limit;

	const paginatedDocs = splitDocuments.slice(startIndex, endIndex).map((doc, index) => ({
		id: startIndex + index + 1,
		content: doc.pageContent,
		metadata: doc.metadata,
	}));

	res.json({
		total: splitDocuments.length,
		page: parseInt(page),
		totalPages: Math.ceil(splitDocuments.length / limit),
		documents: paginatedDocs,
	});
});

app.post("/api/ask", async (req, res) => {
	try {
		const { question } = req.body;
		if (!question) return res.status(400).json({ error: "Question is required" });

		const response = await processQuestion(question);

		const thinkMatch = response.match(/<think>([\s\S]*?)<\/think>/);
		const think = thinkMatch ? thinkMatch[1].trim() : null;
		const answer = response.replace(/<think>[\s\S]*?<\/think>\n*/, "").trim();

		res.json({ think, answer });
	} catch (error) {
		res.status(500).json({ error: "Failed to process question" });
	}
});

app.post("/api/upload", upload.single("pdf"), async (req, res) => {
	try {
		if (!req.file) return res.status(400).json({ error: "No PDF file uploaded" });

		const initResult = await initializeVectorStore();
		if (!initResult.success) {
			return res.status(500).json({ error: "Failed to process PDF" });
		}

		res.json({
			message: "PDF uploaded successfully",
			filename: req.file.filename,
			documentsProcessed: initResult.documentCount,
		});
	} catch (error) {
		res.status(500).json({ error: error.message });
	}
});

app.use((error, req, res, next) => {
	if (error instanceof multer.MulterError) {
		return res.status(400).json({ error: "File upload error" });
	}
	res.status(500).json({ error: error.message });
});

(async () => {
	const initResult = await initializeVectorStore();
	if (initResult.success) {
		console.log(`Vector store initialized with ${initResult.documentCount} documents`);
	}
	app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));
})();
