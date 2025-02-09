const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const speech = require('@google-cloud/speech');
const cors = require("cors");
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Load Google Cloud credentials
process.env.GOOGLE_APPLICATION_CREDENTIALS = path.join(__dirname, "google_api.json");

const app = express();
app.use(cors());
const PORT = process.env.PORT || 3000;

// Supabase configuration
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// Configure Multer storage to preserve file extension
const storage = multer.diskStorage({
  destination: 'uploads/',
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const filename = `${Date.now()}${ext}`;
    cb(null, filename);
  },
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 1024 * 1024 * 1000 }, // 1GB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('audio/')) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type.'));
    }
  },
});

// Google Speech to Text Client
const client = new speech.SpeechClient();

// Upload Route
app.post('/upload', upload.single('audio'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  try {
    // Convert speech to text
    const transcript = await convertSpeechToText(req.file.path);
    const audio_id = "6af0fb46-3abb-453b-9e60-725b0d7bca7e";
    const user_id = "a932d521-7cc3-4c9a-8399-fe344051d83a";
    // Insert into Supabase
    const { data, error } = await supabase
      .from('transcriptions')
      .insert([{audio_id: audio_id, user_id: user_id, text: transcript}]);

    if (error) {
      console.error("Supabase Error:", error);
      throw new Error("Failed to insert transcription into Supabase.");
    }

    res.json({
      message: "Upload and transcription successful",
      filename: req.file.filename,
      transcript,
    });

  } catch (err) {
    console.error("Upload Error:", err.message);
    res.status(500).json({ error: `File upload failed: ${err.message}` });
  }
});


// Function to convert Speech to Text
async function convertSpeechToText(filePath) {
  const audio = {
    content: fs.readFileSync(filePath).toString("base64"),
  };

  const config = {
    encoding: "ENCODING_UNSPECIFIED",
    sampleRateHertz: 48000,
    languageCode: "en-US",
  };

  const request = { audio, config };

  const [response] = await client.recognize(request);
  return response.results.map((result) => result.alternatives[0].transcript).join("\n");
}

// Serve uploaded files
app.use('/uploads', express.static('uploads'));

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
