const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const speech = require('@google-cloud/speech');
const cors = require("cors");
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Load Google Cloud credentials


const googleCredentials = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON || '{}');

if (Object.keys(googleCredentials).length === 0) {
  throw new Error("Google Cloud credentials are missing. Ensure GOOGLE_APPLICATION_CREDENTIALS_JSON is set.");
}

console.log("Google Credentials Loaded Successfully");

// Initialize Google Speech-to-Text Client with credentials
const client = new speech.SpeechClient({ credentials: googleCredentials });

// console.log("Google Credentials: ",googleCredentials);


const app = express();
app.use(cors({
  origin: "https://sophonote-frontend.vercel.app", // Allow only your frontend
  methods: "GET, POST, PUT, DELETE, OPTIONS", // Allow OPTIONS for preflight requests
  allowedHeaders: "Content-Type, Authorization", // Allow required headers
  credentials: true, // Allow cookies if needed
}));

app.options('*', cors()); // Handle preflight requests

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const PORT = process.env.PORT || 3000;

// Supabase configuration
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// Configure Multer storage to preserve file extension
// const storage = multer.diskStorage({
//   destination: 'uploads/',
//   filename: (req, file, cb) => {
//     const ext = path.extname(file.originalname);
//     const filename = `${Date.now()}${ext}`;
//     cb(null, filename);
//   },
// });
const storage = multer.memoryStorage();

const upload = multer({
  storage: storage,
  limits: { fileSize: 1024 * 1024 * 100 }, // 1GB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('audio/')) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type.'));
    }
  },
});

// Google Speech to Text Client
// const client = new speech.SpeechClient();

// Upload Route
app.post('/upload', upload.single('audio'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  let email;
  try {
    const userData = JSON.parse(req.body.user);
    email = userData.email;
  } catch (error) {
    return res.status(400).json({ error: "Invalid user data format" });
  }


  // const email = req.body;
  // console.log("UserEmail: ", email);
  if (!email) {
    return res.status(400).json({ error: "User Email is required" });
  }

  try {
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('user_id')
      .eq('email', email)
      .single();

    if (userError || !userData) {
      console.error("Supabase User Fetch Error:", userError);
      return res.status(400).json({ error: "User not found in database." });
    }

    if (!req.file.buffer) {
      return res.status(400).json({ error: "File buffer is empty" });
    }

    // Convert speech to text
    const transcript = await convertSpeechToText(req.file.buffer);
    const audio_id = "23da28b8-0ec5-4604-ba32-6014e98b6ad4";
    // const user_id = "3e31d1ff-1034-47c8-984a-31c288c8d525";
    const user_id = userData.user_id;
    // const audio_id = crypto.randomUUID();

    // Insert into Supabase
    const { data, error } = await supabase
      .from('transcriptions')
      .insert([{ audio_id: audio_id, user_id: user_id, text: transcript }]);

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
async function convertSpeechToText(audioBuffer) {
  const audio = {
    content: audioBuffer.toString("base64"),
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
app.get("/", (req, res) => {
  // res.send("Speech-to-Text API is running");
  res.send("back-end is working fine");
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
