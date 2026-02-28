require("dotenv").config();
const express = require("express");
const mysql = require("mysql");
const cors = require("cors");
const multer = require('multer');
const axios = require("axios");

const app = express();
const PORT = process.env.PORT || 5000;

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

app.use(express.json());
app.use(cors());

// MySQL Connection
const db = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
});

db.connect((err) => {
  if (err) {
    console.error("❌ Database connection failed:", err);
    process.exit(1);
  } else {
    console.log("✅ MySQL Server Database Connect Successfully");
  }
});

// Call to LLM API
async function llamaApiCall(prompt) {
  try {
    const response = await axios.post(
      process.env.OLLAMA_API_URL,
      {
        model: "llama3.2",
        messages: [
          { role: "system", content: "You are a helpful assistant." },
          { role: "user", content: prompt },
        ],
        stream: false,
      },
      {
        headers: { "Content-Type": "application/json" },
      }
    );

    return response.data.message?.content || "";
  } catch (error) {
    console.error("❌ LLM Error:", error.response?.data || error.message);
    throw new Error("❌ LLM API Error");
  }
}

// Parse Q&A from LLM response
function parseQAResponse(rawText) {
  const lines = rawText
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const qaPairs = [];
  for (let i = 0; i < lines.length - 1; i++) {
    const qMatch = lines[i].match(/^Q[:.)-]?\s*(.+)/i);
    const aMatch = lines[i + 1].match(/^A[:.)-]?\s*(.+)/i);

    if (qMatch && aMatch) {
      qaPairs.push({
        question: qMatch[1],
        answer: aMatch[1],
      });
      i++; // Skip next line since it was an answer
    }
  }

  return qaPairs;
}

// Generate and store unlimited Q&A
app.post("/api/generateQA", async (req, res) => {
  const { topic } = req.body;

  if (!topic) {
    return res.status(400).json({ success: false, message: "❌ Topic is required" });
  }

  const prompt = `Generate as many Q&A as possible about the topic: "${topic}". Format strictly as:\nQ: <question>\nA: <answer>\nRepeat this format for all pairs.`;

  try {
    const rawResponse = await llamaApiCall(prompt);
    const qaPairs = parseQAResponse(rawResponse);

    if (qaPairs.length === 0) {
      return res.status(500).json({ success: false, message: "❌ No valid Q&A generated" });
    }

    // Insert topic
    const topicQuery = "INSERT INTO TEST_QM (MAIN_HEAD, TOPIC, TYPE, VENDOR_ID) VALUES (?, ?, ?, ?)";
    db.query(topicQuery, ["INTERN TRAINING", topic, "QUESTION", 5], (err, result) => {
      if (err) {
        console.error("❌ Error inserting topic:", err);
        return res.status(500).json({ error: "❌ Topic insertion failed" });
      }

      const topicId = result.insertId;

      // Insert Q&A
      const promises = qaPairs.map(({ question, answer }) => {
        return new Promise((resolve, reject) => {
          const insertQuery = `
            INSERT INTO TEST_QUESTIONS (
              QM_ID, ROLE_ID, VENDOR_ID, TYPE, QUESTION, ANSWER_SUMMARY, ANSWER_DETAIL,
              OPTION1, OPTION2, OPTION3, OPTION4
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `;
          db.query(
            insertQuery,
            [topicId, 5, 5, "QUESTION", question, answer, answer, "Option 1", "Option 2", "Option 3", "Option 4"],
            (err) => {
              if (err) reject(err);
              else resolve();
            }
          );
        });
      });

      Promise.all(promises)
        .then(() => {
          res.json({ success: true, message: "✅ Q&A Generated and Stored", data: qaPairs });
        })
        .catch((error) => {
          console.error("❌ Error inserting Q&A:", error);
          res.status(500).json({ error: "❌ Failed to insert Q&A" });
        });
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Fetch latest Q&A
app.get("/getQuestions", (req, res) => {
  const query = `
    SELECT QUESTION, ANSWER_SUMMARY 
    FROM TEST_QUESTIONS
    WHERE QM_ID = (SELECT MAX(QM_ID) FROM TEST_QM)
    ORDER BY Q_ID ASC
  `;
  db.query(query, (err, results) => {
    if (err) {
      console.error("❌ Error fetching questions:", err);
      return res.status(500).json({ error: "❌ Retrieval failed" });
    }
    res.json(results);
  });
});

// Fetch latest topic
app.get("/getLatestTopic", (req, res) => {
  const query = "SELECT TOPIC FROM TEST_QM ORDER BY QM_ID DESC LIMIT 1";
  db.query(query, (err, result) => {
    if (err) {
      console.error("❌ Error fetching topic:", err);
      return res.status(500).json({ error: "❌ Retrieval failed" });
    }
    res.json({ topic: result[0]?.TOPIC || "No topic found" });
  });
});

app.post('/uploadAudio', upload.single('file'), async (req, res) => {
  try {
    const buffer = req.file.buffer;

    // Call Whisper or transcription API here
    const transcription = await transcribeAudio(buffer); // dummy function

    res.json({ transcription });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: 'Failed to transcribe' });
  }
});

// Start Server
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
