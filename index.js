const express = require("express");
const multer = require("multer");
const csv = require("fast-csv");
const { Readable } = require("stream");
require("dotenv").config(); // Load environment variables from a .env file

const app = express();
const upload = multer();

// Middleware to check the auth token
const authenticate = (req, res, next) => {
  const authToken = req.headers["authorization"];
  const validToken = process.env.CSV_HEADER_API_KEY;

  if (!authToken || authToken !== validToken) {
    return res.status(401).send("Unauthorized: Invalid or missing token.");
  }

  next();
};

// Parse form-data and JSON fields in POST requests
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Secure the route with the authentication middleware
app.post(
  "/update-csv-headers",
  authenticate,
  upload.single("file"),
  async (req, res) => {
    try {
      if (!req.file || !req.body.headers) {
        return res.status(400).send("CSV file and headers are required.");
      }

      // Parse provided headers
      const providedHeaders = req.body.headers
        .split(",")
        .map((header) => header.trim())
        .filter((header) => header); // Remove empty headers

      const csvBuffer = req.file.buffer;

      // Read the CSV content
      const csvStream = Readable.from(csvBuffer.toString());
      let originalHeaders = [];

      // Extract headers only
      await new Promise((resolve, reject) => {
        csv
          .parseStream(csvStream, { headers: false }) // Parse without treating the first row as headers
          .on("data", (row) => {
            if (!originalHeaders.length) {
              originalHeaders = row.map((header) => header.trim()); // Trim and capture original headers
              resolve(); // Stop processing further rows
            }
          })
          .on("error", reject);
      });

      // Combine headers
      const finalHeaders = [
        ...new Set(
          [...providedHeaders, ...originalHeaders].filter((header) => header)
        ),
      ];

      // Write updated CSV content
      let csvOutput = `${finalHeaders.join(",")}\n`; // Add updated headers as the first row
      csvOutput += csvBuffer
        .toString()
        .split("\n")
        .slice(1) // Remove the original header row
        .join("\n");

      res.setHeader("Content-Disposition", "attachment; filename=updated.csv");
      res.setHeader("Content-Type", "text/csv");
      res.send(csvOutput);
    } catch (error) {
      console.error(error);
      res.status(500).send("An error occurred while processing the CSV file.");
    }
  }
);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
