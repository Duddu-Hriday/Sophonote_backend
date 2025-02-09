const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const speech = require('@google-cloud/speech')
const cors = require("cors");
// Load Google Cloud credentails
process.env.GOOGLE_APPLICATION_CREDENTIALS = path.join(__dirname,"google_api.json");


const app = express();
app.use(cors());
const PORT = process.env.PORT || 3000;



// Configure Multer storage to preserve file extension
const storage = multer.diskStorage({
  destination: 'uploads/', // Save files in "uploads" folder
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname); // Get original file extension
    const filename = `${Date.now()}${ext}`; // Create a unique filename
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
app.post('/upload', upload.single('audio'), async(req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  //  res.json({ message: 'Upload successful!', filename: req.file.filename });
  try{
    const transcript = await convertSpeechToText(req.file.path);

    res.json({
      message: "Upload and transcription Successful",
      filename: req.file.filename,
      transcript,
    });
  }

  catch(err) 
  {
    res.status(500).json({error: err.message});
  }

  // console.log(res);
  
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

  const request = {audio, config};

  const [response] = await client.recognize(request);
  return response.results.map((result)=> result.alternatives[0].transcript).join("\n");
  
}
// Serve uploaded files
app.use('/uploads', express.static('uploads'));

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
