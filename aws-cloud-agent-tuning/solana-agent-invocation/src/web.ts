import "dotenv/config";
import express from "express";
import { sha256Bytes } from "./chain.js";

const app = express();
app.use(express.json({ limit: "256kb" }));
app.use(express.static(new URL("../web", import.meta.url).pathname));

app.post("/api/hash", (req, res) => {
  const serialized = JSON.stringify(req.body);
  res.json({
    inputHash: Buffer.from(sha256Bytes(serialized)).toString("hex"),
    payload: req.body
  });
});

const port = Number.parseInt(process.env.PORT ?? "8787", 10);
app.listen(port, () => {
  console.log(`OpenClaw Solana invocation demo running on http://localhost:${port}`);
});
