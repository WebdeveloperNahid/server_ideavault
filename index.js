const express = require("express");
// const dotenv = require("dotenv");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();
const cors = require("cors");
const { createRemoteJWKSet, jwtVerify } = require("jose-cjs");

const app = express();
app.use(cors());
app.use(express.json());

const port = process.env.PORT || 8080;
const uri = process.env.MONGODB_URI;

// const JWKS = createRemoteJWKSet(
//   new URL(`${process.env.CLIENT_URL}/api/auth/jwks`),
// );

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

// const logger = (req, res, next) => {
//   console.log(`${req.method} | ${req.url}`);
//   next();
// };

// ✅ একবার connect করো, বারবার না
let isConnected = false;
async function connectDB() {
  if (!isConnected) {
    await client.connect();
    isConnected = true;
    console.log("MongoDB connected!");
  }
  return client.db("ideavault");
}

const varifyToken = async (req, res, next) => {
  // console.log(req.headers, "from varify token");
  const { authorization } = req.headers;
  const token = authorization?.split(" ")[1];
  // console.log(token)

  if (!token) {
    return res.status(401).json({ message: "unauthorize" });
  }
  try {
    const JWKS = createRemoteJWKSet(
      new URL(`${process.env.CLIENT_URL}/api/auth/jwks`),
    );
    const { payload } = await jwtVerify(token, JWKS);
    req.user = payload;
    next();
  } catch (error) {
    console.error("Token validation failed:", error);
    return res.status(401).json({ message: "unauthorize" });
  }
};

// async function run() {
//   try {
//     await client.connect();

//     const db = client.db("ideavault");
//     const ideasCollection = db.collection("ideas");
//     const commentsCollection = db.collection("comments");

app.get("/", (req, res) => res.send("Hello World!"));

app.get("/home", async (req, res) => {
  const db = await connectDB();
  const result = await db.collection("ideas").find().limit(6).toArray();
  res.send(result);
});
app.get("/ideas", async (req, res) => {
  const db = await connectDB();
  const { search, category } = req.query;
  let query = {};
  if (search) query.ideaTitle = { $regex: search, $options: "i" };
  if (category && category !== "all") query.category = category;
  const ideas = await db.collection("ideas").find(query).toArray();
  res.send(ideas);
});

app.get("/ideas/:IdeasId", varifyToken, async (req, res) => {
  const db = await connectDB();
  const { IdeasId } = req.params;
  let result = null;
  try {
    result = await db
      .collection("ideas")
      .findOne({ _id: new ObjectId(IdeasId) });
  } catch {}
  if (!result) {
    result = await db.collection("ideas").findOne({ _id: IdeasId });
  }

  if (!result) return res.status(404).json({ message: "Not found" });
  res.send(result);
});

// Comment POST করো
app.post("/ideas", varifyToken, async (req, res) => {
  const db = await connectDB();
  const idea = req.body;
  const { sub: userId, name, username, email } = req.user;

  const newIdea = {
    ideaTitle: idea.title,
    shortDescription: idea.shortDesc,
    detailedDescription: idea.detailedDesc,
    category: idea.category,
    imageURL: idea.imageUrl,
    targetAudience: idea.targetAudience,
    problemStatement: idea.problemStatement,
    proposedSolution: idea.proposedSolution,
    userId,
    userName: username || name || email,
    createdAt: new Date(),
  };

  const result = await db.collection("ideas").insertOne(newIdea);
  res.send({ ...newIdea, _id: result.insertedId });
});

app.get("/my-ideas", varifyToken, async (req, res) => {
  const db = await connectDB();
  const { sub: userId } = req.user;
  const result = await db
    .collection("ideas")
    .find({ userId })
    .sort({ createdAt: -1 })
    .toArray();
  res.send(result);
});

app.patch("/ideas/:ideaId", varifyToken, async (req, res) => {
  const db = await connectDB();
  const { ideaId } = req.params;
  const { sub: userId } = req.user;
  const body = req.body;
  let query;
  try {
    query = { _id: new ObjectId(ideaId) };
  } catch {
    query = { _id: ideaId };
  }
  const idea = await db.collection("ideas").findOne(query);
  if (!idea) return res.status(404).json({ message: "Not found" });
  if (idea.userId !== userId)
    return res.status(403).json({ message: "Forbidden" });
  await db.collection("ideas").updateOne(query, {
    $set: { ...body, updatedAt: new Date() },
  });
  res.send({ message: "Updated" });
});

app.delete("/ideas/:ideaId", varifyToken, async (req, res) => {
  const db = await connectDB();
  const { ideaId } = req.params;
  const { sub: userId } = req.user;
  let query;
  try {
    query = { _id: new ObjectId(ideaId) };
  } catch {
    query = { _id: ideaId };
  }
  const idea = await db.collection("ideas").findOne(query);
  if (!idea) return res.status(404).json({ message: "Not found" });
  if (idea.userId !== userId)
    return res.status(403).json({ message: "Forbidden" });
  await db.collection("ideas").deleteOne(query);
  res.send({ message: "Deleted" });
});

// idea get every comments
app.get("/comments/:ideaId", async (req, res) => {
  const db = await connectDB();
  const { ideaId } = req.params;
  const comments = await db
    .collection("comments")
    .find({ ideaId })
    .sort({ createdAt: -1 })
    .toArray();
  res.send(comments);
});

// My Interactions —my all comments

app.get("/my-comments", varifyToken, async (req, res) => {
  const db = await connectDB();
  const { sub: userId } = req.user;
  const comments = await db
    .collection("comments")
    .find({ userId })
    .sort({ createdAt: -1 })
    .toArray();
  res.send(comments);
});

// Comment EDIT করো
app.patch("/comments/:commentId", varifyToken, async (req, res) => {
  const db = await connectDB();
  const { commentId } = req.params; //  commentId nicci
  const { text } = req.body;
  const { sub: userId } = req.user;

  const comment = await db.collection("comments").findOne({
    _id: new ObjectId(commentId), // commentsCollection
  });

  if (!comment) return res.status(404).json({ message: "Not found" });
  if (comment.userId !== userId)
    return res.status(403).json({ message: "Forbidden" });

  await db.collection("comments").updateOne(
    { _id: new ObjectId(commentId) },
    { $set: { text, updatedAt: new Date() } }, //  text update
  );
  res.send({ message: "Updated" });
});

// Comment DELETE করো
app.delete("/comments/:commentId", varifyToken, async (req, res) => {
  const db = await connectDB();
  const { commentId } = req.params;
  const { sub: userId } = req.user;

  const comment = await db.collection("comments").findOne({
    _id: new ObjectId(commentId),
  });

  if (!comment) return res.status(404).json({ message: "Not found" });
  if (comment.userId !== userId)
    return res.status(403).json({ message: "Forbidden" });

  await db.collection("comments").deleteOne({ _id: new ObjectId(commentId) });
  res.send({ message: "Deleted" });
});

////****$$$######### For add-ideas page to add idea card in ideas and my-ideas page */

//Add idea API

app.post("/comments", varifyToken, async (req, res) => {
 const db = await connectDB();
  const { ideaId, text } = req.body;
  const { sub: userId, username, email, name } = req.user;
  if (!ideaId || !text)
    return res.status(400).json({ message: "ideaId and text required" });
  const comment = {
    ideaId,
    text,
    userId,
    userName: username || name || email,
    createdAt: new Date(),
  };
  const result = await db.collection("comments").insertOne(comment);
  res.send({ ...comment, _id: result.insertedId });
});

module.exports = app;

if (require.main === module) {
  app.listen(port, () => console.log(`Server running on port ${port}`));
}

